"""
数据预处理 + 自动推送脚本 — 每天下载后双击运行
1. 扫描 Downloads/ 中的数据文件（不限日期）
2. 过滤省区（只保留湖北/湖南/河南/江西）
3. 效能异常表自动合并 7 个岗位
4. 花名册/外包/编制明细自动复制到项目
5. Excel → JSON 转换
6. Git 推送（自动确认）
"""
import os, re, shutil, glob, subprocess, sys
from datetime import datetime
import pandas as pd

# Windows 下强制 UTF-8 输出，避免中文乱码
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ── 路径配置 ──
DOWNLOAD_DIR = os.path.expanduser("~/Downloads")                                # 下载目录
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 自动定位项目根目录
OUTPUT_DIR = os.path.join(PROJECT_DIR, "public", "database")                    # 输出目录
ARCHIVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "archive")  # 归档目录

# ── 业务配置 ──
TARGET = ["湖北", "湖南", "河南", "江西"]  # 目标省区
EXPECTED_JOB_FILES = 7                    # 效能异常岗位文件数（7个岗位）

# ── 文件名匹配规则：关键词 → 输出前缀 ──
RULES = [
    (["中心考勤", "固定工-明细"],              "center_attendance"),
    (["工时高于12.5h"],                         "work_hours_high"),
    (["工时低于8h"],                            "work_hours_low"),
    (["连续7天未出勤"],                         "attendance7"),
    (["连续15天出勤"],                          "attendance15"),
    (["工资偏高"],                              "salary_performance"),
    (["绩效异常岗位"],                           "job_performance"),
    (["花名册"],                                "roster"),
    (["外包"],                                  "outsourcing"),
    (["编制明细"],                              "staffing_detail"),
]


def extract_date(filename: str) -> str | None:
    """从文件名中提取日期（如 20260528123456 → 0528）"""
    m = re.search(r'(\d{4})(\d{2})(\d{2})\d{6}', filename)
    return f"{m.group(2)}{m.group(3)}" if m else None


def match_rule(filename: str):
    """根据文件名关键词匹配数据类型，返回输出前缀"""
    for keywords, prefix in RULES:
        if all(k in filename for k in keywords):
            return prefix
    return None


def find_province_col(df: pd.DataFrame) -> str | None:
    """在 DataFrame 中查找省区列名（优先精确匹配，其次模糊匹配）"""
    # 精确匹配"省区"或"省区名称"
    for col in df.columns:
        if str(col) in ('省区', '省区名称'):
            return col
    # 模糊匹配：包含"省区"但不含"代码"
    for col in df.columns:
        s = str(col)
        if '省区' in s and '代码' not in s and 'code' not in s.lower():
            return col
    return None


def filter_province(df: pd.DataFrame) -> pd.DataFrame:
    """过滤数据：只保留目标省区（湖北/湖南/河南/江西）"""
    col = find_province_col(df)
    if col is None:
        return df  # 没有省区列，不过滤
    return df[df[col].apply(lambda x: any(p in str(x) for p in TARGET))]


def validate(df: pd.DataFrame, label: str, min_rows: int = 1) -> bool:
    """验证数据行数是否满足最低要求"""
    if len(df) < min_rows:
        print(f"    [FAIL] {label}: only {len(df)} rows")
        return False
    print(f"    [OK] {label}: {len(df)} rows, {len(df.columns)} cols")
    return True


def process_simple(filepath: str, prefix: str, date_str: str) -> str | None:
    """处理普通文件：读取 → 过滤省区 → 输出（dtype=str 保留工号前导零）"""
    df = pd.read_excel(filepath, dtype=str)      # dtype=str 防止工号前导零被去掉
    df = filter_province(df)                      # 过滤省区
    if not validate(df, prefix):                  # 验证数据
        return None
    out_name = f"{prefix}_{date_str}.xlsx"        # 输出文件名
    out_path = os.path.join(OUTPUT_DIR, out_name)
    df.to_excel(out_path, index=False)            # 写入 Excel
    print(f"  -> {out_name}")
    return out_path


