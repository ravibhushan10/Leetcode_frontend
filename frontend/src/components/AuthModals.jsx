import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../hooks/useAuth.js';
import styles from './AuthModals.module.css';


export default function AuthModals({
  showLogin, onCloseLogin,
  showRegister, onCloseRegister,
  onSwitchToRegister, onSwitchToLogin,
}) {
  return (
    <>
      {showLogin    && <LoginModal    onClose={onCloseLogin}    onSwitch={onSwitchToRegister} />}
      {showRegister && <RegisterModal onClose={onCloseRegister} onSwitch={onSwitchToLogin}    />}
    </>
  );
}


function EyeOpen() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function EyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h12.4c-.5 2.9-2.2 5.3-4.6 6.9v5.7h7.5c4.4-4 6.8-10 6.8-16.7z"/>
      <path fill="#34A853" d="M24 47c6.2 0 11.4-2.1 15.2-5.6l-7.5-5.7c-2 1.4-4.6 2.2-7.7 2.2-5.9 0-10.9-4-12.7-9.4H3.5v5.9C7.3 41.7 15 47 24 47z"/>
      <path fill="#FBBC05" d="M11.3 28.5c-.5-1.4-.7-2.9-.7-4.5s.3-3.1.7-4.5v-5.9H3.5C1.3 17.6 0 20.7 0 24s1.3 6.4 3.5 8.4l7.8-3.9z"/>
      <path fill="#EA4335" d="M24 9.5c3.3 0 6.3 1.1 8.6 3.4l6.4-6.4C35.4 2.8 30.2.5 24 .5 15 .5 7.3 5.8 3.5 13.6l7.8 5.9C13.1 13.5 18.1 9.5 24 9.5z"/>
    </svg>
  );
}
function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 5.3 3.4 9.8 8.2 11.4.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.7 18 5 18 5c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6C20.6 21.8 24 17.3 24 12 24 5.4 18.6 0 12 0z"/>
    </svg>
  );
}


function Banner({ error, onGoogle, onGitHub, onSwitchToRegister, onSwitchToLogin }) {
  if (!error) return null;
  const cls = error.code === 'RATE_LIMITED' ? styles.bannerWarning : styles.bannerError;
  return (
    <div className={`${styles.banner} ${cls}`}>
      <p className={styles.bannerMsg}>{error.message}</p>
      {error.hint === 'google' && (
        <button type="button" className={styles.hintBtn} onClick={onGoogle}>Continue with Google →</button>
      )}
      {error.hint === 'github' && (
        <button type="button" className={styles.hintBtn} onClick={onGitHub}>Continue with GitHub →</button>
      )}
      {error.hint === 'login' && (
        <button type="button" className={styles.hintBtn} onClick={onSwitchToLogin}>Sign in instead →</button>
      )}
      {error.hint === 'register' && (
        <button type="button" className={styles.hintBtn} onClick={onSwitchToRegister}>Create an account →</button>
      )}
      {error.action && (
        <button type="button" className={styles.hintBtn} onClick={error.action.fn}>{error.action.label} →</button>
      )}
    </div>
  );
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className={styles.fieldHintError}>{msg}</p>;
}

