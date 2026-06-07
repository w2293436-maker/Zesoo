"""数据统计模块 — 持久化 JSON，追踪 7 大维度"""

import json
import os
import time
from datetime import datetime, timezone, timedelta

# Railway Volume 持久化目录，不存在则回退到本地
DATA_DIR = "/data" if os.path.exists("/data") else os.path.dirname(__file__)
STATS_FILE = os.path.join(DATA_DIR, "stats.json")
tz = timezone(timedelta(hours=8))


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
        # 基础
        "total_visits": 0,
        "total_uploads": 0,
        "completed_analyses": 0,
        "failed_analyses": 0,
        "total_exports": 0,
        "total_chars_processed": 0,
        "total_tokens_used": 0,
        "total_processing_time_seconds": 0,
        "total_ocr_pages": 0,
        # 书籍规模
        "size_distribution": {"small": 0, "medium": 0, "large": 0},
        # 文件类型
        "file_types": {"pdf": 0, "txt": 0, "docx": 0},
        # 失败原因
        "failure_reasons": {},
        # 各阶段耗时累计
        "phase_time": {"parse": 0, "detect": 0, "analyze": 0, "export": 0},
        # 设备
        "devices": {"pc": 0, "mobile": 0, "tablet": 0},
        # 每日
        "daily": {},
        # 最近任务
        "recent_tasks": [],
    }


def _today(data: dict) -> dict:
    key = datetime.now(tz).strftime("%Y-%m-%d")
    if key not in data["daily"]:
        data["daily"][key] = {
            "visits": 0, "uploads": 0, "completed": 0,
            "tokens": 0, "exports": 0, "fails": 0,
        }
    return data["daily"][key]


# ===== 公开 API =====

def record_visit(ua: str = ""):
    data = _load()
    data["total_visits"] += 1
    _today(data)["visits"] += 1

    ua_lower = ua.lower()
    if "mobile" in ua_lower or "android" in ua_lower or "iphone" in ua_lower:
        data["devices"]["mobile"] += 1
    elif "tablet" in ua_lower or "ipad" in ua_lower:
        data["devices"]["tablet"] += 1
    else:
        data["devices"]["pc"] += 1

    _save(data)


def record_upload(filename: str):
    data = _load()
    data["total_uploads"] += 1
    _today(data)["uploads"] += 1
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "unknown"
    if ext in data["file_types"]:
        data["file_types"][ext] += 1
    _save(data)


def record_task_start(task_id: str, filename: str, chars: int):
    data = _load()
    # 书籍规模
    if chars < 10000:
        data["size_distribution"]["small"] += 1
    elif chars < 100000:
        data["size_distribution"]["medium"] += 1
    else:
        data["size_distribution"]["large"] += 1

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
        "phase_times": {},
    }
    data["recent_tasks"].insert(0, entry)
    data["recent_tasks"] = data["recent_tasks"][:50]
    _save(data)


def record_phase_time(task_id: str, phase: str):
    """记录某个阶段的耗时点（用当前时间减去任务开始时间）"""
    data = _load()
    for entry in data["recent_tasks"]:
        if entry["task_id"] == task_id:
            elapsed = time.time() - entry["start_time"]
            entry["phase_times"][phase] = round(elapsed, 1)
            _save(data)
            return


def record_task_done(task_id: str, success: bool, chapters: int = 0, error: str = None):
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
                _today(data)["completed"] += 1
                _today(data)["tokens"] += entry["tokens_est"]
            else:
                data["failed_analyses"] += 1
                _today(data)["fails"] += 1
                # 归类失败原因
                reason = _classify_error(error or "未知错误")
                data["failure_reasons"][reason] = data["failure_reasons"].get(reason, 0) + 1

            _save(data)
            return


def record_export():
    data = _load()
    data["total_exports"] += 1
    _today(data)["exports"] += 1
    _save(data)


def record_ocr_pages(pages: int):
    data = _load()
    data["total_ocr_pages"] += pages
    _save(data)


def _classify_error(error: str) -> str:
    err = error.lower()
    if "ocr" in err or "扫描" in err or "图片" in err:
        return "OCR识别失败"
    if "timeout" in err or "超时" in err or "timed" in err:
        return "超时"
    if "401" in err or "403" in err or "api key" in err or "auth" in err:
        return "API Key错误"
    if "无法提取" in err or "空" in err or "empty" in err:
        return "文件解析失败"
    if "chunk" in err or "分段" in err or "章节" in err:
        return "章节切分失败"
    return "其他错误"


def get_stats() -> dict:
    data = _load()
    completed = [t for t in data["recent_tasks"] if t["status"] == "completed"]
    avg_dur = round(sum(t["duration_seconds"] for t in completed) / max(len(completed), 1), 1)

    # 计算各阶段平均耗时
    phase_avgs = {}
    for phase in ["parse", "detect", "analyze", "export"]:
        times = [t["phase_times"].get(phase, 0) for t in completed if phase in t.get("phase_times", {})]
        phase_avgs[phase] = round(sum(times) / max(len(times), 1), 1)

    # 每日趋势（最近7天）
    today = datetime.now(tz).date()
    daily_trend = []
    for i in range(6, -1, -1):
        day = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        d = data["daily"].get(day, {})
        daily_trend.append({
            "date": day[-5:],  # MM-DD
            "visits": d.get("visits", 0),
            "uploads": d.get("uploads", 0),
            "completed": d.get("completed", 0),
            "tokens": d.get("tokens", 0),
            "exports": d.get("exports", 0),
            "fails": d.get("fails", 0),
        })

    # Token 费用估算（DeepSeek: 输入 ¥1/百万token, 输出 ¥2/百万token，取均值 ¥1.5）
    cost_est = round(data["total_tokens_used"] / 1000000 * 1.5, 2)

    return {
        "overview": {
            "total_visits": data["total_visits"],
            "total_uploads": data["total_uploads"],
            "completed": data["completed_analyses"],
            "failed": data["failed_analyses"],
            "success_rate": round(data["completed_analyses"] / max(data["total_uploads"], 1) * 100, 1),
            "total_exports": data["total_exports"],
            "export_rate": round(data["total_exports"] / max(data["completed_analyses"], 1) * 100, 1),
            "total_chars": data["total_chars_processed"],
            "total_tokens": data["total_tokens_used"],
            "total_time_hours": round(data["total_processing_time_seconds"] / 3600, 2),
            "avg_duration_seconds": avg_dur,
            "ocr_pages": data["total_ocr_pages"],
            "cost_est": cost_est,
        },
        "today": {
            "visits": _today(data).get("visits", 0),
            "uploads": _today(data).get("uploads", 0),
            "completed": _today(data).get("completed", 0),
            "tokens": _today(data).get("tokens", 0),
            "exports": _today(data).get("exports", 0),
            "fails": _today(data).get("fails", 0),
        },
        "daily_trend": daily_trend,
        "size_distribution": data["size_distribution"],
        "file_types": data["file_types"],
        "devices": data["devices"],
        "failure_reasons": data["failure_reasons"],
        "phase_time": data["phase_time"],
        "phase_avgs": phase_avgs,
        "recent_tasks": data["recent_tasks"][:20],
    }
