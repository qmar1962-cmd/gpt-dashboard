#!/usr/bin/env python3
"""
企业微信 Webhook 机器人推送脚本
读取 public/database/json/ 下最新日期的 JSON 数据，生成摘要推送至群聊

用法：
  python wechat_push.py                    # 推送最新日期数据
  python wechat_push.py --date 2026-06-01  # 推送指定日期
  python wechat_push.py --dry-run          # 只打印消息，不推送
"""

import json
import os
import sys
import re
from pathlib import Path
from datetime import datetime
from collections import defaultdict
import urllib.request
import urllib.error

# ── 配置 ─────────────────────────────────────────────

WEBHOOK_URL = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=75f66b59-9713-4919-b4ea-561f474a784c"

# 项目根目录（脚本在 data-pipeline/ 下）
ROOT_DIR = Path(__file__).parent.parent
JSON_DIR = ROOT_DIR / "public" / "database" / "json"

# 维度 1：岗位效能目标偏离 ≥ 10% 视为异常
JOB_DEVIATION_THRESHOLD = 10.0
# 维度 3-4：出勤天数阈值
ATT15_DAYS = 15
ATT7_DAYS = 7
# 维度 5-6：日工时阈值
WH_HIGH_HOURS = 12.5
WH_LOW_HOURS = 8.0

# ── 工具函数 ─────────────────────────────────────────

def load_json(filename: str) -> list:
    """加载 JSON 文件，返回列表"""
    filepath = JSON_DIR / filename
    if not filepath.exists():
        return []
    with open(filepath, encoding="utf-8") as f:
        return json.load(f)


def get_latest_date() -> str:
    """扫描 JSON_DIR 找到数据中最新的日期（取 job_performance 文件）"""
    dates = []
    for f in JSON_DIR.glob("job_performance_*.json"):
        # 跳过 base 和 v2 等特殊文件
        m = re.match(r"job_performance_(\d{4})\.json$", f.name)
        if m:
            dates.append(f"20{m.group(1)[:2]}-{m.group(1)[2:4]}-{m.group(1)[4:6]}")
    dates.sort(reverse=True)
    return dates[0] if dates else datetime.now().strftime("%Y-%m-%d")


def date_to_filename_prefix(date_str: str) -> str:
    """2026-06-01 -> 0601"""
    d = datetime.strptime(date_str, "%Y-%m-%d")
    return d.strftime("%m%d")


def safe_float(val, default=0.0) -> float:
    try:
        return float(val) if val not in (None, "") else default
    except (ValueError, TypeError):
        return default


def safe_int(val, default=0) -> int:
    try:
        return int(float(val)) if val not in (None, "") else default
    except (ValueError, TypeError):
        return default