const PWD_RULES = [
  { key: 'len',     label: 'At least 8 characters',        test: p => p.length >= 8 },
  { key: 'upper',   label: 'At least 1 uppercase letter',  test: p => /[A-Z]/.test(p) },
  { key: 'lower',   label: 'At least 1 lowercase letter',  test: p => /[a-z]/.test(p) },
  { key: 'number',  label: 'At least 1 number',            test: p => /\d/.test(p) },
  { key: 'special', label: 'At least 1 special character', test: p => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

function isStrongPassword(p) { return PWD_RULES.every(r => r.test(p)); }

function PasswordChecklist({ password, showErrors }) {
  return (
    <ul className={styles.checklist}>
      {PWD_RULES.map(r => {
        const met = r.test(password);
        return (
          <li key={r.key} className={met ? styles.checkMet : showErrors ? styles.checkFail : styles.checkUnmet}>
            {met ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : showErrors ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <span className={styles.checkDot} />
            )}
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;


function OtpInput({ otp, setOtp, otpError, otpRefs }) {
  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp]; next[i] = val; setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  };
  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace'  && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft'  && i > 0)             otpRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5)             otpRefs.current[i + 1]?.focus();
  };
  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) { setOtp(pasted.split('')); otpRefs.current[5]?.focus(); e.preventDefault(); }
  };
  return (
    <div className={styles.otpRow} onPaste={handlePaste}>
      {otp.map((digit, i) => (
        <input key={i} ref={el => otpRefs.current[i] = el}
          className={`${styles.otpBox} ${otpError ? styles.otpBoxError : ''}`}
          type="text" inputMode="numeric" maxLength={1}
          value={digit}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}


function CooldownGate({ secondsLeft, onReady, onClose }) {
  const [remaining, setRemaining] = useState(secondsLeft);

  useEffect(() => {
    if (remaining <= 0) { onReady(); return; }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onReady]);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ textAlign: 'center' }}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          border: '3px solid var(--green)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '8px auto 20px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>

        <h2 style={{ marginBottom: 8 }}>Please wait</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '.875rem', marginBottom: 20 }}>
          A code was recently sent. You can request a new one in:
        </p>

        <div style={{
          fontSize: '2.2rem', fontWeight: 800,
          fontFamily: 'var(--font-mono)',
          color: 'var(--green)', marginBottom: 24,
          letterSpacing: '.05em',
        }}>
          {remaining}s
        </div>
      </div>
    </div>
  );
}

function ResendHint({ resendCooldown }) {
  if (resendCooldown <= 0) return null;
  return (
    <p style={{ textAlign: 'center', fontSize: '.78rem', color: 'var(--text-muted)', marginTop: 8 }}>
      Resend available in <strong style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>{resendCooldown}s</strong>
    </p>
  );
}


