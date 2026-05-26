-- GPT 每日通报可视化看板 - Supabase 数据库表结构（完全清理版）
-- 先删除所有已存在的表、策略、索引，再重新创建

-- ============ 第一步：删除已存在的策略和表 ============

-- 删除策略（如果存在）
DROP POLICY IF EXISTS "允许所有人读取 leave_plans" ON leave_plans;
DROP POLICY IF EXISTS "允许所有人读取 absence_reasons" ON absence_reasons;
DROP POLICY IF EXISTS "允许所有人读取 center_meta" ON center_meta;
DROP POLICY IF EXISTS "允许所有人读取 group_leaders" ON group_leaders;

DROP POLICY IF EXISTS "允许所有人插入 leave_plans" ON leave_plans;
DROP POLICY IF EXISTS "允许所有人插入 absence_reasons" ON absence_reasons;
DROP POLICY IF EXISTS "允许所有人插入 center_meta" ON center_meta;
DROP POLICY IF EXISTS "允许所有人插入 group_leaders" ON group_leaders;

DROP POLICY IF EXISTS "允许所有人更新 leave_plans" ON leave_plans;
DROP POLICY IF EXISTS "允许所有人更新 absence_reasons" ON absence_reasons;
DROP POLICY IF EXISTS "允许所有人更新 center_meta" ON center_meta;
DROP POLICY IF EXISTS "允许所有人更新 group_leaders" ON group_leaders;

DROP POLICY IF EXISTS "允许所有人删除 leave_plans" ON leave_plans;
DROP POLICY IF EXISTS "允许所有人删除 absence_reasons" ON absence_reasons;
DROP POLICY IF EXISTS "允许所有人删除 center_meta" ON center_meta;
DROP POLICY IF EXISTS "允许所有人删除 group_leaders" ON group_leaders;

-- 删除表（连同数据和依赖）
DROP TABLE IF EXISTS leave_plans CASCADE;
DROP TABLE IF EXISTS absence_reasons CASCADE;
DROP TABLE IF EXISTS center_meta CASCADE;
DROP TABLE IF EXISTS group_leaders CASCADE;

-- ============ 第二步：重新创建表 ============

-- 1. 排休计划表 (leave_plans)
CREATE TABLE leave_plans (
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
CREATE TABLE absence_reasons (
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
CREATE TABLE center_meta (
  id BIGSERIAL PRIMARY KEY,
  center TEXT UNIQUE NOT NULL,
  attendance_manager TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- 4. 班组负责人表 (group_leaders)
CREATE TABLE group_leaders (
  id BIGSERIAL PRIMARY KEY,
  center TEXT NOT NULL,
  group_name TEXT NOT NULL,
  leader_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE(center, group_name)
);

-- ============ 第三步：启用 RLS ============

ALTER TABLE leave_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE center_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_leaders ENABLE ROW LEVEL SECURITY;

-- ============ 第四步：创建策略 ============

-- 读取策略
CREATE POLICY "允许所有人读取 leave_plans" ON leave_plans FOR SELECT USING (true);
CREATE POLICY "允许所有人读取 absence_reasons" ON absence_reasons FOR SELECT USING (true);
CREATE POLICY "允许所有人读取 center_meta" ON center_meta FOR SELECT USING (true);
CREATE POLICY "允许所有人读取 group_leaders" ON group_leaders FOR SELECT USING (true);

-- 插入策略
CREATE POLICY "允许所有人插入 leave_plans" ON leave_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "允许所有人插入 absence_reasons" ON absence_reasons FOR INSERT WITH CHECK (true);
CREATE POLICY "允许所有人插入 center_meta" ON center_meta FOR INSERT WITH CHECK (true);
CREATE POLICY "允许所有人插入 group_leaders" ON group_leaders FOR INSERT WITH CHECK (true);

-- 更新策略
CREATE POLICY "允许所有人更新 leave_plans" ON leave_plans FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "允许所有人更新 absence_reasons" ON absence_reasons FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "允许所有人更新 center_meta" ON center_meta FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "允许所有人更新 group_leaders" ON group_leaders FOR UPDATE USING (true) WITH CHECK (true);

-- 删除策略
CREATE POLICY "允许所有人删除 leave_plans" ON leave_plans FOR DELETE USING (true);
CREATE POLICY "允许所有人删除 absence_reasons" ON absence_reasons FOR DELETE USING (true);
CREATE POLICY "允许所有人删除 center_meta" ON center_meta FOR DELETE USING (true);
CREATE POLICY "允许所有人删除 group_leaders" ON group_leaders FOR DELETE USING (true);

-- ============ 第五步：创建索引 ============

CREATE INDEX idx_leave_plans_center_date ON leave_plans(center, date);
CREATE INDEX idx_absence_reasons_center_date ON absence_reasons(center, date);
CREATE INDEX idx_center_meta_center ON center_meta(center);
CREATE INDEX idx_group_leaders_center_group ON group_leaders(center, group_name);

-- ============ 完成 ============

SELECT '数据库表创建完成！请前往 Database → Replication 启用 Realtime。' as message;