def process_job_performance(files: list[str], date_str: str) -> str | None:
    """处理效能异常文件：合并7个岗位 → 过滤省区 → 输出"""
    if len(files) != EXPECTED_JOB_FILES:
        print(f"  [WARN] found {len(files)} job files, expected {EXPECTED_JOB_FILES}")

    frames = []
    for fp in files:
        basename = os.path.basename(fp)
        # 从文件名提取岗位名（如"岗位.卸车绩效偏高" → "卸车"）
        job_match = re.search(r'岗位.(.+?)绩效偏高', basename)
        job_name = job_match.group(1).replace('岗', '') if job_match else "?"

        df = pd.read_excel(fp, dtype=str)         # dtype=str 保留工号格式
        cols = list(df.columns)
        # 在中心列后面插入岗位列
        center_idx = next((i for i, c in enumerate(cols) if '中心' in str(c)), 1)
        df.insert(center_idx + 1, '岗位', job_name)
        frames.append(df)

    merged = pd.concat(frames, ignore_index=True)  # 合并所有岗位
    merged = filter_province(merged)               # 过滤省区

    job_counts = merged['岗位'].value_counts().to_dict()
    print(f"  jobs: {job_counts}")
    if not validate(merged, "job_performance"):
        return None

    out_name = f"job_performance_{date_str}.xlsx"
    out_path = os.path.join(OUTPUT_DIR, out_name)
    merged.to_excel(out_path, index=False)
    print(f"  -> {out_name}")
    return out_path