function LoginModal({ onClose, onSwitch }) {

  const { login, toast, clearSession }       = useApp();
  const { loginWithGoogle, loginWithGitHub } = useAuth();
  const navigate = useNavigate();

  const [screen, setScreen] = useState('login');

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [oauthError,  setOauthError]  = useState(null);
  const [serverError, setServerError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const [needsVerify,    setNeedsVerify]    = useState(false);
  const [resendEmail,    setResendEmail]    = useState('');
  const [resendLoading,  setResendLoading]  = useState(false);
  const [resendDone,     setResendDone]     = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);


  const [fpEmail,    setFpEmail]    = useState('');
  const [fpLoading,  setFpLoading]  = useState(false);
  const [fpError,    setFpError]    = useState('');
  const [fpCooldown, setFpCooldown] = useState(0);


  const [otp,               setOtp]              = useState(['', '', '', '', '', '']);
  const [otpLoading,        setOtpLoading]        = useState(false);
  const [otpError,          setOtpError]          = useState('');
  const [otpExpiry,         setOtpExpiry]         = useState(null);
  const [otpCountdown,      setOtpCountdown]      = useState(0);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const otpRefs = useRef([]);

  
  const [gateCooldown, setGateCooldown] = useState(0);


  const [resetToken,    setResetToken]    = useState('');
  const [newPwd,        setNewPwd]        = useState('');
  const [newPwdShow,    setNewPwdShow]    = useState(false);
  const [newPwdFocused, setNewPwdFocused] = useState(false);
  const [newPwdErrors,  setNewPwdErrors]  = useState(false);
  const [newPwdLoading, setNewPwdLoading] = useState(false);
  const [newPwdError,   setNewPwdError]   = useState('');


  useEffect(() => {
    if (screen !== 'otp' || !otpExpiry) return;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((otpExpiry - Date.now()) / 1000));
      setOtpCountdown(left);
      if (left === 0) { setOtpResendCooldown(0); clearInterval(interval); }
    }, 1000);
    return () => clearInterval(interval);
  }, [screen, otpExpiry]);

  useEffect(() => {
    if (fpCooldown <= 0) return;
    const t = setTimeout(() => setFpCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [fpCooldown]);

  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const t = setTimeout(() => setOtpResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpResendCooldown]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const clearAll = () => {
    setOauthError(null); setServerError(null); setFieldErrors({});
    setNeedsVerify(false); setResendDone(false);
  };

  const validateLogin = () => {
    if (!email.trim())            return { email: 'Email address is required.' };
    if (!EMAIL_REGEX.test(email)) return { email: 'Please enter a valid email address.' };
    if (!password)                return { password: 'Password is required.' };
    return {};
  };

  const submit = async (e) => {
    e.preventDefault(); clearAll();
    const errs = validateLogin();
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setLoading(true);
    try {
      const u = await login(email, password);
      toast(`Welcome back, ${u.name.split(' ')[0]}!`, 'success');
      onClose(); navigate('/problems');
    } catch (err) {
      const code        = err.response?.data?.code;
      const msg         = err.response?.data?.error || 'Login failed. Please try again.';
      const secondsLeft = err.response?.data?.secondsLeft || 0;

      if (code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerify(true);
        setResendEmail(email);
        setResendCooldown(secondsLeft);
        setServerError({ message: msg, code });
      } else if (code === 'USE_GOOGLE') {
        setOauthError({ message: msg, code, hint: 'google' });
      } else if (code === 'USE_GITHUB') {
        setOauthError({ message: msg, code, hint: 'github' });
      } else if (code === 'USER_NOT_FOUND') {
        setServerError({ message: 'No account found with this email.', code, hint: 'register' });
      } else if (code === 'WRONG_PASSWORD') {
        setFieldErrors({ password: msg });
      } else {
        setServerError({ message: msg, code });
      }
    } finally { setLoading(false); }
  };

  const handleResendVerification = async () => {
    setResendLoading(true); setResendDone(false);
    try {
      await axios.post('/api/users/resend-verify-otp', { email: resendEmail });
      setResendDone(true);
      setResendCooldown(120);
    } catch (err) {
      const secondsLeft = err.response?.data?.secondsLeft;
      if (secondsLeft) setResendCooldown(secondsLeft);
      setServerError({ message: err.response?.data?.error || 'Failed to resend. Please try again.' });
    } finally { setResendLoading(false); }
  };

  const handleGoogle = async () => {
    clearAll();
    try {
      const u = await loginWithGoogle();
      if (!u) return;
      toast(`Welcome back, ${u.name.split(' ')[0]}!`, 'success');
      onClose(); navigate('/problems');
    } catch (err) {
      setOauthError({ message: err.friendlyMessage || 'Google sign-in failed. Please try again.' });
    }
  };

  const handleGitHub = async () => {
    clearAll();
    try {
      const u = await loginWithGitHub();
      if (!u) return;
      toast(`Welcome back, ${u.name.split(' ')[0]}!`, 'success');
      onClose(); navigate('/problems');
    } catch (err) {
      setOauthError({ message: err.friendlyMessage || 'GitHub sign-in failed. Please try again.' });
    }
  };

  const goToForgotEmail = (prefillEmail = '') => {
    setFpEmail(prefillEmail || email);
    setFpError('');
    setScreen('forgotEmail');
  };

  const sendResetOtp = async (isResend = false) => {
    setFpError(''); setFpLoading(true);
    try {
      await axios.post('/api/users/forgot-password', { email: fpEmail });
      setOtpExpiry(Date.now() + 2 * 60 * 1000);
      setOtpCountdown(120);
      setOtpResendCooldown(120);
      setOtp(['', '', '', '', '', '']);
      setOtpError('');
      if (!isResend) setScreen('otp');
      else setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      const code        = err.response?.data?.code;
      const secondsLeft = err.response?.data?.secondsLeft || 120;
      if (code === 'OTP_COOLDOWN') {
        setGateCooldown(secondsLeft);
        setScreen('gate');
      } else {
        const msg = err.response?.data?.error || 'Failed to send code. Please try again.';
        if (isResend) setOtpError(msg);
        else setFpError(msg);
      }
    } finally { setFpLoading(false); }
  };

  const verifyResetOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) return setOtpError('Please enter all 6 digits.');
    if (otpCountdown === 0) return setOtpError('Code expired. Please request a new one.');
    setOtpLoading(true); setOtpError('');
    try {
      const { data } = await axios.post('/api/users/verify-otp', { email: fpEmail, otp: code });
      setResetToken(data.resetToken);
      setScreen('newPwd');
    } catch (err) {
      const errCode = err.response?.data?.code;
      setOtpError(err.response?.data?.error || 'Invalid code. Please try again.');
      if (errCode === 'OTP_LOCKED') { setOtp(['', '', '', '', '', '']); setOtpCountdown(0); }
    } finally { setOtpLoading(false); }
  };





  const resetPassword = async () => {
  setNewPwdErrors(true);
  if (!isStrongPassword(newPwd)) return;
  setNewPwdLoading(true); setNewPwdError('');



  clearSession();

  try {
    await axios.post(
      '/api/users/reset-password',
      { resetToken, password: newPwd },
      { _skipAuthRetry: true }
    );
    setScreen('success');
  } catch (err) {


    setNewPwdError(err.response?.data?.error || 'Failed to reset. Please try again.');
  } finally {
    setNewPwdLoading(false);
  }
};


  if (screen === 'gate') return (
    <CooldownGate
      secondsLeft={gateCooldown}
      onClose={onClose}
      onReady={() => {
        setGateCooldown(0);
        setFpError('');
        setOtp(['', '', '', '', '', '']);
        setOtpError('');
        setScreen('forgotEmail');
      }}
    />
  );


  if (screen === 'login') return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 style={{ marginBottom: 4 }}>Welcome back</h2>
        <p style={{ marginBottom: 24, color: 'var(--text-secondary)', fontSize: '.875rem' }}>
          Sign in to continue your journey
        </p>

        <form onSubmit={submit} noValidate>
          <div className={styles.field}>
            <label>Email <span className={styles.required}>*</span></label>
            <input
              className={`input ${fieldErrors.email ? styles.inputError : ''}`}
              type="email" placeholder="you@example.com" value={email}
              onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })); setServerError(null); setNeedsVerify(false); }}
              autoComplete="email"
            />
            <FieldError msg={fieldErrors.email} />
          </div>

          <div className={styles.field}>
            <label>Password <span className={styles.required}>*</span></label>
            <div className={styles.pwdWrap}>
              <input
                className={`input ${fieldErrors.password ? styles.inputError : ''}`}
                type={showPwd ? 'text' : 'password'}
                placeholder="Your password" value={password}
                onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: '' })); setServerError(null); }}
                autoComplete="current-password"
              />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPwd(p => !p)}>
                {showPwd ? <EyeOff /> : <EyeOpen />}
              </button>
            </div>
            <FieldError msg={fieldErrors.password} />
            <button type="button" className={styles.forgotLink}
              onClick={() => goToForgotEmail(email)}>
              Forgot password?
            </button>
          </div>

          {needsVerify && (
            <div className={`${styles.banner} ${styles.bannerWarning}`} style={{ marginBottom: 12 }}>
              <p className={styles.bannerMsg}>{serverError?.message}</p>
              {resendDone ? (
                <p style={{ marginTop: 6, fontSize: '.8rem' }}>✓ New code sent! Check your inbox.</p>
              ) : (
                <button type="button" className={styles.hintBtn}
                  onClick={handleResendVerification}
                  disabled={resendLoading || resendCooldown > 0}>
                  {resendLoading ? 'Sending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification code'}
                </button>
              )}
            </div>
          )}

          {serverError && !needsVerify && (
            <Banner
              error={serverError}
              onGoogle={handleGoogle}
              onGitHub={handleGitHub}
              onSwitchToLogin={onSwitch}
              onSwitchToRegister={onSwitch}
            />
          )}

          <button type="submit" className="btn btn-primary w-full"
            style={{ justifyContent: 'center', marginTop: 8 }} disabled={loading}>
            {loading ? <><span className="spinner" /> Signing in…</> : 'Sign In'}
          </button>
        </form>

        <div className={styles.orDivider}><span>or</span></div>
        <button className="social-btn" onClick={handleGoogle}><GoogleIcon /> Continue with Google</button>
        <button className="social-btn" onClick={handleGitHub}><GitHubIcon /> Continue with GitHub</button>

        {oauthError && (
          <Banner
            error={oauthError}
            onGoogle={handleGoogle}
            onGitHub={handleGitHub}
            onSwitchToLogin={onSwitch}
            onSwitchToRegister={onSwitch}
          />
        )}

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: '.83rem' }}>
          Don't have an account? <button className={styles.switchBtn} onClick={onSwitch}>Sign up</button>
        </p>
      </div>
    </div>
  );


  if (screen === 'forgotEmail') return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <button type="button" className={styles.backBtn} onClick={() => setScreen('login')}>Back</button>
        <h2 style={{ marginBottom: 4, marginTop: 12 }}>Reset your password</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '.875rem', marginBottom: 24 }}>
          Enter your email and we'll send a 6-digit code.
        </p>

        <div className={styles.field}>
          <label>Email <span className={styles.required}>*</span></label>
          <input
            className="input"
            type="email" placeholder="you@example.com" value={fpEmail}
            onChange={e => { setFpEmail(e.target.value); setFpError(''); }}
            autoFocus
          />
        </div>

        {fpError && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <p className={styles.bannerMsg}>{fpError}</p>
          </div>
        )}

        <button className="btn btn-primary w-full"
          style={{ justifyContent: 'center', marginTop: 8 }}
          onClick={() => sendResetOtp(false)}
          disabled={fpLoading || !fpEmail.trim() || fpCooldown > 0}>
          {fpLoading
            ? <><span className="spinner" /> Sending…</>
            : fpCooldown > 0 ? `Resend in ${fpCooldown}s` : 'Send Reset Code'}
        </button>
      </div>
    </div>
  );


  if (screen === 'otp') return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <button type="button" className={styles.backBtn}
          onClick={() => { setScreen('forgotEmail'); setOtp(['','','','','','']); setOtpError(''); }}>
          Back
        </button>
        <h2 style={{ marginBottom: 4, marginTop: 12 }}>Enter reset code</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '.875rem', marginBottom: 6 }}>Code sent to</p>
        <p style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: 24 }}>{fpEmail}</p>

        <OtpInput otp={otp} setOtp={v => { setOtp(v); setOtpError(''); }} otpError={otpError} otpRefs={otpRefs} />

        {otpCountdown > 0 && <ResendHint resendCooldown={otpResendCooldown} />}

        {otpError && (
          <div className={`${styles.banner} ${styles.bannerError}`} style={{ marginTop: 8 }}>
            <p className={styles.bannerMsg}>{otpError}</p>
          </div>
        )}

        {otpCountdown === 0 && otpExpiry !== null ? (
          <>
            <p style={{ textAlign: 'center', fontSize: '.8rem', color: 'var(--text-muted)', marginTop: 12, marginBottom: 4 }}>
              Code expired.
            </p>
            <button className="btn btn-primary w-full"
              style={{ justifyContent: 'center', marginTop: 8 }}
              onClick={() => sendResetOtp(true)}
              disabled={fpLoading}>
              {fpLoading ? <><span className="spinner" /> Sending…</> : 'Resend OTP'}
            </button>
          </>
        ) : (
          <button className="btn btn-primary w-full"
            style={{ justifyContent: 'center', marginTop: 16 }}
            onClick={verifyResetOtp}
            disabled={otpLoading || otp.join('').length < 6}>
            {otpLoading ? <><span className="spinner" /> Verifying…</> : 'Verify Code'}
          </button>
        )}
      </div>
    </div>
  );


  if (screen === 'newPwd') return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 style={{ marginBottom: 4 }}>Set new password</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '.875rem', marginBottom: 24 }}>
          Choose a strong password for your account.
        </p>

        <div className={styles.field}>
          <label>New Password <span className={styles.required}>*</span></label>
          <div className={styles.pwdWrap}>
            <input
              className="input"
              type={newPwdShow ? 'text' : 'password'}
              placeholder="Min 8 characters" value={newPwd}
              onChange={e => { setNewPwd(e.target.value); setNewPwdError(''); }}
              onFocus={() => setNewPwdFocused(true)}
              onBlur={() => setNewPwdFocused(false)}
              autoFocus
            />
            <button type="button" className={styles.eyeBtn} onClick={() => setNewPwdShow(p => !p)}>
              {newPwdShow ? <EyeOff /> : <EyeOpen />}
            </button>
          </div>
          {newPwdFocused && <PasswordChecklist password={newPwd} showErrors={newPwdErrors} />}
        </div>

        {newPwdError && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <p className={styles.bannerMsg}>{newPwdError}</p>
          </div>
        )}

        <button className="btn btn-primary w-full"
          style={{ justifyContent: 'center', marginTop: 8 }}
          onClick={resetPassword}
          disabled={newPwdLoading}>
          {newPwdLoading ? <><span className="spinner" /> Saving…</> : 'Save New Password'}
        </button>
      </div>
    </div>
  );


  if (screen === 'success') return (
    <div className="modal-overlay">
      <div className="modal" style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <div className={styles.successIcon}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 style={{ marginBottom: 8 }}>Password reset!</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem', marginBottom: 28 }}>
          Your password has been updated. Sign in with your new password.
        </p>
        <button className="btn btn-primary w-full"
          style={{ justifyContent: 'center' }}
          onClick={() => {
            setNewPwd(''); setResetToken(''); setOtp(['', '', '', '', '', '']);
            setOtpError(''); setNewPwdError(''); setFpError('');
            setOtpCountdown(0); setOtpExpiry(null); setOtpResendCooldown(0);
            setEmail(fpEmail); setPassword(''); setServerError(null);
            setScreen('login');
          }}>
          Sign In
        </button>
      </div>
    </div>
  );

  return null;
}


