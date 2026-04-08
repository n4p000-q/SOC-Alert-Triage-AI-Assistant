import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser, logoutUser, getMe } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);  // true while checking stored session

  // On mount: restore session from localStorage
  useEffect(() => {
    const storedUser  = localStorage.getItem('soc_user');
    const storedToken = localStorage.getItem('soc_token');
    if (storedUser && storedToken) {
      // Verify token is still valid against the backend
      getMe()
        .then(u => setUser(u))
        .catch(() => {
          localStorage.removeItem('soc_token');
          localStorage.removeItem('soc_user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: u } = await loginUser(email, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
