import type { AuthUser, LoginForm } from '../types/auth';
import { EMPLOYEE_ID_RULES, AUTH_STORAGE_KEY, AUTH_REMEMBER_KEY } from '../types/auth';

/**
 * 验证工号格式
 * 规则：8位数字，必须以0开头
 */
export function validateEmployeeId(employeeId: string): { valid: boolean; message: string } {
  // 检查是否为空
  if (!employeeId) {
    return { valid: false, message: '请输入工号' };
  }

  // 检查长度
  if (employeeId.length !== EMPLOYEE_ID_RULES.length) {
    return { valid: false, message: `工号必须为${EMPLOYEE_ID_RULES.length}位数字` };
  }

  // 检查是否以0开头
  if (!employeeId.startsWith(EMPLOYEE_ID_RULES.startsWith)) {
    return { valid: false, message: '工号必须以0开头' };
  }

  // 检查是否全是数字
  if (!/^\d+$/.test(employeeId)) {
    return { valid: false, message: '工号只能包含数字' };
  }

  // 使用正则表达式验证
  if (!EMPLOYEE_ID_RULES.pattern.test(employeeId)) {
    return { valid: false, message: EMPLOYEE_ID_RULES.message };
  }

  return { valid: true, message: '' };
}

/**
 * 验证姓名
 */
export function validateName(name: string): { valid: boolean; message: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, message: '请输入姓名' };
  }

  if (name.trim().length < 2) {
    return { valid: false, message: '姓名至少2个字符' };
  }

  return { valid: true, message: '' };
}

/**
 * 登录验证
 * 如果花名册数据可用，会验证姓名+工号是否匹配
 */
export async function login(form: LoginForm, rosterData?: any[]): Promise<AuthUser> {
  // 验证姓名
  const nameValidation = validateName(form.name);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.message);
  }

  // 验证工号
  const idValidation = validateEmployeeId(form.employeeId);
  if (!idValidation.valid) {
    throw new Error(idValidation.message);
  }

  // 如果提供了花名册数据，进行二次验证
  if (rosterData && rosterData.length > 0) {
    const matched = findEmployeeInRoster(form.name.trim(), form.employeeId, rosterData);
    if (!matched) {
      throw new Error('姓名与工号不匹配，或该员工不在花名册中');
    }
  }

  // 创建用户会话
  const user: AuthUser = {
    name: form.name.trim(),
    employeeId: form.employeeId,
    loginTime: new Date().toISOString(),
    isAuthenticated: true,
  };

  // 保存登录状态
  saveAuthState(user, form.rememberMe);

  return user;
}

/**
 * 在花名册中查找员工
 */
function findEmployeeInRoster(name: string, employeeId: string, rosterData: any[]): boolean {
  // 动态查找列名
  const firstRow = rosterData[0];
  const columns = Object.keys(firstRow);
  
  const nameCol = columns.find(c => 
    c.includes('姓名') || c.includes('名字') || c === 'name' || c === 'Name'
  ) || '姓名';
  
  const idCol = columns.find(c => 
    c.includes('工号') || c.includes('员工ID') || c.includes('编号') || c === 'id' || c === 'ID'
  ) || '工号';

  // 查找匹配的员工
  return rosterData.some(row => {
    const rowName = String(row[nameCol] || '').trim();
    const rowId = String(row[idCol] || '').trim();
    
    // 姓名模糊匹配（包含即可）
    const nameMatch = rowName.includes(name) || name.includes(rowName);
    // 工号精确匹配
    const idMatch = rowId === employeeId;
    
    return nameMatch && idMatch;
  });
}

/**
 * 保存认证状态到本地存储
 */
function saveAuthState(user: AuthUser, rememberMe: boolean): void {
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

/**
 * 获取当前登录用户
 */
export function getCurrentUser(): AuthUser | null {
  try {
    // 先尝试从 localStorage 获取（记住登录）
    const localData = localStorage.getItem(AUTH_STORAGE_KEY);
    if (localData) {
      return JSON.parse(localData);
    }

    // 再尝试从 sessionStorage 获取（会话登录）
    const sessionData = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (sessionData) {
      return JSON.parse(sessionData);
    }

    return null;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
}

/**
 * 检查是否已登录
 */
export function isAuthenticated(): boolean {
  const user = getCurrentUser();
  return user !== null && user.isAuthenticated === true;
}

/**
 * 登出
 */
export function logout(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

/**
 * 清除所有登录状态
 */
export function clearAuth(): void {
  logout();
  localStorage.removeItem(AUTH_REMEMBER_KEY);
  sessionStorage.removeItem(AUTH_REMEMBER_KEY);
}
