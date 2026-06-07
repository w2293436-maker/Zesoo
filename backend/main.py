"""
FastAPI 主入口 — 择书Zesoo 后端
启动方式: uvicorn main:app --reload --port 8000
"""

import asyncio
import io
import json
import os
import uuid
import shutil
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sse_starlette.sse import EventSourceResponse

from config import UPLOAD_DIR, MAX_FILE_SIZE_MB, ALLOWED_EXTENSIONS
from parser import parse_file, get_text_stats
from ai_service import detect_chapters, split_text_by_chapters, analyze_chapter, estimate_tokens
from export_service import generate_docx
import stats as stats_module

app = FastAPI(title="择书Zesoo API", version="1.0.0")

# 管理后台密码（通过环境变量设置，默认 admin123）
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")


def get_client_info(request) -> tuple[str, str]:
    """从请求中提取客户端 IP 和 User-Agent"""
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if not ip:
        ip = request.headers.get("x-real-ip", "")
    if not ip:
        if request.client:
            ip = request.client.host
        else:
            ip = "unknown"
    ua = request.headers.get("user-agent", "")
    return ip, ua

# 静态文件目录（前端构建产物）
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

# CORS — 允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境建议限制为具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== 访问统计中间件 =====
@app.middleware("http")
async def track_visits(request, call_next):
    # 只统计页面访问，跳过 API 和静态资源
    path = request.url.path
    if not path.startswith("/api/") and not path.startswith("/assets/") and path.count(".") == 0:
        try:
            ip, ua = get_client_info(request)
            stats_module.record_visit(ip, ua)
        except Exception:
            pass  # 统计失败不影响主流程
    response = await call_next(request)
    return response


# ===== 任务状态管理（内存中，重启丢失） =====
# 生产环境建议改用 Redis
tasks: dict = {}  # task_id -> {status, progress, report, file_path, ...}


def set_progress(task_id: str, progress: int, step: str, detail: str = ""):
    """更新任务进度"""
    if task_id in tasks:
        tasks[task_id]["progress"] = progress
        tasks[task_id]["step"] = step
        tasks[task_id]["detail"] = detail


async def process_book(task_id: str, file_path: str, filename: str):
    """后台异步处理书籍 — 章节检测 + 逐章精读"""
    tinfo = tasks.get(task_id, {})
    ip = tinfo.get("ip", "unknown")
    ua = tinfo.get("ua", "")
    try:
        # ---- 阶段 1：解析文件 ----
        set_progress(task_id, 5, "parse", "正在解析文件...")
        await asyncio.sleep(0.1)

        text = await parse_file(file_path)
        text_stats = get_text_stats(text)
        tasks[task_id]["text_stats"] = text_stats
        try: stats_module.record_task_start(ip, ua, task_id, filename, text_stats["chars"])
        except Exception: pass
        set_progress(task_id, 10, "parse", f"解析完成，共 {text_stats['chars']} 字符")
        try: stats_module.record_phase_time(task_id, "parse")
        except Exception: pass

        # ---- 阶段 2：AI 识别章节结构 ----
        set_progress(task_id, 15, "detect", "AI 正在识别书籍章节结构...")
        await asyncio.sleep(0.1)

        async with httpx.AsyncClient() as client:
            detection = await detect_chapters(client, text)

        book_title = detection.get("book_title", filename.rsplit(".", 1)[0])
        raw_chapters = detection.get("chapters", [])

        if not raw_chapters:
            # 识别不出章节时，整本书作为一个章节处理
            raw_chapters = [{"chapter_name": book_title, "start_marker": text[:20].strip()}]

        tasks[task_id]["total_chapters"] = len(raw_chapters)
        set_progress(task_id, 20, "split", f"识别到 {len(raw_chapters)} 个章节，正在切分...")
        try: stats_module.record_phase_time(task_id, "detect")
        except Exception: pass

        # ---- 阶段 3：按章节切分文本 ----
        chapter_blocks = split_text_by_chapters(text, raw_chapters)
        total = len(chapter_blocks)

        if total == 0:
            raise ValueError("无法切分章节，请检查文件内容")

        set_progress(task_id, 25, "analyze", f"共 {total} 个章节，开始逐章精读分析...")

        # ---- 阶段 4：逐章深度分析 ----
        chapter_results = []
        semaphore = asyncio.Semaphore(3)  # 并发控制

        async def analyze_one(chapter: dict) -> dict:
            async with semaphore:
                async with httpx.AsyncClient() as client:
                    try:
                        result = await analyze_chapter(
                            client,
                            chapter["chapter_name"],
                            chapter["text"],
                            chapter["index"],
                            total,
                        )
                        return result
                    except Exception as e:
                        return {
                            "chapter_name": chapter["chapter_name"],
                            "summary": f"分析失败: {e}",
                            "core_ideas": [],
                            "quotes": [],
                            "methodology": [],
                            "actionable_insights": [],
                            "_error": str(e),
                        }

        tasks_list = [analyze_one(ch) for ch in chapter_blocks]

        # 逐个等待并更新进度
        for i, task in enumerate(asyncio.as_completed(tasks_list)):
            result = await task
            chapter_results.append(result)
            progress = 25 + int(((i + 1) / total) * 55)
            set_progress(
                task_id, progress, "analyze",
                f"精读分析中... ({i + 1}/{total})",
            )

        # 按原始顺序排列
        chapter_results.sort(
            key=lambda x: next(
                (c["index"] for c in chapter_blocks if c["chapter_name"] == x.get("chapter_name")),
                len(chapter_results),
            )
        )

        # ---- 阶段 5：组装最终报告 ----
        set_progress(task_id, 85, "done", "正在组装报告...")
        try: stats_module.record_phase_time(task_id, "analyze")
        except Exception: pass

        final_report = {
            "book_title": book_title,
            "chapters": chapter_results,
        }

        tasks[task_id]["report"] = final_report
        tasks[task_id]["status"] = "completed"
        tasks[task_id]["progress"] = 100
        tasks[task_id]["step"] = "done"
        tasks[task_id]["detail"] = "报告生成完成"
        stats_module.record_task_done(ip, ua, task_id, True, len(final_report.get("chapters", [])))

    except Exception as e:
        import traceback
        print(f"[ERROR] Task {task_id} failed: {e}")
        traceback.print_exc()
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error"] = str(e)
        tasks[task_id]["step"] = "error"
        tasks[task_id]["detail"] = f"处理失败：{e}"
        stats_module.record_task_done(ip, ua, task_id, False, error=str(e))


