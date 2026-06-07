"""DeepSeek AI 服务 — 章节检测 + 逐章精读分析"""

import asyncio
import json
import re

import httpx
from config import (
    DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL,
)


def estimate_tokens(text: str) -> int:
    """粗略估算 token 数"""
    return max(1, int(len(text) / 2.5))


def _safe_json_parse(content: str) -> dict:
    """安全解析 JSON，处理控制字符和 markdown 包裹"""
    # 清理 markdown 代码块
    if content.startswith("```"):
        lines = content.split("\n")
        content = "\n".join(lines[1:])
        if content.endswith("```"):
            content = content[:-3]
    content = content.strip()
    # 移除 JSON 字符串中的非法控制字符
    import re
    content = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', content)
    return json.loads(content)


# ==================== 章节检测 ====================

CHAPTER_DETECT_PROMPT = """你是一位专业的书籍结构分析专家。请扫描以下书籍文本，识别出书中所有的"章节"或"小节"。

要求：
1. 识别书籍中每一个独立的章节/小节单位（以"第X章""第X节""Chapter""Part""一、""1."等为标记，或根据内容主题变化判断）
2. 对于每个章节，提取：
   - chapter_name: 完整章节标题（如"第一章 时间管理基础"）
   - start_marker: 该章节开头的特征文字（20字以内，用于精确定位，必须能在原文中唯一匹配到）
3. 不要合并章节，尽可能细地划分（小节级别优先于大章级别）
4. 按书中出现顺序排列

请返回 JSON：
{
  "book_title": "识别到的书名",
  "chapters": [
    {"chapter_name": "章节标题", "start_marker": "该章节开头20字"},
    ...
  ]
}

注意：
- start_marker 必须取自原文开头，确保在原文中可精确查找
- 如果文本没有明显的章节标记，根据内容主题的自然断点来划分
- 最少划分1个章节，最多划分50个章节
- 只返回 JSON，不要有其他文字"""


def _regex_find_chapters(text: str) -> list[dict]:
    """用正则扫描全书，找到所有可能的章节开头（不依赖 AI）"""
    patterns = [
        r'第[零一二三四五六七八九十百千\d]+[章节回部篇]',  # 第X章/第X节
        r'(?:Chapter|CHAPTER|Part|PART)\s*\d+',  # Chapter 1, Part 1
        r'[一二三四五六七八九十]{1,3}[、，,]',  # 一、二、三、
        r'^\d+[\.\、\)]\s',  # 1. 2. 3.
    ]

    findings = []
    for pattern in patterns:
        for m in re.finditer(pattern, text, re.MULTILINE):
            # 取匹配位置前10字符到后40字符作为章节标题
            start = m.start()
            end = min(start + 50, len(text))
            # 向后找到换行或句号作为标题结束
            snippet = text[start:end]
            newline_pos = snippet.find('\n')
            period_pos = snippet.find('。')
            cut = min(newline_pos if newline_pos > 0 else len(snippet),
                     period_pos if period_pos > 0 else len(snippet),
                     40)
            title = text[start:start + cut].strip()
            findings.append({
                "pos": start,
                "chapter_name": title,
                "start_marker": title[:20],
            })

    # 按位置排序并去重（同一位置只保留第一个）
    findings.sort(key=lambda x: x["pos"])
    deduped = []
    seen_positions = set()
    for f in findings:
        # 同一位置附近10字符算重复
        key = f["pos"] // 10
        if key not in seen_positions:
            seen_positions.add(key)
            deduped.append(f)

    return deduped


