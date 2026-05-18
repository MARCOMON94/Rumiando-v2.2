
import { createContext, useContext, useEffect, useState } from 'react';
import { get, post } from '../api/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('rumiando_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('rumiando_token');
  });

  const [loading, setLoading] = useState(Boolean(localStorage.getItem('rumiando_token')));
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadMe() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await get('/auth/me');
        const currentUser = data.user || data.usuario || data;

        setUser(currentUser);
        localStorage.setItem('rumiando_user', JSON.stringify(currentUser));
      } catch (err) {
        localStorage.removeItem('rumiando_token');
        localStorage.removeItem('rumiando_user');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadMe();
  }, [token]);

  async function login(email, password) {
    setLoading(true);
    setError(null);

    try {
      const data = await post('/auth/login', { email, password }, { skipAuth: true });

      const receivedToken = data.token;
      const receivedUser = data.user || data.usuario;

      localStorage.setItem('rumiando_token', receivedToken);
      localStorage.setItem('rumiando_user', JSON.stringify(receivedUser));

      setToken(receivedToken);
      setUser(receivedUser);

      return receivedUser;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('rumiando_token');
    localStorage.removeItem('rumiando_user');
    setToken(null);
    setUser(null);
  }

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: Boolean(token && user),
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}