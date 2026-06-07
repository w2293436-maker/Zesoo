"""数据统计模块 — 全局 + 按用户独立追踪"""

import hashlib
import json
import os
import time
from datetime import datetime, timezone, timedelta

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
        "total_visits": 0, "total_uploads": 0, "completed_analyses": 0,
        "failed_analyses": 0, "total_exports": 0, "total_chars_processed": 0,
        "total_tokens_used": 0, "total_processing_time_seconds": 0, "total_ocr_pages": 0,
        "size_distribution": {"small": 0, "medium": 0, "large": 0},
        "file_types": {"pdf": 0, "txt": 0, "docx": 0},
        "failure_reasons": {}, "phase_time": {"parse": 0, "detect": 0, "analyze": 0, "export": 0},
        "devices": {"pc": 0, "mobile": 0, "tablet": 0},
        "daily": {},
        "recent_tasks": [],
        "users": {},  # {fingerprint: UserData}
    }


def _today(data: dict) -> dict:
    key = datetime.now(tz).strftime("%Y-%m-%d")
    if key not in data["daily"]:
        data["daily"][key] = {"visits": 0, "uploads": 0, "completed": 0,
                              "tokens": 0, "exports": 0, "fails": 0}
    return data["daily"][key]


def _fingerprint(ip: str, ua: str) -> str:
    raw = f"{ip}|{ua[:100] if ua else ''}"
    return hashlib.sha256(raw.encode()).hexdigest()[:12]


def _get_or_create_user(data: dict, fp: str, ip: str, ua: str) -> dict:
    if fp not in data["users"]:
        ua_lower = ua.lower()
        if "mobile" in ua_lower or "android" in ua_lower or "iphone" in ua_lower:
            dev = "mobile"
        elif "tablet" in ua_lower or "ipad" in ua_lower:
            dev = "tablet"
        else:
            dev = "pc"

        data["users"][fp] = {
            "fingerprint": fp,
            "first_seen": time.time(),
            "last_seen": time.time(),
            "visits": 0, "uploads": 0, "completed": 0, "failed": 0, "exports": 0,
            "tokens_used": 0, "chars_processed": 0, "total_time_seconds": 0,
            "device": dev, "ip_masked": _mask_ip(ip),
            "file_types": {"pdf": 0, "txt": 0, "docx": 0},
            "size_distribution": {"small": 0, "medium": 0, "large": 0},
            "failure_reasons": {},
            "phase_times": {"parse": 0, "detect": 0, "analyze": 0},
            "tasks": [],
        }
        # 只保留最近 200 个用户
        if len(data["users"]) > 200:
            oldest = sorted(data["users"].values(), key=lambda x: x["last_seen"])[0]
            del data["users"][oldest["fingerprint"]]
    return data["users"][fp]


