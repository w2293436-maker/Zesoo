"""文件解析模块 — 支持 PDF / TXT / DOCX（含 OCR）"""

import os
import base64
import asyncio
from docx import Document


async def parse_file(file_path: str) -> str:
    """根据文件扩展名选择解析器，返回纯文本内容（异步，支持 OCR）"""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        return await _parse_pdf(file_path)
    elif ext == ".docx":
        return _parse_docx(file_path)
    elif ext == ".txt":
        return _parse_txt(file_path)
    else:
        raise ValueError(f"不支持的文件格式: {ext}")


async def _parse_pdf(file_path: str) -> str:
    """解析 PDF 文件 — 三级策略：pdfplumber → PyPDF2 → DeepSeek OCR"""
    pages_text = []

    # 方案一：pdfplumber（对中文/复杂排版 PDF 效果好）
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages_text.append(text.strip())
        if pages_text:
            return "\n\n".join(pages_text)
    except Exception:
        pass

    # 方案二：PyPDF2（兼容降级）
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(file_path)
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text.strip())
        if pages_text:
            return "\n\n".join(pages_text)
    except Exception:
        pass

    # 方案三：DeepSeek Vision OCR（扫描件/图片型 PDF）
    print(f"[OCR] 常规解析提取不到文字，启用 DeepSeek 视觉识别...")
    return await _ocr_pdf_via_deepseek(file_path)


async def _ocr_pdf_via_deepseek(file_path: str) -> str:
    """用 DeepSeek Vision API 对 PDF 逐页进行 OCR 识别"""
    import httpx
    import pymupdf  # fitz
    from config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL

    pdf_doc = pymupdf.open(file_path)
    total_pages = len(pdf_doc)

    if total_pages == 0:
        raise ValueError("PDF 文件为空")

    print(f"[OCR] 共 {total_pages} 页，正在逐页识别...")

    async def ocr_page(client: httpx.AsyncClient, page_num: int) -> str:
        """对单页进行 OCR"""
        page = pdf_doc[page_num]
        # 渲染为图片（300 DPI 保证清晰度）
        pix = page.get_pixmap(dpi=200)
        img_bytes = pix.tobytes("png")
        img_base64 = base64.b64encode(img_bytes).decode("utf-8")

        response = await client.post(
            f"{DEEPSEEK_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "请识别并提取这张图片中的所有文字内容。直接输出原文，不要添加任何解释、总结或标记。保持原文的段落结构和格式。如果图片中没有文字，请回复[无文字]。",
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{img_base64}"
                                },
                            },
                        ],
                    }
                ],
                "max_tokens": 4096,
                "temperature": 0,
            },
            timeout=120.0,
        )
        response.raise_for_status()
        result = response.json()
        content = result["choices"][0]["message"]["content"]

        if content == "[无文字]":
            return ""
        return content

    async with httpx.AsyncClient() as client:
        # 一次并发 3 页，避免请求过于密集
        semaphore = asyncio.Semaphore(3)

        async def ocr_with_limit(page_num: int) -> tuple[int, str]:
            async with semaphore:
                try:
                    text = await ocr_page(client, page_num)
                    return page_num, text
                except Exception as e:
                    print(f"[OCR] 第 {page_num + 1} 页识别失败: {e}")
                    return page_num, f"[第 {page_num + 1} 页识别失败]"

        tasks = [ocr_with_limit(i) for i in range(total_pages)]
        results = await asyncio.gather(*tasks)

    # 按页码排序并合并
    results.sort(key=lambda x: x[0])
    all_text = []
    for page_num, text in results:
        if text.strip():
            all_text.append(f"--- 第 {page_num + 1} 页 ---\n{text.strip()}")

    pdf_doc.close()

    if not all_text:
        raise ValueError(
            "OCR 识别完成但未提取到文字。\n"
            "可能原因：PDF 页面为纯图片且内容模糊、或者确实是空白页。"
        )

    print(f"[OCR] 识别完成，共提取 {sum(len(t) for t in all_text)} 字符")
    return "\n\n".join(all_text)


def _parse_docx(file_path: str) -> str:
    """解析 DOCX 文件"""
    doc = Document(file_path)
    paragraphs = []
    for para in doc.paragraphs:
        if para.text.strip():
            paragraphs.append(para.text.strip())
    if not paragraphs:
        raise ValueError("DOCX 文件内容为空")
    return "\n\n".join(paragraphs)


def _parse_txt(file_path: str) -> str:
    """解析 TXT 文件（尝试多种编码）"""
    for encoding in ["utf-8", "gbk", "gb2312", "gb18030", "latin-1"]:
        try:
            with open(file_path, "r", encoding=encoding) as f:
                content = f.read()
            if content.strip():
                return content
        except (UnicodeDecodeError, UnicodeError):
            continue
    raise ValueError("TXT 文件无法识别编码，请转换为 UTF-8 格式")


def get_text_stats(text: str) -> dict:
    """获取文本统计信息"""
    chars = len(text)
    estimated_tokens = int(chars / 2.5)
    lines = text.count("\n") + 1
    return {
        "chars": chars,
        "estimated_tokens": estimated_tokens,
        "lines": lines,
        "needs_chunking": estimated_tokens > 6000,
    }