def main():
    """主流程：扫描 → 分类 → 处理 → 归档 → 推送"""
    today = datetime.now()
    today_str = today.strftime("%Y%m%d")
    print(f"\n{'='*50}")
    print(f"Data Pipeline — {today.strftime('%Y-%m-%d')}")
    print(f"{'='*50}")

    # 确保输出和归档目录存在
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # ── Step 0: 确认数据日期 ──
    date_input = input(f"\n请输入数据实际日期（如 0525），直接回车使用今天({today.strftime('%m%d')}): ").strip()
    if date_input:
        manual_date = date_input  # 用户手动指定的数据日期
    else:
        manual_date = None
    print()

    # ── Step 1: 扫描 Downloads 中的 Excel 文件 ──
    all_files = glob.glob(os.path.join(DOWNLOAD_DIR, "*.xlsx"))
    all_files += glob.glob(os.path.join(DOWNLOAD_DIR, "*.xls"))
    # 只保留文件名含时间戳的（格式 YYYYMMDDxxxxxx），排除临时文件
    data_files = [f for f in all_files if re.search(r'\d{8}\d{6}', os.path.basename(f))]
    data_files = [f for f in data_files if not os.path.basename(f).startswith("~$")]

    # 补充扫描：外包/编制明细/花名册 文件名可能不含时间戳，单独识别
    DIRECT_KEYWORDS = ["外包", "编制明细", "花名册"]
    for f in all_files:
        basename = os.path.basename(f)
        if basename.startswith("~$"):
            continue
        if f in data_files:
            continue
        if any(k in basename for k in DIRECT_KEYWORDS):
            data_files.append(f)
            print(f"  [SCAN] {basename} (无时间戳，按关键词识别)")

    if not data_files:
        print("No data files found in Downloads/")
        # 即使没有新文件，也检查是否需要推送
        print("\n检查是否有未推送的更改...")
        os.chdir(PROJECT_DIR)
        subprocess.run(["git", "add", "public/database/"], check=False)
        result = subprocess.run(["git", "diff", "--cached", "--stat"], capture_output=True, text=True)
        if result.stdout.strip():
            print(f"\n发现未推送的更改，开始推送...")
            subprocess.run(["git", "commit", "-m", f"data: {today.strftime('%m%d')} data update"], check=False)
            subprocess.run(["git", "push", "origin", "master"], check=False)
            print(f"[OK] Pushed to GitHub")
        else:
            print("[INFO] 无更改需要推送")
        return

    print(f"\nFound {len(data_files)} files.\n")

    # ── Step 2: 按数据类型分类 ──
    job_files = []   # 效能异常文件（需合并处理）
    simple = {}      # 普通文件（单独处理）
    direct_copy = {} # 直接复制的文件（花名册/外包/编制明细）
    skipped = 0

    for fp in data_files:
        basename = os.path.basename(fp)
        prefix = match_rule(basename)              # 匹配类型
        if not prefix:
            continue

        # 花名册/外包/编制明细：直接复制，不过滤省区，不需要时间戳
        if prefix in ("roster", "outsourcing", "staffing_detail"):
            direct_copy.setdefault(prefix, []).append((fp, manual_date or ''))
            continue

        # 使用手动指定日期（如果有），否则从文件名提取
        date_str = manual_date or extract_date(basename)
        if not date_str:
            continue

        if prefix == "job_performance":
            job_files.append(fp)
        else:
            simple.setdefault(prefix, []).append((fp, date_str))

    # ── Step 3: 处理普通文件 ──
    processed = 0
    errors = []

    for prefix, files in simple.items():
        for fp, ds in files:
            try:
                if process_simple(fp, prefix, ds):   # 处理单个文件
                    processed += 1
                # 处理成功后归档（移到 archive 目录）
                try: shutil.move(fp, os.path.join(ARCHIVE_DIR, os.path.basename(fp)))
                except: pass
            except Exception as e:
                err = f"  [ERR] {os.path.basename(fp)}: {e}"
                print(err); errors.append(err)

    # ── Step 3.5: 直接复制花名册/外包/编制明细 ──
    for prefix, files in direct_copy.items():
        for fp, ds in files:
            try:
                basename = os.path.basename(fp)
                # 保留原文件名（带日期），如 roster_0620.xlsx / outsourcing_0620.xlsx
                out_name = basename
                out_path = os.path.join(OUTPUT_DIR, out_name)
                shutil.copy2(fp, out_path)
                print(f"  [COPY] {basename} -> {out_name}")
                processed += 1
                # 归档
                try: shutil.move(fp, os.path.join(ARCHIVE_DIR, basename))
                except: pass
            except Exception as e:
                err = f"  [ERR] {prefix}: {e}"
                print(err); errors.append(err)

    # ── Step 4: 处理效能异常文件（合并后输出）──
    if job_files:
        job_date = manual_date or extract_date(os.path.basename(job_files[0])) or today.strftime("%m%d")
        try:
            if process_job_performance(job_files, job_date):
                processed += 1
            for fp in job_files:
                try: shutil.move(fp, os.path.join(ARCHIVE_DIR, os.path.basename(fp)))
                except: pass
        except Exception as e:
            err = f"  [ERR] job_performance: {e}"
            print(err); errors.append(err)

    # ── Step 5: 输出处理结果 ──
    print(f"\n{'='*50}")
    print(f"Processed: {processed} files, Skipped: {skipped}, Errors: {len(errors)}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Archive: {ARCHIVE_DIR}")

    if errors:
        print(f"\n[WARN] 有错误，请修复后再推送！")
        return

    # ── Step 6: Excel 转 JSON（为在线部署做准备）──
    print(f"\n{'='*50}")
    print(f"Excel → JSON 转换")
    print(f"{'='*50}")
    os.chdir(PROJECT_DIR)
    result = subprocess.run("npm run build:data", shell=True)
    if result.returncode != 0:
        print(f"[WARN] build:data 失败（returncode={result.returncode}），JSON 将由 CI 自动生成")
    else:
        print(f"[OK] JSON 生成完成")

    # ── Step 7: Git 推送 ──
    subprocess.run(["git", "add", "public/database/"], check=False)
    result = subprocess.run(["git", "diff", "--cached", "--stat"], capture_output=True, text=True)

    if result.stdout.strip():
        print(f"\n{'='*50}")
        print(f"将推送以下更改：")
        print(f"{'='*50}")
        for line in result.stdout.strip().split('\n'):
            print(f"  {line}")
        print(f"{'='*50}")

        # 等待用户确认
        confirm = input("\n确认推送？(y/n): ").strip().lower()
        if confirm == 'y':
            subprocess.run(["git", "commit", "-m", f"data: {today.strftime('%m%d')} data update"], check=False)
            subprocess.run(["git", "push", "origin", "master"], check=False)
            print(f"\n[OK] Pushed to GitHub")
        else:
            print(f"\n[INFO] 已取消推送，文件已处理但未提交。手动推送：git push")
    else:
        print(f"\n[INFO] No changes to push")

    print(f"\nDone.")


if __name__ == "__main__":
    try:
        main()
    finally:
        input("\nPress Enter to exit...")
