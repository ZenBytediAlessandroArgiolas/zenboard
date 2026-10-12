import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getBackendUrl } from '../components/Whiteboard';

/**
 * AuthContext gestisce i due livelli di accesso a ZenBoard:
 *
 * 🔓 GUEST (Soft Version):
 *    - Può visualizzare e usare la lavagna in tempo reale
 *    - Può disegnare, usare tutti gli strumenti
 *    - Può scaricare la lavagna come PDF
 *    - NON può salvare/caricare file su Google Drive
 *    - NON può gestire le pagine (aggiungere, duplicare, eliminare)
 *
 * 🔐 PREMIUM (Docente Autenticato):
 *    - Tutte le funzionalità Guest
 *    - Salvataggio su Google Drive (Zero-API Cloud)
 *    - Caricamento lezioni da Google Drive
 *    - Gestione completa delle pagine
 *    - Cambio titolo lezione
 *    - Switch ruolo docente/studente
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = guest, { username, role, displayName } = premium
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState('');

  const backendUrl = getBackendUrl();
  const isPremium = !!user && user.role === 'premium';

  // Controlla se c'è un token salvato nel localStorage al mount
  useEffect(() => {
    const savedToken = localStorage.getItem('zenboard_token');
    const savedUser = localStorage.getItem('zenboard_user');

    if (savedToken && savedUser) {
      // Verifica che il token sia ancora valido
      verifyToken(savedToken, JSON.parse(savedUser));
    } else {
      setIsLoading(false);
    }
  }, []);

  const verifyToken = async (tokenToVerify, savedUserData) => {
    try {
      const response = await fetch(`${backendUrl}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${tokenToVerify}`
        }
      });
      const result = await response.json();

      if (result.success) {
        setUser(result.user);
        setToken(tokenToVerify);
      } else {
        // Token scaduto o invalido: pulisci
        localStorage.removeItem('zenboard_token');
        localStorage.removeItem('zenboard_user');
        setUser(null);
        setToken(null);
      }
    } catch (err) {
      // Backend non raggiungibile: usa i dati salvati in caso di connessione intermittente
      console.warn('[Auth] Backend non raggiungibile per verifica token, uso dati salvati');
      if (savedUserData) {
        setUser(savedUserData);
        setToken(tokenToVerify);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (username, password) => {
    setLoginError('');
    try {
      const response = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const result = await response.json();

      if (result.success) {
        setUser(result.user);
        setToken(result.token);
        localStorage.setItem('zenboard_token', result.token);
        localStorage.setItem('zenboard_user', JSON.stringify(result.user));
        setLoginError('');
        return { success: true };
      } else {
        setLoginError(result.error || 'Credenziali non valide.');
        return { success: false, error: result.error };
      }
    } catch (err) {
      const errorMsg = 'Impossibile contattare il server. Verifica che il backend sia attivo.';
      setLoginError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [backendUrl]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('zenboard_token');
    localStorage.removeItem('zenboard_user');
  }, []);

  const enterAsGuest = useCallback(() => {
    setUser({ username: 'guest', role: 'guest', displayName: 'Ospite' });
    setToken(null);
    setIsLoading(false);
  }, []);

  /**
   * Helper per fetch autenticate: aggiunge automaticamente il Bearer token
   */
  const authFetch = useCallback(async (url, options = {}) => {
    const headers = {
      ...options.headers,
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    // Se il token è scaduto, forza il logout
    if (response.status === 401) {
      const result = await response.json();
      if (result.code === 'TOKEN_INVALID') {
        logout();
      }
    }

    return response;
  }, [token, logout]);

  const value = {
    user,
    token,
    isPremium,
    isGuest: !isPremium,
    isLoading,
    loginError,
    login,
    logout,
    enterAsGuest,
    authFetch,
    setLoginError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve essere usato all\'interno di AuthProvider');
  }
  return context;
}

export default AuthContext;