# ==================== API 路由 ====================

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), request: Request = None):
    """上传书籍文件，返回任务 ID"""
    # 1. 检查文件扩展名
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式：{ext}。支持：{', '.join(ALLOWED_EXTENSIONS)}",
        )

    task_id = uuid.uuid4().hex[:12]
    safe_filename = f"{task_id}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"文件过大（{size_mb:.1f}MB），最大允许 {MAX_FILE_SIZE_MB}MB",
        )

    with open(file_path, "wb") as f:
        f.write(content)

    ip, ua = get_client_info(request)
    tasks[task_id] = {
        "status": "uploaded", "progress": 0, "step": "upload",
        "detail": "文件已上传", "filename": file.filename,
        "file_path": file_path, "report": None, "ip": ip, "ua": ua,
    }

    try:
        stats_module.record_upload(ip, ua, file.filename)
    except Exception as e:
        print(f"[STATS] upload record failed: {e}")

    asyncio.create_task(process_book(task_id, file_path, file.filename))
    return {"task_id": task_id, "filename": file.filename, "size_mb": round(size_mb, 2), "status": "uploaded"}


@app.get("/api/progress/{task_id}")
async def get_progress(task_id: str):
    """SSE 实时进度推送"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")

    async def event_generator():
        last_progress = -1
        while True:
            task = tasks.get(task_id)
            if not task:
                break

            current = task["progress"]
            # 进度变化时才推送
            if current != last_progress:
                last_progress = current
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "progress": task["progress"],
                        "step": task["step"],
                        "detail": task["detail"],
                        "status": task["status"],
                    }, ensure_ascii=False),
                }

            # 完成或失败时发送最终事件并结束
            if task["status"] in ("completed", "failed"):
                yield {
                    "event": task["status"],
                    "data": json.dumps({
                        "progress": task["progress"],
                        "step": task["step"],
                        "detail": task["detail"],
                        "status": task["status"],
                        "error": task.get("error"),
                    }, ensure_ascii=False),
                }
                break

            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


@app.get("/api/report/{task_id}")
async def get_report(task_id: str):
    """获取生成的报告 JSON"""
    task = tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task["status"] != "completed":
        err_msg = f"报告尚未生成完成，当前状态：{task['status']}"
        if task.get("error"):
            err_msg += f"，原因：{task['error']}"
        raise HTTPException(status_code=400, detail=err_msg)
    return {
        "task_id": task_id,
        "filename": task["filename"],
        "text_stats": task.get("text_stats"),
        "report": task["report"],
    }


@app.get("/api/export/{task_id}")
async def export_report(task_id: str, request: Request = None):
    """导出 Word 文档"""
    task = tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task["status"] != "completed" or not task.get("report"):
        raise HTTPException(
            status_code=400,
            detail="报告尚未生成完成，无法导出",
        )

    try:
        export_dir = os.path.join(UPLOAD_DIR, "exports")
        os.makedirs(export_dir, exist_ok=True)

        docx_path = generate_docx(task["report"], export_dir)
        tasks[task_id]["export_path"] = docx_path
        ip, ua = get_client_info(request)
        stats_module.record_export(ip, ua)

        filename = os.path.basename(docx_path)
        return FileResponse(
            path=docx_path,
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败：{e}")


@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "tasks_count": len(tasks)}


@app.post("/api/debug/test-stats")
async def debug_test_stats():
    """测试 stats 是否正常"""
    import traceback
    try:
        import stats as sm
        sm.record_visit("1.2.3.4", "test-ua")
        sm.record_upload("1.2.3.4", "test-ua", "test.pdf")
        sm.record_task_start("1.2.3.4", "test-ua", "debug123", "test.pdf", 5000)
        sm.record_task_done("1.2.3.4", "test-ua", "debug123", True, chapters=3)
        d = sm._load()
        return {"ok": True, "uploads": d["total_uploads"], "users": len(d["users"])}
    except Exception as e:
        return {"ok": False, "error": str(e), "traceback": traceback.format_exc()}


# ===== 管理后台 API =====

@app.get("/api/admin/stats")
async def get_admin_stats(password: str = Query("")):
    """获取统计数据（需密码）"""
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="密码错误")
    try:
        return stats_module.get_stats()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Stats error: {e}")


@app.post("/api/admin/reset")
async def reset_stats(password: str = Query(...)):
    """重置统计数据（需密码）"""
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="密码错误")
    try:
        stats_module.reset_all()
        return {"ok": True, "message": "数据已重置"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"重置失败: {e}")


@app.get("/api/admin/recent")
async def get_recent_tasks(password: str = Query(...)):
    """获取最近任务列表（需密码）"""
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="密码错误")
    data = stats_module._load()
    return data.get("recent_tasks", [])[:30]


@app.get("/api/admin/user/{fingerprint}")
async def get_user_detail(fingerprint: str, password: str = Query(...)):
    """获取单个用户的详细数据（需密码）"""
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="密码错误")
    detail = stats_module.get_user_detail(fingerprint)
    if not detail:
        raise HTTPException(status_code=404, detail="用户不存在")
    return detail


@app.get("/api/admin/export")
async def export_stats(password: str = Query(...), format: str = Query("json")):
    """导出统计数据（JSON 或 CSV），需管理密码"""
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="密码错误")
    data = stats_module.get_stats()

    if format == "csv":
        import csv

        output = io.StringIO()
        writer = csv.writer(output)

        # 概览
        o = data["overview"]
        writer.writerow(["=== 概览汇总 ==="])
        writer.writerow(["指标", "数值"])
        writer.writerow(["页面访问", o["total_visits"]])
        writer.writerow(["上传次数", o["total_uploads"]])
        writer.writerow(["完成分析", o["completed"]])
        writer.writerow(["失败次数", o["failed"]])
        writer.writerow(["成功率(%)", o["success_rate"]])
        writer.writerow(["导出下载", o["total_exports"]])
        writer.writerow(["导出率(%)", o["export_rate"]])
        writer.writerow(["独立访客", o["unique_users"]])
        writer.writerow(["处理字数", o["total_chars"]])
        writer.writerow(["累计Token", o["total_tokens"]])
        writer.writerow(["估算费用(¥)", o["cost_est"]])
        writer.writerow(["累计耗时(h)", o["total_time_hours"]])
        writer.writerow(["OCR页数", o["ocr_pages"]])
        writer.writerow(["平均耗时(s)", o["avg_duration_seconds"]])
        writer.writerow([])

        # 每日明细
        writer.writerow(["=== 每日明细 ==="])
        writer.writerow(["日期", "访问", "上传", "完成", "Token", "导出", "失败"])
        for d in data.get("daily_trend", []):
            writer.writerow([d["date"], d["visits"], d["uploads"], d["completed"],
                           d["tokens"], d["exports"], d["fails"]])
        writer.writerow([])

        # 分布
        writer.writerow(["=== 文件类型分布 ==="])
        for k, v in data.get("file_types", {}).items():
            writer.writerow([k.upper(), v])
        writer.writerow([])
        writer.writerow(["=== 书籍规模分布 ==="])
        for k, v in data.get("size_distribution", {}).items():
            writer.writerow([k, v])
        writer.writerow([])
        writer.writerow(["=== 设备分布 ==="])
        for k, v in data.get("devices", {}).items():
            writer.writerow([k, v])
        writer.writerow([])
        writer.writerow(["=== 失败原因 ==="])
        for k, v in data.get("failure_reasons", {}).items():
            writer.writerow([k, v])
        writer.writerow([])

        # 阶段耗时
        writer.writerow(["=== 各阶段平均耗时(s) ==="])
        for k, v in data.get("phase_avgs", {}).items():
            writer.writerow([k, v])
        writer.writerow([])

        # 任务列表
        writer.writerow(["=== 最近任务 ==="])
        writer.writerow(["文件名", "字数", "Token估算", "耗时(s)", "章节数", "状态", "错误"])
        for t in data.get("recent_tasks", []):
            writer.writerow([t.get("filename", ""), t.get("chars", 0),
                           t.get("tokens_est", 0), t.get("duration_seconds", ""),
                           t.get("chapters", 0), t.get("status", ""),
                           t.get("error", "")])

        csv_content = output.getvalue()
        # BOM for Excel 中文兼容
        csv_bytes = ("﻿" + csv_content).encode("utf-8")
        return StreamingResponse(
            io.BytesIO(csv_bytes),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=zesoo_stats.csv"},
        )

    # JSON 格式
    json_str = json.dumps(data, ensure_ascii=False, indent=2)
    return StreamingResponse(
        io.BytesIO(json_str.encode("utf-8")),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=zesoo_stats.json"},
    )


@app.get("/api/debug/test-pipeline")
async def debug_test_pipeline():
    """调试：测试新流程（章节检测 + 逐章分析）"""
    import traceback
    debug_log = []

    try:
        test_text = (
            "第一章 时间管理基础\n\n"
            "时间管理是每个人都需要掌握的核心技能。本章讨论了时间的重要性和如何设定优先级。"
            "首先需要明确什么是重要的事，什么是紧急的事。艾森豪威尔矩阵是一个经典工具。\n\n"
            "第二章 番茄工作法实战\n\n"
            "番茄工作法由弗朗西斯科·西里洛创立。核心是25分钟专注工作加5分钟休息的循环。"
            "本章深入讲解了番茄工作法的原理和实践方法，包括如何处理中断、如何记录和复盘。\n\n"
            "第三章 克服拖延症\n\n"
            "拖延症是效率的大敌。本章分析了拖延的心理根源，包括完美主义、任务恐惧和缺乏明确目标。"
            "给出了分解任务、设定截止日期、五分钟起步法等实用对策。"
        )
        debug_log.append(f"Test text: {len(test_text)} chars")

        async with httpx.AsyncClient() as client:
            # Step 1: Detect chapters
            detection = await detect_chapters(client, test_text)
            book_title = detection.get("book_title", "未知")
            raw_chapters = detection.get("chapters", [])
            debug_log.append(f"Detected: {book_title}, {len(raw_chapters)} chapters")
            for ch in raw_chapters:
                debug_log.append(f"  - {ch['chapter_name']}")

            # Step 2: Split text
            chapter_blocks = split_text_by_chapters(test_text, raw_chapters)
            debug_log.append(f"Split into {len(chapter_blocks)} blocks")

            # Step 3: Analyze each chapter
            chapter_results = []
            for block in chapter_blocks:
                try:
                    result = await analyze_chapter(
                        client, block["chapter_name"], block["text"],
                        block["index"], len(chapter_blocks)
                    )
                    debug_log.append(
                        f"Chapter '{block['chapter_name']}': "
                        f"ideas={len(result.get('core_ideas',[]))}, "
                        f"quotes={len(result.get('quotes',[]))}, "
                        f"methods={len(result.get('methodology',[]))}, "
                        f"insights={len(result.get('actionable_insights',[]))}"
                    )
                    chapter_results.append(result)
                except Exception as e:
                    debug_log.append(f"Chapter '{block['chapter_name']}' ERROR: {e}")
                    chapter_results.append({"_error": str(e), "chapter_name": block["chapter_name"]})

            final = {
                "book_title": book_title,
                "chapters": chapter_results,
            }
            return {"success": True, "debug": debug_log, "report": final}

    except Exception as e:
        return {"success": False, "debug": debug_log, "error": str(e), "traceback": traceback.format_exc()}


# ===== 前端静态文件 & SPA（必须在所有 API 路由之后） =====
if os.path.exists(STATIC_DIR):
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        filepath = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(filepath):
            return FileResponse(filepath)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))


# ==================== 启动入口 ====================

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
