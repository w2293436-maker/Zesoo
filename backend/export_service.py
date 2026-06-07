"""Word (DOCX) 导出服务"""

import os
from datetime import datetime
from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH


def generate_docx(report: dict, output_dir: str) -> str:
    """根据报告 JSON 生成 Word 文档，返回文件路径"""
    doc = Document()

    # 默认字体
    style = doc.styles["Normal"]
    font = style.font
    font.name = "微软雅黑"
    font.size = Pt(11)

    # ===== 封面 =====
    title = doc.add_heading("书籍精读报告", level=0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    book_title = report.get("book_title", "未命名书籍")
    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run(f"《{book_title}》")
    run.font.size = Pt(16)
    run.font.color.rgb = RGBColor(59, 130, 246)

    date_para = doc.add_paragraph()
    date_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = date_para.add_run(f"生成日期：{datetime.now().strftime('%Y年%m月%d日')}")
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(148, 163, 184)

    doc.add_paragraph()
    doc.add_paragraph("—" * 40)

    # ===== 逐章内容 =====
    chapters = report.get("chapters", [])
    for i, ch in enumerate(chapters, 1):
        chapter_name = ch.get("chapter_name", f"章节 {i}")

        # 章节标题
        doc.add_heading(f"{chapter_name}", level=1)

        # 1. 章节总结
        doc.add_heading("📝 章节总结", level=2)
        summary = ch.get("summary", "")
        if summary:
            doc.add_paragraph(summary)

        # 2. 核心观点
        doc.add_heading("💡 核心观点", level=2)
        core_ideas = ch.get("core_ideas", [])
        if core_ideas:
            for j, item in enumerate(core_ideas, 1):
                idea_text = item.get("idea", "")
                elaboration = item.get("elaboration", "")
                p = doc.add_paragraph()
                run = p.add_run(f"观点 {j}：{idea_text}")
                run.bold = True
                if elaboration:
                    doc.add_paragraph(elaboration)
        else:
            doc.add_paragraph("（无）")

        # 3. 金句摘录
        doc.add_heading("✨ 金句摘录", level=2)
        quotes = ch.get("quotes", [])
        if quotes:
            for q in quotes:
                text = q.get("text", "")
                context = q.get("context", "")
                p = doc.add_paragraph()
                run = p.add_run(f'"{text}"')
                run.italic = True
                run.font.color.rgb = RGBColor(55, 65, 81)
                if context:
                    ctx_para = doc.add_paragraph()
                    run = ctx_para.add_run(f"—— {context}")
                    run.font.size = Pt(9)
                    run.font.color.rgb = RGBColor(148, 163, 184)
                doc.add_paragraph()
        else:
            doc.add_paragraph("（无）")

        # 4. 方法论
        doc.add_heading("🔧 方法论", level=2)
        methodology = ch.get("methodology", [])
        if methodology:
            for m in methodology:
                name = m.get("name", "")
                desc = m.get("description", "")
                steps = m.get("steps", [])
                doc.add_heading(name, level=3)
                if desc:
                    doc.add_paragraph(desc)
                if steps:
                    p = doc.add_paragraph()
                    run = p.add_run("操作步骤：")
                    run.bold = True
                    for k, step in enumerate(steps, 1):
                        doc.add_paragraph(f"{k}. {step}", style="List Number")
        else:
            doc.add_paragraph("（无）")

        # 5. 启示建议
        doc.add_heading("🎯 启示与行动建议", level=2)
        insights = ch.get("actionable_insights", [])
        if insights:
            for item in insights:
                insight_text = item.get("insight", "")
                action_text = item.get("action", "")
                p = doc.add_paragraph()
                run = p.add_run(f"💡 {insight_text}")
                run.bold = True
                p2 = doc.add_paragraph()
                run = p2.add_run("行动建议：")
                run.bold = True
                p2.add_run(action_text)
                doc.add_paragraph()
        else:
            doc.add_paragraph("（无）")

        # 章间分隔（最后一章不加）
        if i < len(chapters):
            doc.add_page_break()

    # ===== 页脚 =====
    doc.add_paragraph()
    doc.add_paragraph("—" * 40)
    footer = doc.add_paragraph()
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = footer.add_run("本报告由 AI 自动生成，仅供参考 | LumCore Reader")
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor(203, 213, 225)

    # 保存
    filename = f"书籍精读报告_{book_title}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
    filepath = os.path.join(output_dir, filename)
    doc.save(filepath)

    return filepath
