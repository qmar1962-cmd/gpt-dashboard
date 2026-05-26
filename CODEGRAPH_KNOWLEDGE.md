# CodeGraph 知识图谱 - GPT 每日通报可视化看板

> **生成时间**: 2026-05-25  
> **项目路径**: `C:\Users\0347\Documents\trae_projects\1\GPT2\GPT 每日通报可视化看板`  
> **CodeGraph 索引**: `.codegraph/` (472 nodes, 430 edges)

---

## 1. 项目概览

| 项目 | 信息 |
|------|------|
| **名称** | GPT 每日通报可视化看板 |
| **技术栈** | React 18 + TypeScript + Vite + Tailwind CSS + IndexedDB |
| **部署** | GitHub Pages (https://qmar1962-cmd.github.io/gpt-dashboard/) |
| **仓库** | https://github.com/qmar1962-cmd/gpt-dashboard |
| **本地路径** | `C:\Users\0347\Documents\trae_projects\1\GPT2\GPT 每日通报可视化看板` |

---

## 2. 目录结构

```
gpt-dashboard/
├── public/
│   ├── database/              # 数据源文件（Excel）
│   │   ├── job_performance_*.xlsx    # 绩效数据
│   │   ├── salary_performance_*.xlsx  # 薪资数据
│   │   ├── attendance15_*.xlsx       # 连续15日出勤
│   │   ├── attendance7_*.xlsx        # 连续7日未出勤
│   │   ├── center_attendance_*.xlsx   # 中心考勤
│   │   ├── work_hours_high_*.xlsx    # 日工时高
│   │   ├── work_hours_low_*.xlsx     # 日工时低
│   │   └── roster_*.xlsx             # 花名册
│   └── favicon.svg
├── src/
│   ├── components/            # React 组件
│   ├── lib/                  # 工具库
│   ├── hooks/                # React Hooks
│   ├── types/                # TypeScript 类型定义
│   ├── App.tsx               # 主应用组件
│   ├── main.tsx              # 入口文件
│   └── index.css             # 全局样式
├── .codegraph/              # CodeGraph 索引（不提交 Git）
├── PROJECT_KNOWLEDGE.md     # 项目知识文档（手动维护）
└── package.json
```

---

## 3. 核心组件层次

```
App.tsx (主应用)
├── Login.tsx (登录组件)
├── DataUploaderEnhanced.tsx (数据上传)
├── DataManagerEnhanced.tsx (数据管理)
├── MetricHelpPanel.tsx (指标说明面板)
├── DataTable.tsx (数据表格 - 主页)
├── KpiCard.tsx (KPI 卡片)
├── SummaryChart.tsx (汇总图表)
├── AttendanceModule.tsx (考勤模块)
├── ReportModal.tsx (报告导出弹窗)
├── TemplateSelector.tsx (模板选择器)
├── ConfirmModal.tsx (确认弹窗)
├── LoadingOverlay.tsx (加载遮罩)
├── ErrorBoundary.tsx (错误边界)
│
└── 详情弹窗组件 (Modals)
    ├── Attendance15DetailModal.tsx (连续15日出勤详情)
    ├── Attendance7DetailModal.tsx (连续7日未出勤详情)
    ├── AttendanceSummaryDetailModal.tsx (考勤汇总详情)
    ├── EfficiencyDetailModal.tsx (效能异常详情)
    ├── SalaryDetailModal.tsx (薪资异常详情)
    ├── WorkHoursHighDetailModal.tsx (日工时高详情)
    └── WorkHoursLowDetailModal.tsx (日工时低详情)
```

---

## 4. 核心库文件 (src/lib/)

| 文件 | 功能 | 关键导出 |
|------|------|----------|
| `auth.ts` | 认证逻辑 | `isAdmin()`, `getUserInfo()` |
| `cloudbase.ts` | CloudBase 云服务 | `cloudbase`, `auth` |
| `collaborationApi.ts` | 协作数据 API | `loadLeavePlans()`, `saveLeavePlan()`, `loadAbsenceReasons()`, `saveAbsenceReason()`, `loadCenterMeta()`, `saveCenterMeta()`, `loadGroupLeaders()`, `saveGroupLeaders()` |
| `dataParser.ts` | Excel 解析 | `parseExcelFile()`, `parseExcelBlob()` |
| `dataProcessor.ts` | 数据处理 | `processJobPerformance()`, `processSalaryPerformance()`, `processAttendance15()`, `processAttendance7()`, `processCenterAttendance()`, `processWorkHoursHigh()`, `processWorkHoursLow()` |
| `database.ts` | IndexedDB 操作 | `saveRawData()`, `loadRawData()`, `clearRawData()`, `clearRawDataByType()` |
| `defaultDataLoader.ts` | 默认数据加载器 | `loadDefaultData()`, `clearDeletedFileData()` |
| `githubApi.ts` | GitHub API | `fetchFile()`, `uploadFile()`, `deleteFile()` |
| `idb.ts` | IndexedDB 封装 | `openIDB()`, `putData()`, `getData()`, `clearStore()` |
| `jobPerformanceProcessor.ts` | 绩效数据处理 | `processJobPerformanceData()` |
| `reportGenerator.ts` | 报告生成 | `generateReport()`, `exportToExcel()` |
| `utils.ts` | 工具函数 | `formatDate()`, `calculateDays()`, `getCenterName()` |

---

## 5. 数据流架构

### 5.1 数据加载流程

```
用户访问页面
    ↓
App.tsx: useEffect() → loadDefaultData()
    ↓
defaultDataLoader.ts: loadDefaultData()
    ↓
┌─────────────────┬────────────────────┐
│                 │                    │
↓                 ↓                    ↓
检查 IndexedDB  检查 GitHub API    检查 public/database/
有缓存？        有协作文档？       有 Excel 文件？
    ↓                 ↓                    ↓
是→直接返回      是→加载协作数据     是→解析 Excel
否→继续          否→降级 localStorage   否→报错
```

### 5.2 协作数据流程 (GitHub API)

```
用户点击"编辑原因"/"设置排休"
    ↓
collaborationApi.ts: loadXxx()
    ↓
GitHub API: GET /repos/.../contents/xxx.json
    ↓
解析 base64 → JSON
    ↓
存储到 React state
    ↓
用户编辑 → onClick 保存
    ↓
collaborationApi.ts: saveXxx()
    ↓
GitHub API: PUT /repos/.../contents/xxx.json
    ↓
更新成功 → 刷新 state
```

### 5.3 文件命名规则

| 数据类型 | 文件前缀 | 示例 | 识别规则 |
|---------|---------|------|----------|
| 绩效数据 | `job_performance_` | `job_performance_0525.xlsx` | `fileName.startsWith('job_performance_')` |
| 薪资数据 | `salary_performance_` | `salary_performance_0525.xlsx` | `fileName.startsWith('salary_performance_')` |
| 连续15日出勤 | `attendance15_` | `attendance15_0525.xlsx` | `fileName.startsWith('attendance15_')` |
| 连续7日未出勤 | `attendance7_` | `attendance7_0525.xlsx` | `fileName.startsWith('attendance7_')` |
| 中心考勤 | `center_attendance_` | `center_attendance_0525.xlsx` | `fileName.startsWith('center_attendance_')` |
| 日工时高 | `work_hours_high_` | `work_hours_high_0525.xlsx` | `fileName.startsWith('work_hours_high_')` |
| 日工时低 | `work_hours_low_` | `work_hours_low_0525.xlsx` | `fileName.startsWith('work_hours_low_')` |
| 花名册 | `roster_` | `roster_0525.xlsx` | `fileName.startsWith('roster_')` |

**日期格式**: MMDD (月月日日)，如 `0525` = 5月25日

---

## 6. 关键业务逻辑

### 6.1 异常判定阈值

| 指标 | 异常阈值 | 说明 |
|------|----------|------|
| 岗位效能偏离 | ≥ 10% | 目标偏离%，正数=超标 |
| 连续出勤 | ≥ 10天 | 黄色预警 |
| 连续缺勤 | ≥ 5天 | 黄色预警 |
| 日工时高 | > 10% 触发占比 | 每增1%扣1分，5分制 |
| 日工时低 | 每人每天 | 每发生1次扣1分，5分制 |

### 6.2 超目标计算

```
综合超目标 = 操作人数 / 25 - (组长数 + 主管数)
组长超目标 = 操作人数 / 35 - 组长数

正数 = 缺管理
负数 = 超编
```

### 6.3 日工时高/低考核公式

**日工时高**（5分制）:
```
触发占比 = 触发次数 / 应覆盖人次
得分 = 5 - (触发占比 - 10%) × 100   # 每超1%扣1分
最低分 = 0
```

**日工时低**（5分制）:
```
发生人次 = 漏签人次
得分 = 5 - 发生人次 × 1   # 每发生1次扣1分
最低分 = 0
```

---

## 7. 常用命令

### 7.1 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

### 7.2 Git 命令

```bash
# 查看状态
git status

# 添加文件
git add .

# 提交
git commit -m "描述"

# 推送
git push

# 拉取
git pull
```

### 7.3 数据更新流程

1. 导出新数据（从业务系统）
2. 转换为 Excel 格式，命名规则：`{前缀}_{MMDD}.xlsx`
3. 放入 `public/database/` 文件夹
4. `git add .` → `git commit` → `git push`
5. 等待 GitHub Actions 构建完成（约2-3分钟）

---

## 8. 配置说明

### 8.1 环境变量 (`.env.local`)

```bash
# GitHub Token (必须，用于 GitHub API 读写协作数据)
VITE_GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# CloudBase 配置 (可选，未使用)
VITE_CLOUDBASE_ENV_ID=xxx
VITE_CLOUDBASE_REGION=xxx
```

### 8.2 GitHub Actions (`.github/workflows/deploy.yml`)

```yaml
# 触发条件: push to master branch
# 构建步骤:
# 1. checkout code
# 2. setup node.js 20
# 3. install dependencies
# 4. build project
# 5. deploy to GitHub Pages
```

---

## 9. 已知问题与待办

### 9.1 已知 Bug

- [ ] `salary_abnormal.csv` 数据过期（4月份），需要更新
- [ ] `public/database/` 中可能有多余的旧 Excel 文件（0512-0522）
- [ ] GitHub Actions 偶尔构建失败（需检查日志）

### 9.2 待办功能

- [ ] 接入 DeepSeek v4 pro API（自动分析异常原因）
- [ ] 迁移协作数据到 Supabase（解决并发冲突）
- [ ] 优化移动端体验
- [ ] 添加数据导出 PDF 功能

---

## 10. AI 助手注意事项

### 10.1 代码修改原则

- **不要** 直接修改 `src/App.tsx` 的主结构（除非用户明确要求）
- **优先** 修改子组件或 lib 文件
- **测试** 修改后必须在浏览器中验证功能
- **提交** 修改后必须 `git commit` + `git push`

### 10.2 常见任务模式

| 任务 | 模式 |
|------|------|
| 修改数据源 | 更新 `public/database/` → Git 推送 → 等待构建 |
| 修改业务逻辑 | 修改 `src/lib/dataProcessor.ts` 或对应 processor |
| 修改 UI | 修改 `src/components/*.tsx` |
| 修改样式 | 修改 `src/index.css` 或组件内联样式 |
| 修复 Bug | 先复现 → 定位代码 → 修改 → 测试 |

### 10.3 文件搜索技巧

- **找组件**: `find src/components -name "*.tsx" | xargs grep -l "关键词"`
- **找函数**: `grep -r "function_name" src/`
- **找类型**: `grep -r "interface_name" src/types/`

---

## 11. 版本历史

| 版本 | 日期 | 主要变更 |
|------|------|----------|
| V2.8.0 | 2026-05-24 | 新增日工时高/低考核维度；修复指标口径说明 |
| V2.7.0 | 2026-05-17 | 修复 GitHub Actions Node.js 20 弃用警告 |
| V2.6.0 | 2026-05-12 | 优化数据加载逻辑；添加 IndexedDB 缓存清理 |
| V2.5.0 | 2026-05-08 | 新增协作编辑功能（GitHub API） |
| V2.0.0 | 2026-04-27 | 重构为 React + TypeScript + Vite |
| V1.0.0 | 2026-04-01 | 初始版本（WPS 插件） |

---

## 12. 联系信息

- **项目负责人**: 刘洋 (0347)
- **GitHub**: qmar1962-cmd
- **仓库**: https://github.com/qmar1962-cmd/gpt-dashboard
- **部署**: https://qmar1962-cmd.github.io/gpt-dashboard/

---

**文档维护**: 此文档由 AI 助手维护，每次重大变更后更新。  
**最后更新**: 2026-05-25 by CodeBuddy
