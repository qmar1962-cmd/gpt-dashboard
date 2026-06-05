"""企业微信机器人推送 — GPT数据通报"""
import requests, json, sys

WEBHOOK_URL = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=75f66b59-9713-4919-b4ea-561f474a784c"

def send_markdown(content: str):
    """推送 markdown 消息"""
    return requests.post(WEBHOOK_URL, json={
        "msgtype": "markdown",
        "markdown": {"content": content}
    }).json()

def send_text(content: str, mentioned_list: list[str] = None):
    """推送文本消息，可@人"""
    body = {"msgtype": "text", "text": {"content": content}}
    if mentioned_list:
        body["text"]["mentioned_list"] = mentioned_list
    return requests.post(WEBHOOK_URL, json=body).json()

def daily_report(data: dict):
    """生成每日通报"""
    lines = [
        f"## GPT数据通报 · {data.get('date', '')}",
        f"> 全区均分: <font color=\"info\">{data.get('score', 0)}分</font>",
        f"> 效能异常: <font color=\"warning\">{data.get('job_abnormal', 0)}个 (环比{data.get('job_trend', '')})</font>",
        f"",
        f"**各维度异常汇总**",
        f"> 效能: {data.get('job', 0)}个",
        f"> 绩效: {data.get('salary', 0)}人 (覆盖率{data.get('salary_rate', '0%')})",
        f"> 连续出勤: {data.get('att15', 0)}人 (触发率{data.get('att15_rate', '0%')})",
        f"> 长期未出勤: {data.get('att7', 0)}人",
        f"> 日工时高: {data.get('wh_high', 0)}人 ({data.get('wh_high_rate', '0%')})",
        f"> 日工时低: {data.get('wh_low', 0)}人",
        f"",
    ]
    # 非操超标
    if data.get('nonop_alerts'):
        lines.append(f"**非操超标预警**")
        for c in data['nonop_alerts']:
            lines.append(f"> <font color=\"red\">{c['name']}: {c['ratio']}%</font> (标准≤{c['threshold']}%)")
        lines.append(f"")

    lines.append(f"---")
    lines.append(f"由GPT数据通报系统自动生成")
    return send_markdown("\n".join(lines))

if __name__ == "__main__":
    # 演示：推送一条测试报告
    test_data = {
        "date": "2026-06-01",
        "score": 78,
        "job_abnormal": 15,
        "job_trend": "+3",
        "job": 15, "salary": 12, "salary_rate": "3.2%",
        "att15": 28, "att15_rate": "2.1%",
        "att7": 8,
        "wh_high": 5, "wh_high_rate": "0.8%",
        "wh_low": 3,
        "nonop_alerts": [
            {"name": "武汉", "ratio": "9.29", "threshold": "8"},
            {"name": "长沙", "ratio": "7.27", "threshold": "8"},
        ]
    }
    r = daily_report(test_data)
    print(r)
