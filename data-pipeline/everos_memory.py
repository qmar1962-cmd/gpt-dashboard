"""EverOS 会话记忆 — 记录每次开发过程的关键信息"""
from everos import EverOS
from datetime import datetime
import time

client = EverOS(api_key="828d02bd-fd16-4f88-8a10-9346c1b2d5eb")
USER_ID = "liuyang"

def remember(title: str, content: str, tags: list[str] = None):
    """记录一条开发记忆"""
    tag_str = f" [{', '.join(tags)}]" if tags else ""
    r = client.v1.memories.agent.add(
        user_id=USER_ID,
        session_id=datetime.now().strftime("%Y%m%d"),
        messages=[{
            "role": "user",
            "content": f"## {title}{tag_str}\n{content}",
            "timestamp": int(time.time()),
        }],
    )
    status = r.data.status if hasattr(r, 'data') else r
    print(f"  ✅ {title} → {status}")

def recall(query: str, top_k: int = 5):
    """搜索历史记忆"""
    r = client.v1.memories.search(
        filters={"user_id": USER_ID},
        query=query,
        method="hybrid",
        top_k=top_k,
    )
    print(f"🔍 搜索: {query}\n")
    data = r.data if hasattr(r, 'data') else {}
    episodes = data.episodes if hasattr(data, 'episodes') else []
    if not episodes:
        print("  (无结果)")
        return
    for ep in episodes:
        content = getattr(ep, 'content', str(ep))
        score = getattr(ep, 'score', 0)
        print(f"  [{score:.2f}] {content[:200]}...")
        print()

def session_summary(project: str, what_we_did: str, bugs_fixed: str = "", decisions: str = "", pitfalls: str = ""):
    """记录一次会话摘要"""
    parts = [f"**项目**: {project}", f"**做了什么**: {what_we_did}"]
    if bugs_fixed: parts.append(f"**修复的Bug**: {bugs_fixed}")
    if decisions: parts.append(f"**关键决策**: {decisions}")
    if pitfalls: parts.append(f"**踩过的坑**: {pitfalls}")
    remember("会话摘要", "\n".join(parts), tags=[project.replace(" ", "-")])


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("用法: python everos_memory.py <命令> [参数]")
        print("  summary  - 记录本次会话摘要")
        print("  recall <query> - 搜索历史记忆")
        sys.exit(0)
    cmd = sys.argv[1]
    if cmd == "recall" and len(sys.argv) > 2:
        recall(sys.argv[2])
    elif cmd == "summary":
        session_summary(
            project="GPT数据通报看板",
            what_we_did="",
            bugs_fixed="",
            decisions="",
            pitfalls="",
        )
