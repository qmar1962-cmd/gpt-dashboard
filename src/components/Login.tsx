import React from 'react';
import { useState } from 'react';
import { Settings } from 'lucide-react';

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

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (adminPassword.trim() !== '123456') {
      setAdminError('密码错误');
      return;
    }
    onLoginSuccess(name.trim(), empId.trim(), true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-100/80 backdrop-blur-sm">
      <form className="login-form relative" onSubmit={handleSubmit}>
        {/* 管理员入口齿轮按钮 */}
        <button
          type="button"
          onClick={() => {
            setShowAdminInput(!showAdminInput);
            setAdminError('');
            setAdminPassword('');
          }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 transition-all"
          title="管理员入口"
        >
          <Settings size={16} className={showAdminInput ? 'animate-spin' : ''} />
        </button>

        <p className="login-heading">登录看板</p>
        <div className="login-field">
          <label className="login-label">姓名</label>
          <input
            type="text"
            className="login-input"
            placeholder="请输入姓名"
            value={name}
            onChange={e => {
              setName(e.target.value);
              setErrors(prev => ({ ...prev, name: undefined }));
            }}
          />
          {errors.name && <p className="login-error">{errors.name}</p>}
        </div>
        <div className="login-field">
          <label className="login-label">工号</label>
          <input
            type="text"
            className="login-input"
            placeholder="8位数字，以0开头"
            maxLength={8}
            value={empId}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 8);
              setEmpId(v);
              setErrors(prev => ({ ...prev, empId: undefined }));
            }}
          />
          {errors.empId && <p className="login-error">{errors.empId}</p>}
        </div>

        {showAdminInput && (
          <div className="login-field">
            <label className="login-label">管理员密码</label>
            <input
              type="password"
              className="login-input"
              placeholder="输入管理员密码"
              value={adminPassword}
              onChange={e => {
                setAdminPassword(e.target.value);
                setAdminError('');
              }}
            />
            {adminError && <p className="login-error">{adminError}</p>}
            <button
              type="button"
              onClick={handleAdminLogin}
              className="login-btn"
              style={{ marginTop: '0.75em', backgroundColor: '#b45309' }}
            >
              管理员登录
            </button>
          </div>
        )}

        {!showAdminInput && <button type="submit" className="login-btn">进入看板</button>}
      </form>
    </div>
  );
}
