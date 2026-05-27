-- Supabase RLS 策略 — 先搭框架，读写都允许（功能不受影响）
-- 后续收紧时只需修改策略，无需改代码
-- 在 Supabase SQL Editor 中执行

-- 1. 开启所有表的 RLS
ALTER TABLE leave_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE center_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_hours_low_reasons ENABLE ROW LEVEL SECURITY;

-- 2. anon 读权限
CREATE POLICY "anon_read" ON leave_plans FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON absence_reasons FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON center_meta FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON group_leaders FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON work_hours_low_reasons FOR SELECT TO anon USING (true);

-- 3. anon 写权限（后续集成 Auth 后改为 authenticated 即可）
CREATE POLICY "anon_write" ON leave_plans FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_delete" ON leave_plans FOR DELETE TO anon USING (true);
CREATE POLICY "anon_write" ON absence_reasons FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_delete" ON absence_reasons FOR DELETE TO anon USING (true);
CREATE POLICY "anon_write" ON center_meta FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_delete" ON center_meta FOR DELETE TO anon USING (true);
CREATE POLICY "anon_write" ON group_leaders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_delete" ON group_leaders FOR DELETE TO anon USING (true);
CREATE POLICY "anon_write" ON work_hours_low_reasons FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_delete" ON work_hours_low_reasons FOR DELETE TO anon USING (true);
