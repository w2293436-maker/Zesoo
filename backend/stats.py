"""数据统计模块 — 持久化存储 JSON 文件"""

import json
import os
import time
from datetime import datetime, timezone, timedelta

STATS_FILE = os.path.join(os.path.dirname(__file__), "stats.json")
tz = timezone(timedelta(hours=8))  # 北京时间


def _load() -> dict:
    if not os.path.exists(STATS_FILE):
        return _default()
    with open(STATS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(data: dict):
    with open(STATS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _default() -> dict:
    return {
        "total_visits": 0,
        "total_uploads": 0,
        "completed_analyses": 0,
        "failed_analyses": 0,
        "total_chars_processed": 0,
        "total_tokens_used": 0,
        "total_processing_time_seconds": 0,
        "file_types": {"pdf": 0, "txt": 0, "docx": 0},
        "total_pages_ocr": 0,
        "daily_stats": {},
        "recent_tasks": [],
    }


# ===== 公开 API =====

def record_visit():
    """记录一次页面访问"""
    data = _load()
    data["total_visits"] += 1
    _today(data)["visits"] = _today(data).get("visits", 0) + 1
    _save(data)


def record_upload(filename: str):
    """记录上传"""
    data = _load()
    data["total_uploads"] += 1
    _today(data)["uploads"] = _today(data).get("uploads", 0) + 1

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "unknown"
    if ext in data["file_types"]:
        data["file_types"][ext] += 1
    _save(data)


def record_task_start(task_id: str, filename: str, chars: int):
    """记录任务开始"""
    data = _load()
    entry = {
        "task_id": task_id,
        "filename": filename,
        "chars": chars,
        "tokens_est": int(chars / 2.5),
        "start_time": time.time(),
        "finish_time": None,
        "duration_seconds": None,
        "status": "processing",
        "chapters": 0,
        "error": None,
    }
    data["recent_tasks"].insert(0, entry)
    # 只保留最近 50 条
    data["recent_tasks"] = data["recent_tasks"][:50]
    _save(data)


def record_task_done(task_id: str, success: bool, chapters: int = 0, error: str = None):
    """记录任务完成"""
    data = _load()
    for entry in data["recent_tasks"]:
        if entry["task_id"] == task_id:
            entry["finish_time"] = time.time()
            entry["duration_seconds"] = round(entry["finish_time"] - entry["start_time"], 1)
            entry["status"] = "completed" if success else "failed"
            entry["chapters"] = chapters
            entry["error"] = error

            if success:
                data["completed_analyses"] += 1
                data["total_chars_processed"] += entry["chars"]
                data["total_tokens_used"] += entry["tokens_est"]
                data["total_processing_time_seconds"] += entry["duration_seconds"]
                _today(data)["tokens"] = _today(data).get("tokens", 0) + entry["tokens_est"]
            else:
                data["failed_analyses"] += 1
            _save(data)
            return


def record_ocr_pages(pages: int):
    """记录 OCR 识别页数"""
    data = _load()
    data["total_pages_ocr"] += pages
    _save(data)


def get_stats() -> dict:
    """获取完整统计数据"""
    data = _load()

    # 计算平均耗时
    completed = [t for t in data["recent_tasks"] if t["status"] == "completed"]
    avg_duration = (
        round(sum(t["duration_seconds"] for t in completed) / len(completed), 1)
        if completed else 0
    )

    # 今日统计
    today_str = datetime.now(tz).strftime("%Y-%m-%d")
    today = data["daily_stats"].get(today_str, {})

    return {
        "overview": {
            "total_visits": data["total_visits"],
            "total_uploads": data["total_uploads"],
            "completed": data["completed_analyses"],
            "failed": data["failed_analyses"],
            "success_rate": round(
                data["completed_analyses"] / max(data["total_uploads"], 1) * 100, 1
            ),
            "total_chars": data["total_chars_processed"],
            "total_tokens": data["total_tokens_used"],
            "total_time_hours": round(data["total_processing_time_seconds"] / 3600, 2),
            "avg_duration_seconds": avg_duration,
            "ocr_pages": data["total_pages_ocr"],
        },
        "today": {
            "visits": today.get("visits", 0),
            "uploads": today.get("uploads", 0),
            "tokens": today.get("tokens", 0),
        },
        "file_types": data["file_types"],
        "recent_tasks": data["recent_tasks"][:20],
    }


def _today(data: dict) -> dict:
    today_str = datetime.now(tz).strftime("%Y-%m-%d")
    if today_str not in data["daily_stats"]:
        data["daily_stats"][today_str] = {}
    return data["daily_stats"][today_str]
