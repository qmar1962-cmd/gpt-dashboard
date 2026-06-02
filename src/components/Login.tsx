import React from 'react';
import { useState } from 'react';
import { Settings } from 'lucide-react';

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
    if (validate()) onLoginSuccess(name.trim(), empId.trim(), false);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!ADMIN_HASH) {
      setAdminError('管理员功能未配置');
      return;
    }
    const inputHash = await sha256(adminPassword.trim());
    if (inputHash !== ADMIN_HASH) {
      setAdminError('密码错误');
      return;
    }
    onLoginSuccess(name.trim(), empId.trim(), true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100/80 backdrop-blur-sm">
      <form className="flex flex-col gap-2.5 bg-white py-10 px-8 rounded-3xl shadow-lg hover:shadow-xl transition-shadow relative" onSubmit={handleSubmit}>
        {/* 管理员入口齿轮按钮 */}
        <button
          type="button"
          onClick={() => {
            setShowAdminInput(!showAdminInput);
            setAdminError('');
            setAdminPassword('');
          }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all"
          title="管理员入口"
        >
          <Settings size={16} className={showAdminInput ? 'animate-spin' : ''} />
        </button>

        <p className="text-black text-center font-bold text-lg pb-8">登录看板</p>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">姓名</label>
          <input
            type="text"
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
            placeholder="请输入姓名"
            value={name}
            onChange={e => {
              setName(e.target.value);
              setErrors(prev => ({ ...prev, name: undefined }));
            }}
          />
          {errors.name && <p className="text-xs text-red-600 mt-0">{errors.name}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">工号</label>
          <input
            type="text"
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
            placeholder="8位数字，以0开头"
            maxLength={8}
            value={empId}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 8);
              setEmpId(v);
              setErrors(prev => ({ ...prev, empId: undefined }));
            }}
          />
          {errors.empId && <p className="text-xs text-red-600 mt-0">{errors.empId}</p>}
        </div>

        {showAdminInput && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">管理员密码</label>
            <input
              type="password"
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="输入管理员密码"
              value={adminPassword}
              onChange={e => {
                setAdminPassword(e.target.value);
                setAdminError('');
              }}
            />
            {adminError && <p className="text-xs text-red-600 mt-0">{adminError}</p>}
            <button
              type="button"
              onClick={handleAdminLogin}
              className="text-center py-2.5 px-8 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-none transition-all"
              style={{ marginTop: '0.75em', backgroundColor: '#b45309' }}
            >
              管理员登录
            </button>
          </div>
        )}

        {!showAdminInput && <button type="submit" className="text-center py-2.5 px-8 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-none transition-all">进入看板</button>}
      </form>
    </div>
  );
}