function RegisterModal({ onClose, onSwitch }) {
  const { register, toast, setSession } = useApp();
  const { loginWithGoogle, loginWithGitHub } = useAuth();
  const navigate = useNavigate();

  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdFocused,  setPwdFocused]  = useState(false);
  const [pwdErrors,   setPwdErrors]   = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [oauthError,  setOauthError]  = useState(null);
  const [serverError, setServerError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const [registered,     setRegistered]     = useState(false);
  const [regEmail,       setRegEmail]       = useState('');
  const [otp,            setOtp]            = useState(['','','','','','']);
  const [otpLoading,     setOtpLoading]     = useState(false);
  const [otpError,       setOtpError]       = useState('');
  const [otpExpiry,      setOtpExpiry]      = useState(null);
  const [otpCountdown,   setOtpCountdown]   = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading,  setResendLoading]  = useState(false);
  const [resendDone,     setResendDone]     = useState(false);


  const [showGate,     setShowGate]     = useState(false);
  const [gateCooldown, setGateCooldown] = useState(0);

  const otpRefs = useRef([]);

  const clearAll = () => { setOauthError(null); setServerError(null); setFieldErrors({}); };


  useEffect(() => {
    if (!registered || !otpExpiry) return;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((otpExpiry - Date.now()) / 1000));
      setOtpCountdown(left);
      if (left === 0) { setResendCooldown(0); clearInterval(interval); }
    }, 1000);
    return () => clearInterval(interval);
  }, [registered, otpExpiry]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const verifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) return setOtpError('Please enter all 6 digits.');
    if (otpCountdown === 0) return setOtpError('Code expired. Please request a new one.');
    setOtpLoading(true); setOtpError('');
    try {
      const { data } = await axios.post('/api/users/verify-otp-register', { email: regEmail, otp: code });
      localStorage.setItem('cf_token', data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      setSession(data.token, data.user);
      toast(`Welcome to CodeForge, ${data.user.name.split(' ')[0]}!`, 'success');
      onClose();
      navigate('/problems');
    } catch (err) {
      const errCode = err.response?.data?.code;
      setOtpError(err.response?.data?.error || 'Invalid code. Please try again.');
      if (errCode === 'OTP_LOCKED') { setOtp(['','','','','','']); setOtpCountdown(0); }
    } finally { setOtpLoading(false); }
  };

  const resendOtp = async () => {
    setResendLoading(true); setOtpError(''); setResendDone(false);
    try {
      await axios.post('/api/users/resend-verify-otp', { email: regEmail });
      setOtp(['','','','','','']);
      setOtpExpiry(Date.now() + 2 * 60 * 1000);
      setOtpCountdown(120);
      setResendCooldown(120);
      setResendDone(true);
      setTimeout(() => setResendDone(false), 4000);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      const code        = err.response?.data?.code;
      const secondsLeft = err.response?.data?.secondsLeft;
      if (code === 'OTP_COOLDOWN' && secondsLeft) {
        setGateCooldown(secondsLeft);
        setShowGate(true);
      } else {
        setOtpError(err.response?.data?.error || 'Failed to resend. Please try again.');
      }
    } finally { setResendLoading(false); }
  };

  const validateRegister = () => {
    if (!name.trim())                return { name: 'Full name is required.' };
    if (name.trim().length < 2)      return { name: 'Name must be at least 2 characters.' };
    if (!email.trim())               return { email: 'Email address is required.' };
    if (!EMAIL_REGEX.test(email))    return { email: 'Please enter a valid email address.' };
    if (!password)                   return { password: 'Password is required.' };
    if (!isStrongPassword(password)) return { password: 'Please use a stronger password.' };
    if (!confirm)                    return { confirm: 'Please confirm your password.' };
    if (password !== confirm)        return { confirm: "Passwords don't match." };
    return {};
  };

  const submit = async (e) => {
    e.preventDefault(); clearAll();
    const errs = validateRegister();
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      if (errs.password) { setPwdErrors(true); setPwdFocused(true); }
      return;
    }
    setLoading(true);
    try {
      const data = await register(name.trim(), email.trim(), password);
      setRegEmail(data.email || email.trim());
      setOtpExpiry(Date.now() + 2 * 60 * 1000);
      setOtpCountdown(120);
      setResendCooldown(120);
      setRegistered(true);
    } catch (err) {
      const code        = err.response?.data?.code;
      const msg         = err.response?.data?.error || 'Network error. Please check your internet connection and try again.';
      const secondsLeft = err.response?.data?.secondsLeft || 0;

      if (code === 'UNVERIFIED_EXISTS') {
        setRegEmail(err.response.data.email || email.trim());
        if (secondsLeft > 0) {
          setGateCooldown(secondsLeft);
          setShowGate(true);
          setRegistered(true);
        } else {
          setOtpExpiry(Date.now() + 2 * 60 * 1000);
          setOtpCountdown(120);
          setResendCooldown(120);
          setRegistered(true);
          setOtpError('');
        }
      } else if (code === 'EMAIL_TAKEN') {
        setServerError({ message: msg, code, hint: 'login' });
      } else if (code === 'USE_OAUTH') {
        const provider = err.response?.data?.provider;
        setOauthError({ message: msg, hint: provider || null });
      } else {
        setServerError({ message: msg });
      }
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    clearAll();
    try {
      const u = await loginWithGoogle();
      if (!u) return;
      toast(`Welcome to CodeForge, ${u.name.split(' ')[0]}!`, 'success');
      onClose(); navigate('/problems');
    } catch (err) {
      setOauthError({ message: err.friendlyMessage || 'Google sign-up failed. Please try again.' });
    }
  };

  const handleGitHub = async () => {
    clearAll();
    try {
      const u = await loginWithGitHub();
      if (!u) return;
      toast(`Welcome to CodeForge, ${u.name.split(' ')[0]}!`, 'success');
      onClose(); navigate('/problems');
    } catch (err) {
      setOauthError({ message: err.friendlyMessage || 'GitHub sign-up failed. Please try again.' });
    }
  };


  if (showGate) return (
    <CooldownGate
      secondsLeft={gateCooldown}
      onClose={onClose}
      onReady={() => {
        setShowGate(false);
        setGateCooldown(0);
        setRegistered(false);
        setOtp(['','','','','','']);
        setOtpError('');
      }}
    />
  );


  if (registered) return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <button type="button" className={styles.backBtn}
          onClick={() => { setRegistered(false); setOtp(['','','','','','']); setOtpError(''); }}>
          Back
        </button>
        <h2 style={{ marginBottom: 4, marginTop: 12 }}>Verify your email</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '.875rem', marginBottom: 6 }}>
          We sent a 6-digit code to
        </p>
        <p style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: 24 }}>{regEmail}</p>

        <OtpInput otp={otp} setOtp={v => { setOtp(v); setOtpError(''); }} otpError={otpError} otpRefs={otpRefs} />

        {otpCountdown > 0 && <ResendHint resendCooldown={resendCooldown} />}

        {resendDone && (
          <div className={`${styles.banner} ${styles.bannerSuccess}`} style={{ marginTop: 8 }}>
            <p className={styles.bannerMsg}>✓ New code sent! Check your inbox.</p>
          </div>
        )}
        {otpError && (
          <div className={`${styles.banner} ${styles.bannerError}`} style={{ marginTop: 8 }}>
            <p className={styles.bannerMsg}>{otpError}</p>
          </div>
        )}

        {otpCountdown === 0 && otpExpiry !== null ? (
          <>
            <p style={{ textAlign: 'center', fontSize: '.8rem', color: 'var(--text-muted)', marginTop: 12, marginBottom: 4 }}>
              Code expired.
            </p>
            <button className="btn btn-primary w-full"
              style={{ justifyContent: 'center', marginTop: 8 }}
              onClick={resendOtp}
              disabled={resendLoading}>
              {resendLoading ? <><span className="spinner" /> Sending…</> : 'Resend OTP'}
            </button>
          </>
        ) : (
          <button className="btn btn-primary w-full"
            style={{ justifyContent: 'center', marginTop: 16 }}
            onClick={verifyOtp}
            disabled={otpLoading || otp.join('').length < 6}>
            {otpLoading ? <><span className="spinner" /> Verifying…</> : 'Verify & Create Account'}
          </button>
        )}

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: '.8rem', color: 'var(--text-secondary)' }}>
          Wrong email?{' '}
          <button className={styles.switchBtn}
            onClick={() => { setRegistered(false); setOtp(['','','','','','']); setOtpError(''); }}>
            Go back
          </button>
        </p>
      </div>
    </div>
  );


  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 style={{ marginBottom: 4 }}>Join CodeForge</h2>
        <p style={{ marginBottom: 24, color: 'var(--text-secondary)', fontSize: '.875rem' }}>
          Start solving, learning and competing
        </p>

        <form onSubmit={submit} noValidate>
          <div className={styles.field}>
            <label>Full Name <span className={styles.required}>*</span></label>
            <input
              className={`input ${fieldErrors.name ? styles.inputError : ''}`}
              placeholder="Ravi Kumar" value={name}
              onChange={e => { setName(e.target.value); setFieldErrors(p => ({ ...p, name: '' })); setServerError(null); }}
            />
            <FieldError msg={fieldErrors.name} />
          </div>

          <div className={styles.field}>
            <label>Email <span className={styles.required}>*</span></label>
            <input
              className={`input ${fieldErrors.email ? styles.inputError : ''}`}
              type="email" placeholder="you@example.com" value={email}
              onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })); setServerError(null); }}
            />
            <FieldError msg={fieldErrors.email} />
          </div>

          <div className={styles.field}>
            <label>Password <span className={styles.required}>*</span></label>
            <div className={styles.pwdWrap}>
              <input
                className={`input ${fieldErrors.password ? styles.inputError : ''}`}
                type={showPwd ? 'text' : 'password'}
                placeholder="Min 8 characters" value={password}
                onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: '' })); setPwdErrors(false); setServerError(null); }}
                onFocus={() => setPwdFocused(true)}
                onBlur={() => setPwdFocused(false)}
              />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPwd(p => !p)}>
                {showPwd ? <EyeOff /> : <EyeOpen />}
              </button>
            </div>
            {pwdFocused && <PasswordChecklist password={password} showErrors={pwdErrors} />}
            {fieldErrors.password && !pwdFocused && <FieldError msg={fieldErrors.password} />}
          </div>

          <div className={styles.field}>
            <label>Confirm Password <span className={styles.required}>*</span></label>
            <div className={styles.pwdWrap}>
              <input
                className={`input ${fieldErrors.confirm ? styles.inputError : ''}`}
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat password" value={confirm}
                onChange={e => { setConfirm(e.target.value); setFieldErrors(p => ({ ...p, confirm: '' })); setServerError(null); }}
              />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm(p => !p)}>
                {showConfirm ? <EyeOff /> : <EyeOpen />}
              </button>
            </div>
            <FieldError msg={fieldErrors.confirm} />
          </div>

          {serverError && (
            <Banner
              error={serverError}
              onGoogle={handleGoogle}
              onGitHub={handleGitHub}
              onSwitchToLogin={onSwitch}
              onSwitchToRegister={onSwitch}
            />
          )}

          <button type="submit" className="btn btn-primary w-full"
            style={{ justifyContent: 'center', marginTop: 8 }} disabled={loading}>
            {loading ? <><span className="spinner" /> Creating account…</> : 'Create Account'}
          </button>
        </form>

        <div className={styles.orDivider}><span>or</span></div>
        <button className="social-btn" onClick={handleGoogle}><GoogleIcon /> Sign up with Google</button>
        <button className="social-btn" onClick={handleGitHub}><GitHubIcon /> Sign up with GitHub</button>

        {oauthError && (
          <Banner
            error={oauthError}
            onGoogle={handleGoogle}
            onGitHub={handleGitHub}
            onSwitchToLogin={onSwitch}
            onSwitchToRegister={onSwitch}
          />
        )}

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: '.83rem' }}>
          Already have an account? <button className={styles.switchBtn} onClick={onSwitch}>Sign in</button>
        </p>
      </div>
    </div>
  );
}
