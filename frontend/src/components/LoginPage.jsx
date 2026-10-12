import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  LogIn,
  Eye,
  EyeOff,
  Shield,
  Sparkles,
  Users,
  Download,
  Palette,
  Lock,
  HardDrive,
  Layers,
  ArrowRight,
  Loader2
} from 'lucide-react';

/**
 * Pagina di accesso ZenBoard con doppia modalità:
 *
 * 🔐 Premium (Docente): Login con credenziali → accesso completo
 * 🔓 Guest (Ospite): Accesso diretto → lavagna + download PDF
 */
export default function LoginPage() {
  const { login, enterAsGuest, loginError, setLoginError } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState('premium'); // 'premium' | 'guest'

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setLoginError('Inserisci username e password.');
      return;
    }
    setIsLoggingIn(true);
    await login(username.trim(), password.trim());
    setIsLoggingIn(false);
  };

  const premiumFeatures = [
    { icon: HardDrive, label: 'Salvataggio su Google Drive', desc: 'Zero-API Cloud' },
    { icon: Layers, label: 'Gestione Multi-Pagina', desc: 'Crea, duplica, elimina' },
    { icon: Palette, label: 'Tutti gli strumenti', desc: 'Penna, forme, immagini' },
    { icon: Download, label: 'Export PDF', desc: 'Scarica le lezioni' }
  ];

  const guestFeatures = [
    { icon: Palette, label: 'Usa la lavagna', desc: 'Disegna in tempo reale' },
    { icon: Users, label: 'Collaborazione live', desc: 'Vedi le modifiche del docente' },
    { icon: Download, label: 'Scarica PDF', desc: 'Esporta la lezione corrente' }
  ];

  return (
    <div className="login-page">
      {/* Sfondo animato con gradient mesh */}
      <div className="login-bg">
        <div className="login-bg-orb login-bg-orb-1" />
        <div className="login-bg-orb login-bg-orb-2" />
        <div className="login-bg-orb login-bg-orb-3" />
      </div>

      <div className="login-container">
        {/* Logo e Branding */}
        <div className="login-header">
          <div className="login-logo-wrapper">
            <img
              src="/logo.png"
              alt="ZenByte Logo"
              className="login-logo"
            />
            <div className="login-logo-glow" />
          </div>

          <div className="login-brand">
            <h1 className="login-title">
              Zen<span className="login-title-accent">Board</span>
            </h1>
            <p className="login-subtitle">Lavagna Interattiva Collaborativa</p>
          </div>
        </div>

        {/* Tab Switch */}
        <div className="login-tabs">
          <button
            onClick={() => setActiveTab('premium')}
            className={`login-tab ${activeTab === 'premium' ? 'login-tab-active' : ''}`}
          >
            <Shield className="login-tab-icon" />
            <span>Docente Premium</span>
          </button>
          <button
            onClick={() => setActiveTab('guest')}
            className={`login-tab ${activeTab === 'guest' ? 'login-tab-active' : ''}`}
          >
            <Users className="login-tab-icon" />
            <span>Ospite</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="login-content">
          {activeTab === 'premium' ? (
            <>
              {/* Premium Login Form */}
              <form onSubmit={handleLogin} className="login-form">
                <div className="login-field">
                  <label className="login-label">Username</label>
                  <div className="login-input-wrapper">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (loginError) setLoginError('');
                      }}
                      placeholder="docente"
                      className="login-input"
                      autoFocus
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="login-field">
                  <label className="login-label">Password</label>
                  <div className="login-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (loginError) setLoginError('');
                      }}
                      placeholder="••••••••"
                      className="login-input login-input-password"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="login-password-toggle"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div className="login-error">
                    <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="login-submit login-submit-premium"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Accesso in corso...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Accedi come Docente</span>
                      <ArrowRight className="w-4 h-4 ml-auto" />
                    </>
                  )}
                </button>
              </form>

              {/* Premium Features */}
              <div className="login-features">
                <div className="login-features-header">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Funzionalità Premium</span>
                </div>
                <div className="login-features-grid">
                  {premiumFeatures.map((feat, idx) => {
                    const Icon = feat.icon;
                    return (
                      <div key={idx} className="login-feature-item">
                        <div className="login-feature-icon-wrapper login-feature-icon-premium">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="login-feature-label">{feat.label}</p>
                          <p className="login-feature-desc">{feat.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Guest Mode */}
              <div className="login-guest-info">
                <div className="login-guest-icon-wrapper">
                  <Users className="w-8 h-8 text-sky-500" />
                </div>
                <h3 className="login-guest-title">Modalità Ospite</h3>
                <p className="login-guest-desc">
                  Accedi alla lavagna collaborativa senza login.
                  Puoi visualizzare e disegnare in tempo reale, e scaricare la lezione come PDF.
                </p>
              </div>

              {/* Guest Features */}
              <div className="login-features">
                <div className="login-features-header">
                  <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                  <span>Cosa puoi fare</span>
                </div>
                <div className="login-features-list">
                  {guestFeatures.map((feat, idx) => {
                    const Icon = feat.icon;
                    return (
                      <div key={idx} className="login-feature-item">
                        <div className="login-feature-icon-wrapper login-feature-icon-guest">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="login-feature-label">{feat.label}</p>
                          <p className="login-feature-desc">{feat.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={enterAsGuest}
                className="login-submit login-submit-guest"
              >
                <Users className="w-4 h-4" />
                <span>Entra come Ospite</span>
                <ArrowRight className="w-4 h-4 ml-auto" />
              </button>

              <p className="login-guest-note">
                <Lock className="w-3 h-3 inline" /> Il salvataggio su Drive e la gestione pagine richiedono l'accesso Premium.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="login-footer">
          <span>ZenBoard</span>
          <span className="login-footer-sep">•</span>
          <span>by ZenByte</span>
          <span className="login-footer-sep">•</span>
          <span>Lavagna Digitale Collaborativa</span>
        </div>
      </div>
    </div>
  );
}
