// 用户信息
export interface AuthUser {
  name: string;          // 姓名
  employeeId: string;    // 工号（8位，0开头）
  loginTime: string;     // 登录时间
  isAuthenticated: boolean;
}

// 登录表单
export interface LoginForm {
  name: string;
  employeeId: string;
  rememberMe: boolean;  // 是否记住登录状态
}

// 工号验证规则
export const EMPLOYEE_ID_RULES = {
  length: 8,               // 8位
  startsWith: '0',         // 0开头
  pattern: /^0\d{7}$/,    // 正则表达式
  message: '工号必须为8位数字，且以0开头',
};

// 本地存储的键名
export const AUTH_STORAGE_KEY = 'gpt_dashboard_auth';
export const AUTH_REMEMBER_KEY = 'gpt_dashboard_remember';
