import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'motion/react';
import { Settings, Loader2 } from 'lucide-react';

async function sha256(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const ADMIN_HASH = import.meta.env.VITE_ADMIN_PASSWORD_HASH || '';

interface LoginProps {
  onLoginSuccess: (name: string, empId: string, isAdmin: boolean) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [name, setName] = useState('');
  const [empId, setEmpId] = useState('');
  const [errors, setErrors] = useState<{ name?: string; empId?: string }>({});
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [isLit, setIsLit] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const dragY = useMotionValue(0);
  const dragStartY = useRef(0);

  const validate = (): boolean => {
    const e: { name?: string; empId?: string } = {};
    if (!name.trim()) e.name = '请输入姓名';
    if (!empId.trim()) {
      e.empId = '请输入工号';
    } else if (!/^0\d{7}$/.test(empId.trim())) {
      e.empId = '工号须为8位数字，且以0开头';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoggingIn(true);
    // 短暂延迟，让灯泡闪烁效果呈现
    setTimeout(() => onLoginSuccess(name.trim(), empId.trim(), false), 600);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!ADMIN_HASH) { setAdminError('管理员功能未配置'); return; }
    const inputHash = await sha256(adminPassword.trim());
    if (inputHash !== ADMIN_HASH) { setAdminError('密码错误'); return; }
    setIsLoggingIn(true);
    setTimeout(() => onLoginSuccess(name.trim(), empId.trim(), true), 600);
  };

  // 灯链拖拽：拉到阈值触发开灯
  const handleDragEnd = () => {
    if (dragY.get() > 55) {
      setIsLit(true);
      dragY.set(0);
    } else {
      dragY.set(0);
    }
  };

  // 关灯（用于管理员重置）
  const turnOff = () => { setIsLit(false); setIsLoggingIn(false); };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col items-center overflow-hidden select-none">
      {/* ── 顶部装饰文字 ── */}
      <p className="text-[10px] text-white/15 uppercase tracking-[0.5em] mt-16 font-mono">GPT DATA DASHBOARD</p>

      {/* ── 灯线 ── */}
      <div className="w-[2px] h-24 bg-white/20 origin-top" />

      {/* ── 灯泡 + 光晕 ── */}
      <div className="relative flex flex-col items-center">
        {/* 灯泡主体 */}
        <motion.div
          className="relative z-10 w-10 h-14 rounded-[50%_50%_40%_40%] border-2 border-white/15 flex items-center justify-center"
          animate={{
            backgroundColor: isLit ? 'rgba(255,220,140,0.25)' : 'rgba(255,255,255,0.03)',
            borderColor: isLit ? 'rgba(255,220,140,0.5)' : 'rgba(255,255,255,0.1)',
            boxShadow: isLit
              ? '0 0 40px 10px rgba(255,200,100,0.3), 0 0 100px 30px rgba(255,180,60,0.15), 0 0 200px 60px rgba(255,160,30,0.08)'
              : '0 0 0px rgba(255,200,100,0)',
          }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          {/* 灯丝 */}
          <motion.div
            className="w-1 h-4 rounded-full"
            animate={{ backgroundColor: isLit ? '#ffcc66' : '#333', boxShadow: isLit ? '0 0 8px #ffaa33' : 'none' }}
            transition={{ duration: 0.5 }}
          />
        </motion.div>

        {/* 光晕扩散层 */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            width: 600, height: 600,
            background: 'radial-gradient(circle, rgba(255,200,120,0.15) 0%, rgba(255,180,80,0.05) 30%, transparent 70%)',
          }}
          animate={{ opacity: isLit ? 1 : 0, scale: isLit ? 1 : 0.3 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />

        {/* 拉链把手 */}
        <motion.div
          className="relative z-20 mt-3 cursor-grab active:cursor-grabbing flex flex-col items-center"
          drag="y"
          dragConstraints={{ top: 0, bottom: 80 }}
          dragElastic={0.15}
          style={{ y: dragY }}
          onDragStart={() => { dragStartY.current = dragY.get(); }}
          onDragEnd={handleDragEnd}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* 链子 */}
          <motion.div
            className="w-[2px] h-10 bg-white/30"
            animate={{ height: isLit ? 10 : 40 }}
          />
          {/* 拉环 */}
          <motion.div
            className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
            animate={{
              borderColor: isLit ? 'rgba(255,200,120,0.4)' : 'rgba(255,255,255,0.2)',
              backgroundColor: isLit ? 'rgba(255,200,120,0.08)' : 'rgba(255,255,255,0.02)',
            }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              animate={{ backgroundColor: isLit ? '#ffcc66' : '#555' }}
            />
          </motion.div>
          {/* 提示文字 */}
          {!isLit && (
            <p className="text-[9px] text-white/20 mt-2 whitespace-nowrap">下拉开灯</p>
          )}
        </motion.div>
      </div>

      {/* ── 登录表单（灯亮后出现）── */}
      <AnimatePresence>
        {isLit && (
          <motion.form
            className="relative z-30 mt-10 flex flex-col gap-2.5 bg-white/[0.06] backdrop-blur-xl py-10 px-8 rounded-3xl border border-white/10 w-[300px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
            onSubmit={handleSubmit}
          >
            {/* 管理员齿轮 */}
            <button
              type="button"
              onClick={() => { setShowAdminInput(!showAdminInput); setAdminError(''); setAdminPassword(''); }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/50 hover:text-white/80 transition-all"
              title="管理员入口"
            >
              <Settings size={16} className={showAdminInput ? 'animate-spin' : ''} />
            </button>

            <p className="text-white/90 text-center font-bold text-lg pb-6 tracking-wider">登录看板</p>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-white/50">姓名</label>
              <input
                type="text"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20"
                placeholder="请输入姓名"
                value={name}
                onChange={e => { setName(e.target.value); setErrors(prev => ({ ...prev, name: undefined })); }}
              />
              {errors.name && <p className="text-xs text-red-400 mt-0.5">{errors.name}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-white/50">工号</label>
              <input
                type="text"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20"
                placeholder="8位数字，以0开头"
                maxLength={8}
                value={empId}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setEmpId(v);
                  setErrors(prev => ({ ...prev, empId: undefined }));
                }}
              />
              {errors.empId && <p className="text-xs text-red-400 mt-0.5">{errors.empId}</p>}
            </div>

            {showAdminInput && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-white/50">管理员密码</label>
                <input
                  type="password"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20"
                  placeholder="输入管理员密码"
                  value={adminPassword}
                  onChange={e => { setAdminPassword(e.target.value); setAdminError(''); }}
                />
                {adminError && <p className="text-xs text-red-400 mt-0.5">{adminError}</p>}
                <button
                  type="button"
                  onClick={handleAdminLogin}
                  disabled={isLoggingIn}
                  className="text-center py-2.5 px-8 rounded-lg bg-amber-700 text-white text-sm font-bold hover:bg-amber-600 transition-all mt-1 disabled:opacity-50"
                >
                  {isLoggingIn ? <Loader2 size={14} className="animate-spin mx-auto" /> : '管理员登录'}
                </button>
              </div>
            )}

            {!showAdminInput && (
              <button
                type="submit"
                disabled={isLoggingIn}
                className="text-center py-2.5 px-8 rounded-lg bg-white/10 text-white text-sm font-bold hover:bg-white/20 transition-all mt-1 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoggingIn ? <><Loader2 size={14} className="animate-spin" />正在进入...</> : '进入看板'}
              </button>
            )}

            {/* 关灯按钮 */}
            <button
              type="button"
              onClick={turnOff}
              className="text-[10px] text-white/20 hover:text-white/40 transition-colors text-center mt-2"
            >
              关灯
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* ── 底部装饰 ── */}
      <p className="text-[9px] text-white/10 mt-auto mb-6">华中大区 · 绩效数据复盘</p>
    </div>
  );
}
