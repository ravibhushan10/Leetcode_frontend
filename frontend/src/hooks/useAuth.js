import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigured } from '../firebaseConfig.js';
import { useApp } from '../context/AppContext.jsx';

const firebaseApp = isFirebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;

export { isFirebaseConfigured };


function isOffline() {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}





function extractEmail(firebaseUser) {
  if (firebaseUser.email) return firebaseUser.email;


  if (Array.isArray(firebaseUser.providerData)) {
    for (const p of firebaseUser.providerData) {
      if (p?.email) return p.email;
    }
  }

  return null;
}


function parseOAuthError(err, providerName) {

  if (
    err.code === 'auth/popup-closed-by-user' ||
    err.code === 'auth/cancelled-popup-request'
  ) return null;


  if (
    isOffline() ||
    err.code === 'auth/network-request-failed' ||
    err.message?.includes('ERR_CONNECTION_TIMED_OUT') ||
    err.message?.includes('ERR_INTERNET_DISCONNECTED') ||
    err.message?.includes('Failed to fetch') ||
    err.message?.includes('NetworkError') ||
    err.message?.includes('net::ERR')
  ) {
    const e = new Error('No internet connection. Please check your network and try again.');
    e.friendlyMessage = e.message;
    throw e;
  }


  if (err.code === 'auth/popup-blocked') {
    const e = new Error('Popup was blocked by your browser. Please allow popups for this site and try again.');
    e.friendlyMessage = e.message;
    throw e;
  }


  if (err.code === 'auth/unauthorized-domain') {
    const e = new Error('This domain is not authorized for sign-in. Please contact support.');
    e.friendlyMessage = e.message;
    throw e;
  }


  const code     = err.response?.data?.code;
  const provider = err.response?.data?.provider;
  if (code === 'PROVIDER_MISMATCH') {
    const registeredWith =
      provider === 'google' ? 'Google' :
      provider === 'github' ? 'GitHub' :
      provider === 'local'  ? 'email/password' : provider;
    const hint =
      provider === 'google' ? 'google' :
      provider === 'github' ? 'github' :
      provider === 'local'  ? 'login'  : null;
    const e = new Error(`This email is already registered with ${registeredWith}.`);
    e.friendlyMessage = e.message;
    e.hint = hint;
    throw e;
  }



  if (err.friendlyMessage) throw err;


  const fallback = err.response?.data?.error || `${providerName} sign-in failed. Please try again.`;
  const e = new Error(fallback);
  e.friendlyMessage = e.message;
  throw e;
}


export function useAuth() {
  const { oauthLogin } = useApp();


  const loginWithGoogle = async () => {
    if (!firebaseAuth) {
      const e = new Error('Google sign-in is not configured. Please try email/password sign-in.');
      e.friendlyMessage = e.message;
      throw e;
    }

    if (isOffline()) {
      const e = new Error('No internet connection. Please check your network and try again.');
      e.friendlyMessage = e.message;
      throw e;
    }

    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    try {
      const result = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      const u = result.user;


      const email = extractEmail(u);

      if (!email) {


        const e = new Error(
          'Your Google account has no verified email address. ' +
          'Please add and verify an email in your Google account settings, then try again.'
        );
        e.friendlyMessage = e.message;
        throw e;
      }

      return await oauthLogin({
        name:          u.displayName || email.split('@')[0],
        email,
        oauthProvider: 'google',
        oauthId:       u.uid,
        avatarUrl:     u.photoURL || '',
      });
    } catch (err) {
      return parseOAuthError(err, 'Google');
    }
  };


  const loginWithGitHub = async () => {
    if (!firebaseAuth) {
      const e = new Error('GitHub sign-in is not configured. Please try email/password sign-in.');
      e.friendlyMessage = e.message;
      throw e;
    }

    if (isOffline()) {
      const e = new Error('No internet connection. Please check your network and try again.');
      e.friendlyMessage = e.message;
      throw e;
    }

    const { GithubAuthProvider, signInWithPopup } = await import('firebase/auth');
    try {
      const result = await signInWithPopup(firebaseAuth, new GithubAuthProvider());
      const u = result.user;


      const email = extractEmail(u);

      if (!email) {

        const e = new Error(
          'Your GitHub account email is private. ' +
          'To sign in with GitHub, go to GitHub → Settings → Emails and uncheck ' +
          '"Keep my email address private", then try again.'
        );
        e.friendlyMessage = e.message;
        throw e;
      }

      return await oauthLogin({
        name:          u.displayName || email.split('@')[0],
        email,
        oauthProvider: 'github',
        oauthId:       u.uid,
        avatarUrl:     u.photoURL || '',
      });
    } catch (err) {
      return parseOAuthError(err, 'GitHub');
    }
  };

  return { loginWithGoogle, loginWithGitHub };
}
