import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
axios.defaults.baseURL = API;
axios.defaults.withCredentials = true;

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

function OfflineBanner({ show }) {
  if (!show) return null;
  return (
    <div style={{
      position:        'fixed',
      top:             0,
      left:            0,
      right:           0,
      zIndex:          9999,
      background:      '#1a1a1a',
      borderBottom:    '1px solid rgba(255,159,67,.35)',
      color:           '#ff9f43',
      fontSize:        '.82rem',
      fontWeight:      600,
      padding:         '10px 16px',
      textAlign:       'center',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      gap:             8,
      letterSpacing:   '.01em',
    }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <line x1="12" y1="20" x2="12.01" y2="20"/>
      </svg>
      No internet connection — some features may be unavailable
    </div>
  );
}

export function AppProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => localStorage.getItem('cf_token'));
  const [loading, setLoading] = useState(true);
  const [toasts,  setToasts]  = useState([]);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const toastId = useRef(0);

  const [showLogin,    setShowLogin]    = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const openLogin    = useCallback(() => { setShowRegister(false); setShowLogin(true);    }, []);
  const openRegister = useCallback(() => { setShowLogin(false);    setShowRegister(true); }, []);

  const [showPayment, setShowPayment] = useState(false);
  const openPayment = useCallback(() => setShowPayment(true), []);

  useEffect(() => {
    const goOnline  = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    const ping = () => fetch(`${API}/api/health`).catch(() => {});
    ping();
    const interval = setInterval(ping, 14 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('cf_token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('cf_token');
    }
  }, [token]);

  const refreshAccessToken = useCallback(async () => {
    try {
      const { data } = await axios.post('/api/users/refresh', {}, { withCredentials: true });
      setToken(data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      return data.token;
    } catch {
      setToken(null);
      setUser(null);
      return null;
    }
  }, []);

useEffect(() => {
  let isRefreshing = false;
  let pendingQueue = [];

  const flush = (newToken) => {
    pendingQueue.forEach(({ resolve }) => resolve(newToken));
    pendingQueue = [];
  };

  const interceptor = axios.interceptors.response.use(
    res => res,
    async (error) => {
      const original = error.config;


      if (original?._skipAuthRetry) return Promise.reject(error);

      const url = original?.url || '';
      const SKIP_PATHS = [
        '/refresh', '/login', '/verify-email', '/reset-password',
        '/forgot-password', '/verify-otp', '/admin-login',
      ];

      if (
        error.response?.status === 401 &&
        !original._retry &&
        !SKIP_PATHS.some(p => url.includes(p))
      ) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            pendingQueue.push({
              resolve: (newToken) => {
                original.headers['Authorization'] = `Bearer ${newToken}`;
                resolve(axios(original));
              },
              reject,
            });
          });
        }
        original._retry = true;
        isRefreshing = true;
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        if (newToken) {
          flush(newToken);
          original.headers['Authorization'] = `Bearer ${newToken}`;
          return axios(original);
        } else {
          flush(null);
          return Promise.reject(error);
        }
      }
      return Promise.reject(error);
    }
  );

  return () => axios.interceptors.response.eject(interceptor);
}, [refreshAccessToken]);

  const oauthLogin = useCallback(async (profile) => {
    const { data } = await axios.post('/api/users/oauth', profile, { withCredentials: true });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  useEffect(() => {
    const restore = async () => {
      const saved = localStorage.getItem('cf_token');

      if (!saved) {
        setLoading(false);
        try {
          const { data } = await axios.post('/api/users/refresh', {}, { withCredentials: true });
          setToken(data.token);
          axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
          const { data: me } = await axios.get('/api/users/me');
          setUser(me);
        } catch {

        }
        return;
      }

      try {
        axios.defaults.headers.common['Authorization'] = `Bearer ${saved}`;
        const { data } = await axios.get('/api/users/me');
        setUser(data);
        setToken(saved);
        setLoading(false);
        return;
      } catch (err) {
        if (err.response?.status !== 401) {
          localStorage.removeItem('cf_token');
          setToken(null);
          setLoading(false);
          return;
        }
      }

      try {
        const { data } = await axios.post('/api/users/refresh', {}, { withCredentials: true });
        setToken(data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        const { data: me } = await axios.get('/api/users/me');
        setUser(me);
      } catch {
        localStorage.removeItem('cf_token');
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    restore();
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await axios.post('/api/users/login', { email, password }, { withCredentials: true });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { data } = await axios.post('/api/users/register', { name, email, password });
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post('/api/users/logout', {}, { withCredentials: true });
    } catch {}
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  }, []);





  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('cf_token');
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/users/me');
      setUser(data);
    } catch {}
  }, []);

  const updateUserLocal = useCallback((patch) => {
    setUser(prev => prev ? { ...prev, ...patch } : prev);
  }, []);

  const setSession = useCallback((token, user) => {
    setToken(token);
    setUser(user);
  }, []);

  const toast = useCallback((message, type = 'info') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const getRatingTitle = (r) => {
    if (r < 400)  return 'Beginner';
    if (r < 800)  return 'Coder';
    if (r < 1200) return 'Problem Solver';
    if (r < 1600) return 'Algorithmist';
    if (r < 2000) return 'Code Expert';
    if (r < 2400) return 'Senior Algorithmist';
    if (r < 2800) return 'Elite Programmer';
    return 'Legendary Coder';
  };

  const diffBadge = (d) =>
    d === 'Easy' ? 'badge-easy' : d === 'Medium' ? 'badge-medium' : 'badge-hard';

  return (
    <AppContext.Provider value={{
      user, token, loading, offline,
      login, register, oauthLogin, logout, clearSession, refreshUser, updateUserLocal, setSession,
      toast, toasts,
      getRatingTitle, diffBadge,
      API,
      showLogin,    setShowLogin,    openLogin,
      showRegister, setShowRegister, openRegister,
      showPayment,  setShowPayment,  openPayment,
    }}>
      <OfflineBanner show={offline} />
      {children}

      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'warning' ? '⚠' : 'ℹ'}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
