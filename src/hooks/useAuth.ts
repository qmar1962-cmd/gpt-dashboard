import { useState } from 'react';

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('gpt_loggedin') === '1');
  const [loggedInUser, setLoggedInUser] = useState<{ name: string; empId: string } | null>(() => {
    const raw = localStorage.getItem('gpt_user');
    if (raw) try { return JSON.parse(raw); } catch (e) { /* ignore */ }
    return null;
  });
  const [isAdminLogin, setIsAdminLogin] = useState(() => localStorage.getItem('gpt_admin') === '1');

  const handleLoginSuccess = (name: string, empId: string, isAdmin: boolean) => {
    localStorage.setItem('gpt_loggedin', '1');
    localStorage.setItem('gpt_user', JSON.stringify({ name, empId }));
    if (isAdmin) {
      localStorage.setItem('gpt_admin', '1');
      setIsAdminLogin(true);
    }
    setLoggedInUser({ name, empId });
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('gpt_loggedin');
    localStorage.removeItem('gpt_user');
    localStorage.removeItem('gpt_admin');
    setLoggedInUser(null);
    setIsLoggedIn(false);
    setIsAdminLogin(false);
  };

  return { isLoggedIn, loggedInUser, isAdminLogin, handleLoginSuccess, handleLogout };
}