def to_markdown(text: str) -> str:
    """发送 markdown 消息到 webhook"""
    payload = json.dumps({"msgtype": "markdown", "markdown": {"content": text}}, ensure_ascii=False)
    req = urllib.request.Request(
        WEBHOOK_URL,
        data=payload.encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result
    except urllib.error.URLError as e:
        print(f"[推送失败] {e}")
        return None


# ── 核心计算 ─────────────────────────────────────────

def analyze(date_str: str) -> dict:
    """分析指定日期的数据，返回各中心指标"""
    prefix = date_to_filename_prefix(date_str)

    # 加载数据
    job_data = load_json(f"job_performance_{prefix}.json")
    salary_data = load_json(f"salary_performance_{prefix}.json")
    att15_data = load_json(f"attendance15_{prefix}.json")
    att7_data = load_json(f"attendance7_{prefix}.json")
    wh_high_data = load_json(f"work_hours_high_{prefix}.json")
    wh_low_data = load_json(f"work_hours_low_{prefix}.json")

    # 收集所有中心名
    all_centers = set()
    for row in job_data:
        all_centers.add(row.get("中心", ""))
    for row in att15_data:
        all_centers.add(row.get("中心", ""))
    all_centers.discard("")

    # 按中心统计
    centers = {}
    for center in sorted(all_centers):
        # 效能异常：目标偏离 >= 10%
        job_rows = [r for r in job_data if r.get("中心") == center]
        job_abnormal = [r for r in job_rows if safe_float(r.get("目标偏离（%）", 0)) >= JOB_DEVIATION_THRESHOLD]

        # 绩效异常
        sal_rows = [r for r in salary_data if r.get("中心") == center]

        # 连续出勤 ≥ 15 天
        att15_rows = [r for r in att15_data if r.get("中心") == center and safe_int(r.get("连续出勤天数", 0)) >= ATT15_DAYS]

        # 连续未出勤 ≥ 7 天
        att7_rows = [r for r in att7_data if r.get("中心") == center and safe_int(r.get("连续未出勤天数", 0)) >= ATT7_DAYS]

        # 日工时高
        wh_high_rows = [r for r in wh_high_data if r.get("中心") == center]

        # 日工时低
        wh_low_rows = [r for r in wh_low_data if r.get("中心") == center]

        centers[center] = {
            "job_total": len(job_rows),
            "job_abnormal": len(job_abnormal),
            "job_details": [f"{r.get('岗位','?')}(+{safe_float(r.get('目标偏离（%）',0)):.0f}%)" for r in job_abnormal[:3]],
            "salary_count": len(sal_rows),
            "att15_count": len(att15_rows),
            "att7_count": len(att7_rows),
            "wh_high_count": len(wh_high_rows),
            "wh_low_count": len(wh_low_rows),
        }

    # 省区汇总（从数据中提取）
    province_centers = defaultdict(list)
    for row in job_data:
        prov = row.get("省区", "")
        center = row.get("中心", "")
        if prov and center and center not in province_centers[prov]:
            province_centers[prov].append(center)

    # 总计
    totals = {
        "centers": len(centers),
        "job_abnormal": sum(c["job_abnormal"] for c in centers.values()),
        "salary_count": sum(c["salary_count"] for c in centers.values()),
        "att15_count": sum(c["att15_count"] for c in centers.values()),
        "att7_count": sum(c["att7_count"] for c in centers.values()),
        "wh_high_count": sum(c["wh_high_count"] for c in centers.values()),
        "wh_low_count": sum(c["wh_low_count"] for c in centers.values()),
    }

    return {
        "date": date_str,
        "totals": totals,
        "centers": centers,
        "provinces": dict(province_centers),
        "file_counts": {
            "job": len(job_data),
            "salary": len(salary_data),
            "att15": len(att15_data),
            "att7": len(att7_data),
            "wh_high": len(wh_high_data),
            "wh_low": len(wh_low_data),
        },
    }


# ── 格式化 ──────────────────────────────────────────

def format_report(analysis: dict) -> str:
    """将分析结果格式化为 markdown 消息"""
    t = analysis["totals"]
    d = datetime.strptime(analysis["date"], "%Y-%m-%d")
    date_text = f"{d.month}月{d.day}日"

    lines = [
        f"## GPT数据通报 — {date_text}",
        "",
        f"**全区汇总**：{t['centers']}个中心",
        f"> 效能异常：<font color=\"warning\">{t['job_abnormal']}个</font>",
        f"> 绩效异常：<font color=\"warning\">{t['salary_count']}人</font>",
        f"> 连续出勤≥15天：<font color=\"warning\">{t['att15_count']}人</font>",
        f"> 长期未出勤≥7天：<font color=\"warning\">{t['att7_count']}人</font>",
        f"> 日工时高>12.5h：<font color=\"warning\">{t['wh_high_count']}人</font>",
        f"> 日工时低≤8h：<font color=\"warning\">{t['wh_low_count']}人</font>",
        "",
    ]

    # 按省区分组展示
    for prov, prov_centers in analysis["provinces"].items():
        # 只看有异常的中心
        active = [c for c in prov_centers if c in analysis["centers"] and (
            analysis["centers"][c]["job_abnormal"] > 0 or
            analysis["centers"][c]["salary_count"] > 0 or
            analysis["centers"][c]["att15_count"] > 0 or
            analysis["centers"][c]["att7_count"] > 0 or
            analysis["centers"][c]["wh_high_count"] > 0 or
            analysis["centers"][c]["wh_low_count"] > 0
        )]
        if not active:
            continue

        lines.append(f"**{prov}**")
        for center in active:
            c = analysis["centers"][center]
            parts = []
            if c["job_abnormal"] > 0:
                detail = "、".join(c["job_details"])
                parts.append(f"效能{c['job_abnormal']}个({detail})")
            if c["salary_count"] > 0:
                parts.append(f"绩效{c['salary_count']}人")
            if c["att15_count"] > 0:
                parts.append(f"出勤≥15天{c['att15_count']}人")
            if c["att7_count"] > 0:
                parts.append(f"未出勤≥7天{c['att7_count']}人")
            if c["wh_high_count"] > 0:
                parts.append(f"工时高{c['wh_high_count']}人")
            if c["wh_low_count"] > 0:
                parts.append(f"工时低{c['wh_low_count']}人")
            lines.append(f"> {center}：{' | '.join(parts)}")
        lines.append("")

    # 数据加载情况
    fc = analysis["file_counts"]
    lines.append(f"数据文件：效能{fc['job']}条 | 绩效{fc['salary']}条 | 出勤{fc['att15']}条 | 未出勤{fc['att7']}条 | 工时高{fc['wh_high']}条 | 工时低{fc['wh_low']}条")
    lines.append("")
    lines.append(f"由GPT数据通报系统自动生成 · {datetime.now().strftime('%m-%d %H:%M')}")

    return "\n".join(lines)


# ── 主入口 ──────────────────────────────────────────

def main():
    dry_run = "--dry-run" in sys.argv
    date_arg = None
    for a in sys.argv[1:]:
        if a.startswith("--date="):
            date_arg = a.split("=", 1)[1]
        elif a == "--date" and len(sys.argv) > sys.argv.index(a) + 1:
            date_arg = sys.argv[sys.argv.index(a) + 1]

    date_str = date_arg or get_latest_date()
    print(f"[推送] 分析日期：{date_str}")

    analysis = analyze(date_str)
    if analysis["totals"]["centers"] == 0:
        print("[推送] 警告：未找到任何中心数据，检查 JSON 文件是否存在")
        return

    message = format_report(analysis)
    print(message)
    print(f"\n字符数：{len(message)}")

    if dry_run:
        print("\n[干运行] 未推送")
        return

    result = to_markdown(message)
    if result and result.get("errcode") == 0:
        print("[推送] ✅ 成功")
    else:
        print(f"[推送] ❌ 失败：{result}")


if __name__ == "__main__":
    main()
