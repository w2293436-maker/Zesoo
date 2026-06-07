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

CHAPTER_DETECT_PROMPT = """你是一位专业的书籍结构分析专家。请扫描以下书籍文本，识别出书中所有的章节和小节。

要求：
1. 识别书籍中每一个独立的章节/小节单位
2. 对于每个章节，提取：
   - chapter_name: 完整章节标题
   - start_marker: 该章节开头的特征文字（20字以内，用于在原文中精确定位）
3. 按书中出现顺序排列，不要合并、不要遗漏

注意：
- start_marker 必须取自该章节开头原文，确保在原文中可精确查找
- 如果文本没有明显章节标记，根据内容主题的自然断点来划分
- 只返回 JSON，不要有其他文字"""


def _build_scan_text(text: str) -> str:
    """构建发给 AI 的文本：尽可能发送完整内容，超长时均匀采样"""
    max_chars = 80000  # deepseek-chat 64K token ≈ 96K-128K 汉字，留余量
    if len(text) <= max_chars:
        return text, len(text)

    # 超长文本：前40K + 中段采样 + 后20K
    head = text[:40000]
    tail = text[-20000:]
    mid_start = len(text) // 3
    mid_end = mid_start + 20000
    mid = text[mid_start:mid_end]
    sample = f"{head}\n\n...（中段采样）...\n\n{mid}\n\n...（末尾）...\n\n{tail}"
    return sample, len(text)


async def detect_chapters(client: httpx.AsyncClient, text: str) -> dict:
    """AI 识别书籍章节结构"""
    scan_text, total_chars = _build_scan_text(text)

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
                {"role": "user", "content": f"请识别以下书籍的完整章节结构（全书约{total_chars}字符）。\n\n{scan_text}"},
            ],
            "temperature": 0.1,
            "max_tokens": 16384,
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
