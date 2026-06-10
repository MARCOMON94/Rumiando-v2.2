import { createContext, useContext, useEffect, useState } from 'react';
import { get, post } from '../api/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadCurrentUser() {
    try {
      const data = await get('/auth/me');
      const currentUser = data.user || data.usuario || data;

      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      return null;
    }
  }

  useEffect(() => {
    async function loadMe() {
      setLoading(true);

      try {
        await loadCurrentUser();
      } finally {
        setLoading(false);
      }
    }

    loadMe();
  }, []);

  async function loginWithGoogle(credential) {
    setLoading(true);
    setError(null);

    try {
      const data = await post('/auth/google', { credential });
      const receivedUser = data.user || data.usuario;

      setUser(receivedUser);
      return receivedUser;
    } catch (err) {
      setError(err.message);
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);
    setError(null);

    try {
      await post('/auth/logout', {});
    } finally {
      setUser(null);
      setLoading(false);
    }
  }

  const value = {
    user,
    loading,
    error,
    isAuthenticated: Boolean(user),
    loginWithGoogle,
    logout,
    refreshUser: loadCurrentUser
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