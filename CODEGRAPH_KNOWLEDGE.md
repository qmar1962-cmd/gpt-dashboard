# GPT 每日通报可视化看板 — 知识图谱

> 2026-05-27 · React 19 + TypeScript + Vite + Tailwind CSS v4 · GitHub Pages 部署

---

## 项目概述

华中大区（湖北/湖南/河南/江西）14 个操作中心的 HR 绩效监控看板，覆盖 6 大考核维度。

## 技术架构

| 层 | 技术 |
|---|---|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS v4 + tailwind-merge + clsx |
| 图表 | Recharts（雷达图）+ Canvas（总览图） |
| 动效 | motion (framer-motion) |
| 本地存储 | IndexedDB（原始数据）+ localStorage（元数据） |
| 协作存储 | Supabase（排休计划/未出勤原因/班组负责人） |
| 部署 | GitHub Pages + GitHub Actions |

## 6 大考核维度

| 维度 | 满分 | 扣分规则 |
|---|---|---|
| 效能异常（岗位） | 25 | 每个异常岗位扣 5 分 |
| 绩效异常（薪资） | 15 | 覆盖率 >3% 每多 1% 扣 3 分 |
| 连续出勤 ≥15 天 | 25 | >3% 每多 1% 扣 5 分 + >30 天每人扣 2 分 |
| 长期未出勤 ≥7 天 | 25 | 每人扣 2 分 |
| 日工时高 >12.5h | 5 | >10% 每多 1% 扣 1 分 |
| 日工时低 ≤8h | 5 | 每人扣 1 分 |

## 目录结构

```
src/
├── App.tsx                     # 主入口（290 行，已拆分）
├── components/
│   ├── DataTable.tsx            # 主数据表（省区/中心排名）
│   ├── SummaryChart.tsx         # 6 维雷达图
│   ├── ReportModal.tsx          # 详情报告弹窗（Canvas 总览图导出）
│   ├── Login.tsx                # 登录页（Tailwind 重写版）
│   ├── ConfirmModal.tsx         # 通用确认弹窗
│   ├── ErrorBoundary.tsx        # 错误边界
│   ├── LoadingOverlay.tsx       # 加载动画
│   ├── KPICard.tsx              # KPI 卡片
│   ├── MetricHelpPanel.tsx      # 指标口径说明
│   ├── DataManagerEnhanced.tsx  # 数据上传/管理（管理员）
│   ├── DataUploaderEnhanced.tsx # 文件上传器
│   ├── DataDownloader.tsx       # 文件下载
│   ├── AttendanceModule.tsx     # 中心考勤模块（1303 行）
│   ├── Attendance15DetailModal.tsx  # 连续出勤详情 + 排休计划 + 小组判定
│   ├── Attendance7DetailModal.tsx   # 长期未出勤详情 + 原因编辑
│   ├── EfficiencyDetailModal.tsx    # 效能异常详情
│   ├── SalaryDetailModal.tsx        # 绩效异常详情
│   ├── WorkHoursHighDetailModal.tsx # 日工时高详情
│   └── WorkHoursLowDetailModal.tsx  # 日工时低详情 + 原因编辑
├── hooks/
│   ├── useAuth.ts              # 登录状态
│   ├── useViewMode.ts          # 视图切换 + 离开确认
│   ├── useDataInit.ts          # IndexedDB 数据加载 + 上传处理
│   ├── useEnrichedData.ts      # 6 维度得分计算（评分常量命名）
│   ├── useFilteredData.ts      # 豁免中心过滤
│   └── useAdminMode.ts         # 管理员模式
├── lib/
│   ├── dataProcessor.ts        # 数据处理 + 周明细查询
│   ├── dateUtils.ts            # 日期工具（parseDate/beijingDate/weekDateRange）
│   ├── dataMerge.ts            # 通用合并去重
│   ├── database.ts             # IndexedDB/localStorage 封装
│   ├── idb.ts                  # IndexedDB 底层操作
│   ├── defaultDataLoader.ts    # 默认数据加载（filelist.json 增量更新）
│   ├── dataParser.ts           # Excel 数据解析
│   ├── reportGenerator.ts      # 文字报告生成
│   ├── collaborationApi.ts     # 协作数据 API（Supabase）
│   ├── utils.ts                # cn() 工具函数
│   └── types.ts                # 类型定义
├── types/
│   ├── types.ts                # 核心类型（Selection 等）
│   └── data.ts                 # 数据类型定义
└── constants.ts                # 默认演示数据
```

## 数据流

```
Excel 上传 → IndexedDB（原始数据）
              ↓
         useEnrichedData（T-2/T-3 计算得分）
              ↓
         DataTable（展示）+ SummaryChart（雷达图）
              ↓
         详情弹窗（近 7 天明细 + 协作编辑）

协作数据（排休/原因/负责人）↔ Supabase ↔ 多人共享
```

## 关键设计决策

- **详情弹窗独立**：6 个弹窗表面相似但内部交互不同（排休日历 vs 原因下拉 vs 纯显示），不合并不合并
- **继承用 savedAt**：排休/原因的自动继承基于真实保存日期而非窗口日期，间隔 ≤1 天
- **小组判定**：连续出勤弹窗用花名册九级单位取中心 + 七级部门取组别，T-2 出勤率 ≥85% 为"无法排休"
- **弹窗折叠**：6 个详情弹窗默认只展示 T-2 最新一天，可展开近 7 天
- **评分常量**：SCORE/PENALTY/THRESH/SPAN 命名常量替代魔法数字

## 数据管道

```
Downloads/ → process_data.py → 过滤省区 + 合并岗位 → public/database/ → git push
                                                                    ↓
                                                            GitHub Actions
                                                          build:data (xlsx→json)
                                                          vite build (部署)
```

脚本位置：`C:\Users\0347\data-pipeline\process_data.py`