def _mask_ip(ip: str) -> str:
    if not ip or ip == "unknown":
        return "***"
    parts = ip.split(".")
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.*.*"
    return ip[:len(ip) // 2] + "***"


# ===== 公开 API =====

def record_visit(ip: str, ua: str):
    data = _load()
    fp = _fingerprint(ip, ua)
    user = _get_or_create_user(data, fp, ip, ua)

    data["total_visits"] += 1
    user["visits"] += 1
    user["last_seen"] = time.time()
    data["devices"][user["device"]] += 1
    _today(data)["visits"] += 1

    _save(data)


def record_upload(ip: str, ua: str, filename: str):
    data = _load()
    fp = _fingerprint(ip, ua)
    user = _get_or_create_user(data, fp, ip, ua)

    data["total_uploads"] += 1
    user["uploads"] += 1
    user["last_seen"] = time.time()
    _today(data)["uploads"] += 1

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "unknown"
    if ext in data["file_types"]:
        data["file_types"][ext] += 1
    if ext in user["file_types"]:
        user["file_types"][ext] += 1

    _save(data)


def record_task_start(ip: str, ua: str, task_id: str, filename: str, chars: int):
    data = _load()
    fp = _fingerprint(ip, ua)
    user = _get_or_create_user(data, fp, ip, ua)
    user["last_seen"] = time.time()

    if chars < 10000:
        size_cat = "small"
    elif chars < 100000:
        size_cat = "medium"
    else:
        size_cat = "large"
    data["size_distribution"][size_cat] += 1
    user["size_distribution"][size_cat] += 1

    entry = {
        "task_id": task_id, "filename": filename, "chars": chars,
        "tokens_est": int(chars / 2.5), "start_time": time.time(),
        "finish_time": None, "duration_seconds": None,
        "status": "processing", "chapters": 0, "error": None, "phase_times": {},
    }
    data["recent_tasks"].insert(0, entry)
    data["recent_tasks"] = data["recent_tasks"][:50]

    # 用户维度也保存
    user["tasks"].insert(0, entry)
    user["tasks"] = user["tasks"][:20]

    _save(data)


def record_phase_time(task_id: str, phase: str):
    data = _load()
    for entry in data["recent_tasks"]:
        if entry["task_id"] == task_id:
            entry["phase_times"][phase] = round(time.time() - entry["start_time"], 1)
            _save(data)
            return


def record_task_done(ip: str, ua: str, task_id: str, success: bool,
                     chapters: int = 0, error: str = None):
    data = _load()
    fp = _fingerprint(ip, ua)
    user = _get_or_create_user(data, fp, ip, ua)

    # 全局记录
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
                user["completed"] += 1
                user["tokens_used"] += entry["tokens_est"]
                user["chars_processed"] += entry["chars"]
                user["total_time_seconds"] += entry["duration_seconds"]
                # 用户阶段耗时累计
                for ph in ["parse", "detect", "analyze"]:
                    if ph in entry.get("phase_times", {}):
                        user["phase_times"][ph] += entry["phase_times"][ph]
            else:
                data["failed_analyses"] += 1
                _today(data)["fails"] += 1
                user["failed"] += 1
                reason = _classify_error(error or "未知错误")
                data["failure_reasons"][reason] = data["failure_reasons"].get(reason, 0) + 1
                user["failure_reasons"][reason] = user["failure_reasons"].get(reason, 0) + 1
            break

    # 用户维度同步
    for e in user["tasks"]:
        if e["task_id"] == task_id:
            e["status"] = "completed" if success else "failed"
            e["chapters"] = chapters
            e["error"] = error
            if entry.get("duration_seconds"):
                e["duration_seconds"] = entry["duration_seconds"]
            break

    _save(data)


def record_export(ip: str, ua: str):
    data = _load()
    fp = _fingerprint(ip, ua)
    user = _get_or_create_user(data, fp, ip, ua)

    data["total_exports"] += 1
    user["exports"] += 1
    user["last_seen"] = time.time()
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


# ===== 查询 API =====

def get_stats() -> dict:
    data = _load()
    completed = [t for t in data["recent_tasks"] if t["status"] == "completed"]
    avg_dur = round(sum(t["duration_seconds"] for t in completed) / max(len(completed), 1), 1)

    phase_avgs = {}
    for phase in ["parse", "detect", "analyze", "export"]:
        times = [t["phase_times"].get(phase, 0) for t in completed
                 if phase in t.get("phase_times", {})]
        phase_avgs[phase] = round(sum(times) / max(len(times), 1), 1)

    today_dt = datetime.now(tz).date()
    daily_trend = []
    for i in range(6, -1, -1):
        day = (today_dt - timedelta(days=i)).strftime("%Y-%m-%d")
        d = data["daily"].get(day, {})
        daily_trend.append({
            "date": day[-5:],
            "visits": d.get("visits", 0),
            "uploads": d.get("uploads", 0),
            "completed": d.get("completed", 0),
            "tokens": d.get("tokens", 0),
            "exports": d.get("exports", 0),
            "fails": d.get("fails", 0),
        })

    cost_est = round(data["total_tokens_used"] / 1000000 * 1.5, 2)

    # 用户列表（按最近活跃排序）
    user_list = sorted(data["users"].values(),
                       key=lambda x: x["last_seen"], reverse=True)[:50]
    users_summary = [{
        "fingerprint": u["fingerprint"],
        "first_seen": u["first_seen"],
        "last_seen": u["last_seen"],
        "visits": u["visits"],
        "uploads": u["uploads"],
        "completed": u["completed"],
        "failed": u["failed"],
        "exports": u["exports"],
        "tokens_used": u["tokens_used"],
        "device": u["device"],
        "ip_masked": u["ip_masked"],
    } for u in user_list]

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
            "unique_users": len(data["users"]),
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
        "phase_avgs": phase_avgs,
        "recent_tasks": data["recent_tasks"][:20],
        "users": users_summary,
    }


def get_user_detail(fingerprint: str) -> dict | None:
    data = _load()
    user = data["users"].get(fingerprint)
    if not user:
        return None
    return {
        "fingerprint": user["fingerprint"],
        "first_seen": user["first_seen"],
        "last_seen": user["last_seen"],
        "visits": user["visits"], "uploads": user["uploads"],
        "completed": user["completed"], "failed": user["failed"],
        "exports": user["exports"], "tokens_used": user["tokens_used"],
        "chars_processed": user["chars_processed"],
        "total_time_seconds": user["total_time_seconds"],
        "device": user["device"], "ip_masked": user["ip_masked"],
        "file_types": user.get("file_types", {}),
        "size_distribution": user.get("size_distribution", {}),
        "failure_reasons": user.get("failure_reasons", {}),
        "phase_times": user.get("phase_times", {}),
        "tasks": user.get("tasks", [])[:20],
    }
