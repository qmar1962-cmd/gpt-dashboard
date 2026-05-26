-- GPT 每日通报可视化看板 - Supabase 数据库表结构
-- 执行前请确保在 Supabase 项目中运行此 SQL

-- 1. 排休计划表 (leave_plans)
CREATE TABLE IF NOT EXISTS leave_plans (
  id BIGSERIAL PRIMARY KEY,
  center TEXT NOT NULL,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  employee_id TEXT,
  start_date DATE,
  end_date DATE,
  set_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE(center, date, name)
);

-- 2. 未出勤原因表 (absence_reasons)
CREATE TABLE IF NOT EXISTS absence_reasons (
  id BIGSERIAL PRIMARY KEY,
  center TEXT NOT NULL,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  employee_id TEXT,
  reason TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE(center, date, name)
);

-- 3. 中心元数据表 (center_meta)
CREATE TABLE IF NOT EXISTS center_meta (
  id BIGSERIAL PRIMARY KEY,
  center TEXT UNIQUE NOT NULL,
  attendance_manager TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- 4. 班组负责人表 (group_leaders)
CREATE TABLE IF NOT EXISTS group_leaders (
  id BIGSERIAL PRIMARY KEY,
  center TEXT NOT NULL,
  group_name TEXT NOT NULL,
  leader_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE(center, group_name)
);

-- 启用 Realtime（实时订阅功能）
-- 需要在 Supabase Dashboard 中手动启用：
-- Database → Replication → Source → realtime_schema → 勾选这4个表

-- 配置 Row Level Security (RLS) - 允许所有人读写（简单方案）
-- 注意：生产环境应该配置更严格的策略
ALTER TABLE leave_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE center_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_leaders ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有人读取
CREATE POLICY "允许所有人读取 leave_plans" ON leave_plans FOR SELECT USING (true);
CREATE POLICY "允许所有人读取 absence_reasons" ON absence_reasons FOR SELECT USING (true);
CREATE POLICY "允许所有人读取 center_meta" ON center_meta FOR SELECT USING (true);
CREATE POLICY "允许所有人读取 group_leaders" ON group_leaders FOR SELECT USING (true);

-- 创建策略：允许所有人写入（插入/更新/删除）
CREATE POLICY "允许所有人写入 leave_plans" ON leave_plans FOR INSERT WITH (true);
CREATE POLICY "允许所有人写入 leave_plans" ON leave_plans FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "允许所有人写入 leave_plans" ON leave_plans FOR DELETE USING (true);

CREATE POLICY "允许所有人写入 absence_reasons" ON absence_reasons FOR INSERT WITH (true);
CREATE POLICY "允许所有人写入 absence_reasons" ON absence_reasons FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "允许所有人写入 absence_reasons" ON absence_reasons FOR DELETE USING (true);

CREATE POLICY "允许所有人写入 center_meta" ON center_meta FOR INSERT WITH (true);
CREATE POLICY "允许所有人写入 center_meta" ON center_meta FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "允许所有人写入 center_meta" ON center_meta FOR DELETE USING (true);

CREATE POLICY "允许所有人写入 group_leaders" ON group_leaders FOR INSERT WITH (true);
CREATE POLICY "允许所有人写入 group_leaders" ON group_leaders FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "允许所有人写入 group_leaders" ON group_leaders FOR DELETE USING (true);

-- 创建索引（提升查询性能）
CREATE INDEX IF NOT EXISTS idx_leave_plans_center_date ON leave_plans(center, date);
CREATE INDEX IF NOT EXISTS idx_absence_reasons_center_date ON absence_reasons(center, date);
CREATE INDEX IF NOT EXISTS idx_center_meta_center ON center_meta(center);
CREATE INDEX IF NOT EXISTS idx_group_leaders_center_group ON group_leaders(center, group_name);

-- 完成提示
SELECT '数据库表创建完成！请前往 Database → Replication 启用 Realtime。' as message;
