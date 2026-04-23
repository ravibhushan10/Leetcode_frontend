// useAuth.js — FINAL COMPLETE FIX
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


// ─── GitHub: fetch primary verified email via API (handles private emails) ────
async function fetchGitHubPrimaryEmail(accessToken) {
  try {
    const res = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!res.ok) return null;
    const emails = await res.json();
    if (!Array.isArray(emails)) return null;
    // Priority 1: primary + verified
    const primary = emails.find(e => e.primary && e.verified);
    if (primary?.email) return primary.email;
    // Priority 2: any verified
    const anyVerified = emails.find(e => e.verified);
    if (anyVerified?.email) return anyVerified.email;
    // Priority 3: any email
    return emails.find(e => e.email)?.email || null;
  } catch {
    return null;
  }
}


// ─── Google: fetch email via People API (handles phone-only Google accounts) ──
// Some Google accounts are created with phone number only (no email attached).
// Firebase returns no email for these. The People API can confirm this.
// If People API also returns nothing, the account genuinely has no email.
async function fetchGoogleEmailFromPeopleAPI(accessToken) {
  try {
    const res = await fetch(
      'https://people.googleapis.com/v1/people/me?personFields=emailAddresses',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const emails = data.emailAddresses || [];
    // Priority 1: primary + verified
    const primary = emails.find(
      e => e.metadata?.primary && e.metadata?.verified
    );
    if (primary?.value) return primary.value;
    // Priority 2: any verified
    const anyVerified = emails.find(e => e.metadata?.verified);
    if (anyVerified?.value) return anyVerified.value;
    // Priority 3: any email
    return emails.find(e => e.value)?.value || null;
  } catch {
    return null;
  }
}


function extractEmail(firebaseUser) {
  // Check top-level email
  if (firebaseUser.email) return firebaseUser.email;
  // Check providerData (sometimes email is here even when top-level is null)
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


  // ─── Google OAuth ─────────────────────────────────────────────────────────
  // THE FIX for Google:
  // Problem: The "Codeforge" test account was created with phone number only —
  // no Gmail or email address is linked to it at all. Firebase confirms this:
  //   - emailVerified: false
  //   - granted_scopes: only "profile openid" — NO email scope was granted
  //   - rawUserInfo has no email field
  //
  // Fix Part 1: Explicitly request the `email` scope on GoogleAuthProvider.
  //   This forces Google to show the email permission in the consent screen.
  //   For accounts WITH email, this guarantees we get it.
  //
  // Fix Part 2: If Firebase still returns no email (phone-only account),
  //   call the People API with the access token as a last resort.
  //
  // Fix Part 3: If People API also returns nothing, the account truly has
  //   no email. Show a clear, accurate error message.
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
      // STEP 1: Explicitly request email scope
      // Without this, phone-only accounts don't grant email access at all.
      // This is why your granted_scopes only showed "profile openid" — no email!
      const provider = new GoogleAuthProvider();
      provider.addScope('email');               // <── KEY FIX for Google
      provider.addScope('profile');

      const result = await signInWithPopup(firebaseAuth, provider);
      const u = result.user;

      // STEP 2: Try Firebase's built-in email first
      let email = extractEmail(u);

      // STEP 3: Firebase returned no email — try People API fallback
      if (!email) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;
        if (accessToken) {
          email = await fetchGoogleEmailFromPeopleAPI(accessToken);
        }
      }

      // STEP 4: Genuinely no email on this Google account (phone-only account)
      if (!email) {
        const e = new Error(
          'Your Google account has no email address linked to it. ' +
          'Please add an email address to your Google account at myaccount.google.com, ' +
          'or sign in with a different Google account that has an email.'
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


  // ─── GitHub OAuth ──────────────────────────────────────────────────────────
  // THE FIX for GitHub:
  // Problem: Firebase's GithubAuthProvider doesn't request user:email scope
  //   by default. When a user has "Keep my email address private" enabled
  //   (which is GitHub's DEFAULT), Firebase gets null for email.
  //
  // Fix: Add user:email scope + call /user/emails API with the access token.
  //   This endpoint returns private emails too, as long as user:email scope
  //   was granted — which it is after addScope('user:email').
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
      // STEP 1: Request user:email scope explicitly
      const provider = new GithubAuthProvider();
      provider.addScope('user:email');          // <── KEY FIX for GitHub

      const result = await signInWithPopup(firebaseAuth, provider);
      const u = result.user;

      // STEP 2: Try Firebase's built-in email first (works if email is public)
      let email = extractEmail(u);

      // STEP 3: Email was private — call GitHub emails API
      if (!email) {
        const credential = GithubAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;
        if (accessToken) {
          email = await fetchGitHubPrimaryEmail(accessToken);
        }
      }

      // STEP 4: No email found at all (no verified email on GitHub account)
      if (!email) {
        const e = new Error(
          'Unable to access your GitHub email address. ' +
          'Please ensure you have at least one verified email on your GitHub account ' +
          'at github.com/settings/emails, then try again.'
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