async def detect_chapters(client: httpx.AsyncClient, text: str) -> dict:
    """AI 识别书籍章节结构（先用正则预扫描，再让 AI 精修）"""
    # 先用正则扫描全书找章节标记
    regex_chapters = _regex_find_chapters(text)

    # 提取书名：取文本前 80 字符中的第一行
    first_line = text[:200].split('\n')[0].strip()
    if not first_line:
        first_line = "未知书籍"

    # 构建发给 AI 的章节候选列表
    if regex_chapters:
        # 最多取前 80 个章节标记发给 AI
        preview_chapters = regex_chapters[:80]
        candidate_list = "\n".join([
            f"  {i+1}. pos={ch['pos']}, 标题候选: \"{ch['chapter_name']}\""
            for i, ch in enumerate(preview_chapters)
        ])
        # 如果全书有更多章节，加提示
        extra_hint = ""
        if len(regex_chapters) > 80:
            extra_hint = f"\n（全书共发现 {len(regex_chapters)} 个潜在章节标记，以上仅列出前 80 个。请推断剩余章节的规律并包含在结果中。）"

        detect_prompt = f"""请识别以下书籍的章节结构。

正则预扫描已发现以下潜在章节标记：
{candidate_list}{extra_hint}

请根据这些标记和文本规律，提取出完整的章节列表。
要求：
- 每个章节需要 chapter_name（完整标题）和 start_marker（可在原文唯一定位的开头文字）
- 合并相邻的重复标记，去除非章节的误匹配
- 按原文出现顺序排列
- 只返回 JSON，不要有其他文字"""

        # 取全书的关键片段：开头的目录 + 散点采样
        scan_len = min(40000, len(text))
        scan_text = text[:scan_len]
        if len(text) > scan_len:
            # 额外采样几段中间和后部的内容帮助 AI 理解章节规律
            mid = len(text) // 2
            end = max(len(text) - 2000, 0)
            scan_text += f"\n\n...（中间采样）...\n{text[mid:mid+2000]}"
            scan_text += f"\n\n...（末尾采样）...\n{text[end:end+2000]}"
    else:
        # 没找到正则匹配，用传统方式
        scan_len = min(40000, len(text))
        scan_text = text[:scan_len]
        detect_prompt = f"请识别以下书籍的章节结构：\n\n{scan_text}\n\n（全书共 {len(text)} 字符。如无明显章节标记，请根据内容主题变化划分。）"

    response = await client.post(
        f"{DEEPSEEK_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": DEEPSEEK_MODEL,
            "messages": [
                {"role": "system", "content": CHAPTER_DETECT_PROMPT},
                {"role": "user", "content": detect_prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 8192,
            "response_format": {"type": "json_object"},
        },
        timeout=180.0,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
        if content.endswith("```"):
            content = content[:-3]
    return _safe_json_parse(content)


def split_text_by_chapters(text: str, chapters: list[dict]) -> list[dict]:
    """
    根据 AI 识别的章节信息，将文本切分为独立的章节块。
    返回: [{"chapter_name": "...", "text": "...", "index": 0}, ...]
    """
    if not chapters:
        return [{"chapter_name": "全书内容", "text": text, "index": 0}]

    result = []
    for i, ch in enumerate(chapters):
        marker = ch.get("start_marker", "")
        name = ch.get("chapter_name", f"章节 {i + 1}")

        # 在文本中查找该章节的起始位置
        if marker:
            pos = text.find(marker)
            if pos == -1:
                # 尝试模糊匹配（去掉多余空格）
                simplified = re.sub(r'\s+', '', marker)
                simplified_text = re.sub(r'\s+', '', text)
                pos = simplified_text.find(simplified)
                if pos >= 0:
                    # 还原位置
                    pos = int(pos / len(simplified_text) * len(text)) if simplified_text else -1
        else:
            pos = -1

        result.append({
            "chapter_name": name,
            "text": "",  # 稍后填充
            "start_pos": pos if pos >= 0 else None,
            "marker": marker,
            "index": i,
        })

    # 为每个章节分配文本范围
    for i in range(len(result)):
        start = result[i]["start_pos"]
        if start is not None and start >= 0:
            # 找下一个有效章节的起始位置作为结束
            end = len(text)
            for j in range(i + 1, len(result)):
                next_start = result[j]["start_pos"]
                if next_start is not None and next_start > start:
                    end = next_start
                    break
            result[i]["text"] = text[start:end].strip()
        else:
            result[i]["text"] = ""

    # 处理无法定位的章节：将未分配文本按比例分配
    unpositioned = [r for r in result if not r["text"]]
    if unpositioned:
        # 计算已分配的文本范围
        positioned = [r for r in result if r["text"]]
        if positioned:
            # 找到未覆盖的区域
            covered_end = 0
            for r in sorted(positioned, key=lambda x: x["start_pos"] or 0):
                covered_end = max(covered_end, (r["start_pos"] or 0) + len(r["text"]))

            leftover = text[covered_end:].strip()
            if leftover and unpositioned:
                chunk_size = len(leftover) // len(unpositioned)
                for i, r in enumerate(unpositioned):
                    s = i * chunk_size
                    e = len(leftover) if i == len(unpositioned) - 1 else (i + 1) * chunk_size
                    r["text"] = leftover[s:e].strip()
        else:
            # 完全没有定位到，平均分配
            chunk_size = len(text) // len(unpositioned)
            for i, r in enumerate(unpositioned):
                s = i * chunk_size
                e = len(text) if i == len(unpositioned) - 1 else (i + 1) * chunk_size
                r["text"] = text[s:e].strip()

    # 过滤空章节，整理返回
    valid = [r for r in result if r["text"] and len(r["text"]) > 20]
    for i, r in enumerate(valid):
        r["index"] = i
        del r["start_pos"]
        del r["marker"]

    # 如果过滤后为空，退化为整本书作为一章
    if not valid:
        return [{"chapter_name": "全书内容", "text": text, "index": 0}]

    return valid


# ==================== 逐章精读分析 ====================

CHAPTER_ANALYSIS_PROMPT = """你是一位资深的书籍精读分析专家。请仔细阅读以下书籍章节的完整内容，进行深度精读分析。

请从该章节中提取以下五个维度的完整信息（不要限制数量，该章有多少就提取多少）：

## 1. 章节总结
用 3-5 句话概括本章的核心内容和论述逻辑。要说清楚"讲了什么"以及"怎么讲的"。

## 2. 核心观点
提取本章中作者提出的所有重要观点、理论、论断。每个观点包含：
- idea: 观点的一句话概述
- elaboration: 观点的详细解释（书中是如何论证的）

## 3. 金句摘录
摘录本章中最精彩、最有启发性的原文语句。要求：
- text: 必须是原文原句，一字不改
- context: 该句出现的背景说明
- 不要限制数量，但凡有价值的都摘出来

## 4. 方法论
提取本章中提到的所有方法、技巧、工具、框架、步骤。每个方法包含：
- name: 方法名称
- description: 方法说明
- steps: 具体操作步骤（如果有的话）

## 5. 启示与行动建议
基于本章内容，提出对读者的启示和可落地的行动建议：
- insight: 从本章获得的启发
- action: 基于该启发的具体行动建议

请以 JSON 格式返回（不要限制数组长度，有多少就列多少）：
{
  "summary": "本章总结（3-5句话）",
  "core_ideas": [
    {"idea": "观点概述", "elaboration": "详细论证"}
  ],
  "quotes": [
    {"text": "原文金句", "context": "出处语境"}
  ],
  "methodology": [
    {"name": "方法名", "description": "说明", "steps": ["步骤1", "步骤2"]}
  ],
  "actionable_insights": [
    {"insight": "启示", "action": "具体行动建议"}
  ]
}

重要：
- 每个数组都不要限制数量，该章节中有多少就提取多少
- 如果某个维度确实没有内容，返回空数组 []
- 金句必须是原文原句，不要改写或润色
- 只返回 JSON，不要有任何其他文字"""


async def analyze_chapter(
    client: httpx.AsyncClient,
    chapter_name: str,
    chapter_text: str,
    chapter_index: int,
    total: int,
) -> dict:
    """对单个章节进行完整精读分析"""
    response = await client.post(
        f"{DEEPSEEK_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": DEEPSEEK_MODEL,
            "messages": [
                {"role": "system", "content": CHAPTER_ANALYSIS_PROMPT},
                {
                    "role": "user",
                    "content": f"请精读分析《{chapter_name}》（第 {chapter_index + 1}/{total} 章）：\n\n{chapter_text}",
                },
            ],
            "temperature": 0.3,
            "max_tokens": 8192,
            "response_format": {"type": "json_object"},
        },
        timeout=180.0,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    result = _safe_json_parse(content)

    # 加上章节名
    result["chapter_name"] = chapter_name
    return result
