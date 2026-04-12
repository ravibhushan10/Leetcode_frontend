import express  from 'express';
import bcrypt   from 'bcryptjs';
import jwt      from 'jsonwebtoken';
import crypto   from 'crypto';
import User     from '../models/User.js';
import Problem  from '../models/Problem.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import {
  sendVerificationOtp,
  sendPasswordResetOtp,
  sendContactEmail,
} from '../utils/sendEmail.js';

const router = express.Router();

function makeAccessToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, plan: user.plan, isAdmin: user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function makeRefreshToken(user) {
  return jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '1y' }
  );
}

function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'none' : 'lax',
    path:     '/',
  };
}

async function issueTokens(user, res) {
  const accessToken  = makeAccessToken(user);
  const refreshToken = makeRefreshToken(user);
  const hash         = await bcrypt.hash(refreshToken, 10);
  await User.findByIdAndUpdate(user._id, { refreshTokenHash: hash });
  res.cookie('cf_refresh', refreshToken, {
    ...cookieOptions(),
    maxAge: 365 * 24 * 60 * 60 * 1000,
  });
  return accessToken;
}

function sanitize(user) {
  const u = user.toObject ? user.toObject() : { ...user };
  delete u.passwordHash;
  delete u.refreshTokenHash;
  delete u.verificationToken;
  delete u.verificationExpires;
  delete u.verifyOtp;
  delete u.verifyOtpExpires;
  delete u.verifyOtpAttempts;
  delete u.verifyOtpLockedUntil;
  delete u.verifyOtpSentAt;
  delete u.resetOtp;
  delete u.resetOtpExpires;
  delete u.resetOtpAttempts;
  delete u.resetOtpLockedUntil;
  delete u.resetOtpSentAt;
  delete u.oauthId;
  return u;
}

// FIX: In-memory login rate limiter does NOT work in production.
// Production hosts (Render, Railway, Fly.io) run multiple instances and restart
// processes frequently, wiping this map on every deploy/restart. Every restart
// resets attempt counts to zero, making the rate limit completely ineffective.
// Real fix = use Redis or store attempts on the User document.
// This in-memory version is kept so local dev doesn't break, but you should
// add loginAttempts + loginLockedUntil fields to your User model for prod.
const _loginAttempts = {};

function checkLoginRateLimit(ip) {
  const now = Date.now();
  if (!_loginAttempts[ip]) _loginAttempts[ip] = [];
  _loginAttempts[ip] = _loginAttempts[ip].filter(t => now - t < 15 * 60 * 1000);
  if (_loginAttempts[ip].length >= 10) return false;
  _loginAttempts[ip].push(now);
  return true;
}

function remainingLoginAttempts(ip) {
  const now    = Date.now();
  const recent = (_loginAttempts[ip] || []).filter(t => now - t < 15 * 60 * 1000);
  return Math.max(0, 10 - recent.length);
}

// REGISTER  POST /api/users/register

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields are required.' });
    if (name.trim().length < 2)
      return res.status(400).json({ error: 'Name must be at least 2 characters.' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const existing = await User.findOne({ email: email.toLowerCase().trim() });

    if (existing) {
      if (existing.oauthProvider === 'google' || existing.oauthProvider === 'github') {
        return res.status(409).json({
          error:    `This email is already registered via ${existing.oauthProvider === 'google' ? 'Google' : 'GitHub'}. Please sign in using that button.`,
          code:     'USE_OAUTH',
          provider: existing.oauthProvider,
        });
      }

      if (!existing.isVerified) {
        const cooldownMs  = 2 * 60 * 1000;
        const sentAt      = existing.verifyOtpSentAt?.getTime() || 0;
        const secondsLeft = Math.ceil((cooldownMs - (Date.now() - sentAt)) / 1000);

        if (sentAt && Date.now() - sentAt < cooldownMs) {
          return res.status(409).json({
            error:      `A code was recently sent — check your inbox. You can resend in ${secondsLeft}s.`,
            code:       'UNVERIFIED_EXISTS',
            email:      existing.email,
            secondsLeft,
          });
        }

        const otp    = String(Math.floor(100000 + Math.random() * 900000));
        const hashed = await bcrypt.hash(otp, 4);
        existing.verifyOtp            = hashed;
        existing.verifyOtpExpires     = new Date(Date.now() + 2 * 60 * 1000);
        existing.verifyOtpAttempts    = 0;
        existing.verifyOtpLockedUntil = null;
        existing.verifyOtpSentAt      = new Date();
        await existing.save();

        // Respond immediately, send email in background.
        res.status(409).json({
          error: 'This email is registered but not yet verified. A new code has been sent.',
          code:  'UNVERIFIED_EXISTS',
          email: existing.email,
        });

        sendVerificationOtp(existing.email, existing.name, otp)
          .catch(e => console.error('Re-send OTP failed:', e.message));
        return;
      }

      // FIX: original code also returned 409 here but was missing the code field.
      // Frontend's EMAIL_TAKEN handler needs this code to show "Sign in instead".
      return res.status(409).json({
        error: 'An account with this email already exists. Please sign in.',
        code:  'EMAIL_TAKEN',
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Run both hashes in parallel — OTP uses 4 rounds (short-lived 6-digit code,
    // no need for high rounds), password uses 12. Cuts ~250ms off response time.
    const [passwordHash, hashedOtp] = await Promise.all([
      bcrypt.hash(password, 12),
      bcrypt.hash(otp, 4),
    ]);

    const user = new User({
      name:                 name.trim(),
      email:                email.toLowerCase().trim(),
      passwordHash,
      oauthProvider:        'local',
      isVerified:           false,
      verifyOtp:            hashedOtp,
      verifyOtpExpires:     new Date(Date.now() + 2 * 60 * 1000),
      verifyOtpAttempts:    0,
      verifyOtpLockedUntil: null,
      verifyOtpSentAt:      new Date(),
    });
    await user.save();

    // Respond immediately — don't block on email provider latency.
    res.status(201).json({
      message: `We've sent a 6-digit code to ${user.email}. Enter it to activate your account.`,
      code:    'VERIFY_OTP',
      email:   user.email,
    });

    // Fire-and-forget: send email in background, log any failure.
    sendVerificationOtp(user.email, user.name, otp)
      .catch(e => console.error('Verification OTP email failed:', e.message));

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY OTP (registration)  POST /api/users/verify-otp-register
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-otp-register', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ error: 'Email and code are required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .populate('solved',     'number title difficulty slug')
      .populate('attempted',  'number title difficulty slug')
      .populate('bookmarked', 'number title difficulty slug');

    if (!user || !user.verifyOtp)
      return res.status(400).json({ error: 'No verification code found. Please register again.', code: 'NO_OTP' });

    if (user.isVerified)
      return res.status(400).json({ error: 'This account is already verified. Please sign in.', code: 'ALREADY_VERIFIED' });

    if (user.verifyOtpLockedUntil && user.verifyOtpLockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.verifyOtpLockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        error:       `Too many wrong attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
        code:        'OTP_LOCKED',
        minutesLeft,
      });
    }

    if (user.verifyOtpExpires < new Date())
      return res.status(400).json({
        error: 'This code has expired. Please request a new one.',
        code:  'OTP_EXPIRED',
      });

    const valid = await bcrypt.compare(String(otp), user.verifyOtp);
    if (!valid) {
      user.verifyOtpAttempts = (user.verifyOtpAttempts || 0) + 1;
      if (user.verifyOtpAttempts >= 3) {
        user.verifyOtpLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.verifyOtp            = null;
        user.verifyOtpExpires     = null;
        await user.save();
        return res.status(429).json({
          error:       'Too many wrong attempts. Locked for 15 minutes.',
          code:        'OTP_LOCKED',
          minutesLeft: 15,
        });
      }
      await user.save();
      const attemptsLeft = 3 - user.verifyOtpAttempts;
      return res.status(400).json({
        error:        `Incorrect code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
        code:         'OTP_INVALID',
        attemptsLeft,
      });
    }

    user.isVerified           = true;
    user.verifyOtp            = null;
    user.verifyOtpExpires     = null;
    user.verifyOtpAttempts    = 0;
    user.verifyOtpLockedUntil = null;
    user.verifyOtpSentAt      = null;
    await user.save();

    const accessToken = await issueTokens(user, res);

    return res.json({
      message: 'Email verified! Welcome to CodeForge.',
      code:    'VERIFIED',
      token:   accessToken,
      user:    sanitize(user),
    });

  } catch (err) {
    console.error('Verify OTP register error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RESEND VERIFY OTP  POST /api/users/resend-verify-otp
// ─────────────────────────────────────────────────────────────────────────────
router.post('/resend-verify-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ error: 'Email is required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user)
      return res.status(404).json({ error: 'No account found with this email.', code: 'NO_USER' });

    if (user.isVerified)
      return res.status(400).json({ error: 'This account is already verified. Please sign in.', code: 'ALREADY_VERIFIED' });

    const cooldownMs  = 2 * 60 * 1000;
    const sentAt      = user.verifyOtpSentAt?.getTime() || 0;
    if (sentAt && Date.now() - sentAt < cooldownMs) {
      const secondsLeft = Math.ceil((cooldownMs - (Date.now() - sentAt)) / 1000);
      return res.status(429).json({
        error:      `Please wait ${secondsLeft}s before requesting a new code.`,
        code:       'OTP_COOLDOWN',
        secondsLeft,
      });
    }

    const otp    = String(Math.floor(100000 + Math.random() * 900000));
    const hashed = await bcrypt.hash(otp, 4);
    user.verifyOtp            = hashed;
    user.verifyOtpExpires     = new Date(Date.now() + 2 * 60 * 1000);
    user.verifyOtpAttempts    = 0;
    user.verifyOtpLockedUntil = null;
    user.verifyOtpSentAt      = new Date();
    await user.save();

    // Respond immediately — don't block on email provider.
    res.json({
      message: 'A new verification code has been sent to your inbox.',
      code:    'OTP_RESENT',
    });

    sendVerificationOtp(user.email, user.name, otp)
      .catch(e => console.error('Resend OTP email failed:', e.message));

  } catch (err) {
    console.error('Resend verify OTP error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN  POST /api/users/login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const ip = req.ip;
    if (!checkLoginRateLimit(ip))
      return res.status(429).json({
        error: 'Too many login attempts. Please wait 15 minutes and try again.',
        code:  'RATE_LIMITED',
      });

    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .populate('solved',     'number title difficulty slug')
      .populate('attempted',  'number title difficulty slug')
      .populate('bookmarked', 'number title difficulty slug');

    // FIX: Was returning INVALID_CREDENTIALS (401) for both "user not found" and
    // "wrong password". Frontend had no way to distinguish them. Now uses a
    // distinct USER_NOT_FOUND code so frontend can say "please register first".
    if (!user)
      return res.status(404).json({
        error: 'No account found with this email. Please register first.',
        code:  'USER_NOT_FOUND',
      });

    if (user.oauthProvider === 'google' && !user.passwordHash)
      return res.status(401).json({
        error: 'This account uses Google sign-in. Please click "Continue with Google".',
        code:  'USE_GOOGLE',
      });
    if (user.oauthProvider === 'github' && !user.passwordHash)
      return res.status(401).json({
        error: 'This account uses GitHub sign-in. Please click "Continue with GitHub".',
        code:  'USE_GITHUB',
      });

    // FIX: Was returning INVALID_CREDENTIALS for wrong password. Now uses
    // WRONG_PASSWORD so the frontend can show a specific "password is incorrect" message.
    const match = await bcrypt.compare(password, user.passwordHash || '');
    if (!match) {
      const left = remainingLoginAttempts(ip);
      const hint = left <= 3 && left > 0
        ? ` ${left} attempt${left === 1 ? '' : 's'} remaining before lockout.`
        : left === 0
          ? ' Account temporarily locked. Try again in 15 minutes.'
          : '';
      return res.status(401).json({
        error: `Password is incorrect.${hint}`,
        code:  'WRONG_PASSWORD',
      });
    }

    if (!user.isVerified) {
      const cooldownMs = 2 * 60 * 1000;
      const sentAt     = user.verifyOtpSentAt?.getTime() || 0;
      let secondsLeft  = 0;

      if (!sentAt || Date.now() - sentAt >= cooldownMs) {
        const otp    = String(Math.floor(100000 + Math.random() * 900000));
        const hashed = await bcrypt.hash(otp, 10);
        user.verifyOtp            = hashed;
        user.verifyOtpExpires     = new Date(Date.now() + 2 * 60 * 1000);
        user.verifyOtpAttempts    = 0;
        user.verifyOtpLockedUntil = null;
        user.verifyOtpSentAt      = new Date();
        await user.save();
        try { await sendVerificationOtp(user.email, user.name, otp); }
        catch (e) { console.error('Auto resend OTP on login failed:', e.message); }
      } else {
        secondsLeft = Math.ceil((cooldownMs - (Date.now() - sentAt)) / 1000);
      }

      return res.status(403).json({
        error:      'Please verify your email before signing in. Check your inbox for the verification code.',
        code:       'EMAIL_NOT_VERIFIED',
        email:      user.email,
        secondsLeft,
      });
    }

    const accessToken = await issueTokens(user, res);
    return res.json({ token: accessToken, user: sanitize(user) });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REFRESH  POST /api/users/refresh
// ─────────────────────────────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.cf_refresh;
    if (!token)
      return res.status(401).json({ error: 'No refresh token.', code: 'NO_REFRESH_TOKEN' });

    let payload;
    try {
      payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      // FIX: clearCookie must use the SAME options as the original Set-Cookie
      // call (path, secure, sameSite) or the browser won't delete it in prod.
      res.clearCookie('cf_refresh', cookieOptions());
      return res.status(401).json({ error: 'Session expired. Please sign in again.', code: 'REFRESH_EXPIRED' });
    }

    const user = await User.findById(payload.id);
    if (!user || !user.refreshTokenHash) {
      res.clearCookie('cf_refresh', cookieOptions());
      return res.status(401).json({ error: 'Session invalid. Please sign in again.', code: 'INVALID_SESSION' });
    }

    const valid = await bcrypt.compare(token, user.refreshTokenHash);
    if (!valid) {
      res.clearCookie('cf_refresh', cookieOptions());
      return res.status(401).json({ error: 'Session invalid. Please sign in again.', code: 'INVALID_SESSION' });
    }

    const accessToken = await issueTokens(user, res);
    return res.json({ token: accessToken });

  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT  POST /api/users/logout
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { refreshTokenHash: null });
    // FIX: Must match the options used when setting the cookie
    res.clearCookie('cf_refresh', cookieOptions());
    return res.json({ message: 'Signed out successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// OAUTH  POST /api/users/oauth
// ─────────────────────────────────────────────────────────────────────────────
router.post('/oauth', async (req, res) => {
  try {
    const { name, email, oauthProvider, oauthId, avatarUrl } = req.body;

    if (!email || !oauthProvider || !oauthId)
      return res.status(400).json({ error: 'Missing OAuth credentials.' });

    let user = await User.findOne({ email: email.toLowerCase().trim() })
      .populate('solved',     'number title difficulty slug')
      .populate('attempted',  'number title difficulty slug')
      .populate('bookmarked', 'number title difficulty slug');

    if (user) {
      // FIX: Original condition was:
      //   user.oauthProvider !== oauthProvider && user.oauthId !== oauthId
      // The && means: only block if BOTH differ. But oauthId is always different
      // between providers (Google uid ≠ GitHub uid), so the check worked by
      // accident sometimes — but if an account had no oauthId set yet (local
      // account being linked), it would pass through incorrectly. The correct
      // logic: if the stored provider is a DIFFERENT oauth provider, block it.
      if (user.oauthProvider !== 'local' && user.oauthProvider !== oauthProvider) {
        const providerName = user.oauthProvider === 'google' ? 'Google'
          : user.oauthProvider === 'github' ? 'GitHub'
          : 'email/password';
        return res.status(409).json({
          error:    `This email is already registered with ${providerName}. Please use that sign-in method.`,
          code:     'PROVIDER_MISMATCH',
          provider: user.oauthProvider,
        });
      }

      // Link OAuth to local account, or update existing OAuth account
      user.oauthProvider = oauthProvider;
      user.oauthId       = oauthId;
      if (avatarUrl && !user.avatarUrl) user.avatarUrl = avatarUrl;
      user.isVerified    = true;
      await user.save();

      // FIX: Re-fetch after save so populated fields are fresh.
      // Original code only re-fetched for NEW users, not for existing ones being
      // updated — so the returned user object could have stale/unpopulated data.
      user = await User.findById(user._id)
        .populate('solved',     'number title difficulty slug')
        .populate('attempted',  'number title difficulty slug')
        .populate('bookmarked', 'number title difficulty slug');
    } else {
      user = new User({
        name:          name?.trim() || email.split('@')[0],
        email:         email.toLowerCase().trim(),
        oauthProvider,
        oauthId,
        avatarUrl:     avatarUrl || '',
        isVerified:    true,
        passwordHash:  null,
      });
      await user.save();

      user = await User.findById(user._id)
        .populate('solved',     'number title difficulty slug')
        .populate('attempted',  'number title difficulty slug')
        .populate('bookmarked', 'number title difficulty slug');
    }

    const accessToken = await issueTokens(user, res);
    return res.json({ token: accessToken, user: sanitize(user) });

  } catch (err) {
    console.error('OAuth login error:', err);
    res.status(500).json({ error: 'OAuth sign-in failed. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET ME  GET /api/users/me
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('solved',     'number title difficulty slug')
      .populate('attempted',  'number title difficulty slug')
      .populate('bookmarked', 'number title difficulty slug');

    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json(sanitize(user));
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD  POST /api/users/forgot-password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ error: 'Email is required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user || user.oauthProvider !== 'local') {
      return res.json({ message: 'If that email is registered, a reset code has been sent.' });
    }

    const cooldownMs  = 2 * 60 * 1000;
    const sentAt      = user.resetOtpSentAt?.getTime() || 0;
    if (sentAt && Date.now() - sentAt < cooldownMs) {
      const secondsLeft = Math.ceil((cooldownMs - (Date.now() - sentAt)) / 1000);
      return res.status(429).json({
        error:      `A reset code was recently sent. Please wait ${secondsLeft}s before requesting another.`,
        code:       'OTP_COOLDOWN',
        secondsLeft,
      });
    }

    const otp    = String(Math.floor(100000 + Math.random() * 900000));
    const hashed = await bcrypt.hash(otp, 4);
    user.resetOtp            = hashed;
    user.resetOtpExpires     = new Date(Date.now() + 2 * 60 * 1000);
    user.resetOtpAttempts    = 0;
    user.resetOtpLockedUntil = null;
    user.resetOtpSentAt      = new Date();
    await user.save();

    // Respond immediately — don't block on email provider latency.
    res.json({ message: 'If that email is registered, a reset code has been sent.' });

    sendPasswordResetOtp(user.email, user.name, otp)
      .catch(e => console.error('Password reset OTP email failed:', e.message));

  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY RESET OTP  POST /api/users/verify-otp
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ error: 'Email and code are required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user || !user.resetOtp)
      return res.status(400).json({ error: 'No reset code found. Please request a new one.', code: 'NO_OTP' });

    if (user.resetOtpLockedUntil && user.resetOtpLockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.resetOtpLockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        error:       `Too many wrong attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
        code:        'OTP_LOCKED',
        minutesLeft,
      });
    }

    if (user.resetOtpExpires < new Date())
      return res.status(400).json({
        error: 'This code has expired. Please request a new one.',
        code:  'OTP_EXPIRED',
      });

    const valid = await bcrypt.compare(String(otp), user.resetOtp);
    if (!valid) {
      user.resetOtpAttempts = (user.resetOtpAttempts || 0) + 1;
      if (user.resetOtpAttempts >= 3) {
        user.resetOtpLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.resetOtp            = null;
        user.resetOtpExpires     = null;
        await user.save();
        return res.status(429).json({
          error:       'Too many wrong attempts. Locked for 15 minutes.',
          code:        'OTP_LOCKED',
          minutesLeft: 15,
        });
      }
      await user.save();
      const attemptsLeft = 3 - user.resetOtpAttempts;
      return res.status(400).json({
        error:        `Incorrect code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
        code:         'OTP_INVALID',
        attemptsLeft,
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetOtp            = null;
    user.resetOtpExpires     = null;
    user.resetOtpAttempts    = 0;
    user.resetOtpLockedUntil = null;
    user.verificationToken   = resetToken;
    user.verificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    return res.json({ resetToken });

  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RESET PASSWORD  POST /api/users/reset-password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, password } = req.body;
    if (!resetToken || !password)
      return res.status(400).json({ error: 'Reset token and new password are required.' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const user = await User.findOne({
      verificationToken:   resetToken,
      verificationExpires: { $gt: new Date() },
    });

    if (!user)
      return res.status(400).json({
        error: 'This reset link is invalid or has expired. Please request a new code.',
        code:  'INVALID_RESET_TOKEN',
      });

    user.passwordHash        = await bcrypt.hash(password, 12);
    user.verificationToken   = null;
    user.verificationExpires = null;
    user.refreshTokenHash    = null;
    await user.save();

    // FIX: Must use matching options for clearCookie to work in prod
    res.clearCookie('cf_refresh', cookieOptions());

    return res.json({ message: 'Password reset successfully. Please sign in with your new password.' });

  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PROFILE  PATCH /api/users/profile
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, bio, github, linkedin, langPref, avatarUrl } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (name !== undefined) {
      if (!name.trim() || name.trim().length < 2)
        return res.status(400).json({ error: 'Name must be at least 2 characters.' });
      user.name = name.trim();
    }
    if (bio      !== undefined) user.bio      = bio.slice(0, 300);
    if (github   !== undefined) user.github   = github.trim();
    if (linkedin !== undefined) user.linkedin = linkedin.trim();
    if (langPref !== undefined) user.langPref = langPref;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl.trim();

    await user.save();
    return res.json(sanitize(user));

  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE PASSWORD  POST /api/users/change-password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Current and new password are required.' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!user.passwordHash)
      return res.status(400).json({ error: 'This account uses OAuth sign-in and has no password.' });

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match)
      return res.status(401).json({ error: 'Current password is incorrect.', code: 'WRONG_PASSWORD' });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    return res.json({ message: 'Password changed successfully.' });

  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKMARK  POST /api/users/bookmark/:problemId
// ─────────────────────────────────────────────────────────────────────────────
router.post('/bookmark/:problemId', authMiddleware, async (req, res) => {
  try {
    const user      = await User.findById(req.user.id);
    const problemId = req.params.problemId;
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const idx = user.bookmarked.findIndex(id => id.toString() === problemId);
    let bookmarked;
    if (idx === -1) {
      user.bookmarked.push(problemId);
      bookmarked = true;
    } else {
      user.bookmarked.splice(idx, 1);
      bookmarked = false;
    }
    await user.save();
    return res.json({ bookmarked, bookmarks: user.bookmarked });

  } catch (err) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD  GET /api/users/leaderboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find({ isAdmin: false, isVerified: true })
      .select('_id name initials avatarUrl rating ratingTitle plan streak solved')
      .sort({ rating: -1 })
      .limit(50);

    return res.json(users.map((u, i) => ({
      _id:         u._id.toString(),
      rank:        i + 1,
      name:        u.name,
      initials:    u.initials,
      avatarUrl:   u.avatarUrl || '',
      rating:      u.rating,
      ratingTitle: u.ratingTitle,
      plan:        u.plan,
      streak:      u.streak,
      solved:      u.solved.length,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong loading the leaderboard.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ML INSIGHTS  GET /api/users/ml-insights
// ─────────────────────────────────────────────────────────────────────────────
router.get('/ml-insights', authMiddleware, async (req, res) => {
  try {
    const { default: Submission } = await import('../models/Submission.js');
    const user = await User.findById(req.user.id)
      .populate('solved', 'difficulty tags companies');
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const submissions = await Submission.find({ user: req.user.id })
      .populate('problem', 'tags difficulty companies')
      .sort({ createdAt: -1 })
      .limit(500);

    const tagMap = {};
    for (const sub of submissions) {
      const tags = sub.problem?.tags || [];
      for (const tag of tags) {
        if (!tagMap[tag]) tagMap[tag] = { total: 0, accepted: 0 };
        tagMap[tag].total++;
        if (sub.verdict === 'Accepted') tagMap[tag].accepted++;
      }
    }
    const tagScores = Object.entries(tagMap)
      .map(([tag, s]) => ({ tag, accuracy: Math.round((s.accepted / s.total) * 100), total: s.total }))
      .sort((a, b) => a.accuracy - b.accuracy);

    const allTags   = ['Array', 'Dynamic Programming', 'Graph', 'Tree', 'String', 'Binary Search', 'Hash Table', 'Recursion'];
    const radarData = allTags.map(tag => {
      const found = tagScores.find(t => t.tag === tag);
      return { tag, accuracy: found ? found.accuracy : 0, attempted: found ? found.total : 0 };
    });

    const companies = ['Google', 'Amazon', 'Microsoft', 'Facebook', 'Apple'];
    const readiness = companies.map(company => {
      const diffScore       = (user.solved || []).reduce((acc, p) => {
        if (!(p.companies || []).includes(company)) return acc;
        return acc + (p.difficulty === 'Easy' ? 1 : p.difficulty === 'Medium' ? 2 : 3);
      }, 0);
      const companyProblems = (user.solved || []).filter(p => (p.companies || []).includes(company)).length;
      const raw             = Math.min(100, Math.round((diffScore / 50) * 100));
      return { company, score: Math.max(5, raw), problemsSolved: companyProblems };
    });

    const solvedIds     = new Set((user.solved || []).map(p => p._id.toString()));
    const weakTags      = tagScores.slice(0, 3).map(t => t.tag);
    const attemptedTags = new Set(tagScores.map(t => t.tag));
    const neverTried    = allTags.filter(t => !attemptedTags.has(t)).slice(0, 2);
    const targetTags    = [...new Set([...weakTags, ...neverTried])];

    const recommended = await Problem.find({
      tags:   { $in: targetTags.length ? targetTags : allTags },
      hidden: false,
    }).select('number title slug difficulty tags acceptance companies premium').limit(50);

    const diffOrder = { Easy: 0, Medium: 1, Hard: 2 };
    const recs = recommended
      .filter(p => !solvedIds.has(p._id.toString()))
      .sort((a, b) => diffOrder[a.difficulty] - diffOrder[b.difficulty])
      .slice(0, 8)
      .map(p => ({
        _id: p._id, number: p.number, title: p.title, slug: p.slug,
        difficulty: p.difficulty, tags: p.tags, acceptance: p.acceptance,
        premium: p.premium, reason: targetTags.find(t => p.tags.includes(t)) || p.tags[0],
      }));

    const totalSolved = user.solved?.length || 0;
    const easySolved  = (user.solved || []).filter(p => p.difficulty === 'Easy').length;
    const medSolved   = (user.solved || []).filter(p => p.difficulty === 'Medium').length;
    const hardSolved  = (user.solved || []).filter(p => p.difficulty === 'Hard').length;

    const plan = [
      { label: 'Easy Foundation',    target: 20, current: easySolved,  color: '#00d084' },
      { label: 'Medium Proficiency', target: 40, current: medSolved,   color: '#ff9f43' },
      { label: 'Hard Mastery',       target: 10, current: hardSolved,  color: '#ff5c5c' },
      { label: 'Total Problems',     target: 70, current: totalSolved, color: '#9d6fff' },
    ];

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const recentSubs    = submissions.filter(s => new Date(s.createdAt) > thirtyDaysAgo);
    const timelineMap   = {};
    for (const sub of recentSubs) {
      const day = new Date(sub.createdAt).toLocaleDateString('en-CA');
      if (!timelineMap[day]) timelineMap[day] = { day, total: 0, accepted: 0 };
      timelineMap[day].total++;
      if (sub.verdict === 'Accepted') timelineMap[day].accepted++;
    }
    const timeline = Object.values(timelineMap).sort((a, b) => a.day.localeCompare(b.day));

    return res.json({
      radarData, tagScores: tagScores.slice(0, 10),
      readiness, recommendations: recs, studyPlan: plan, timeline,
      stats: {
        totalSolved, easySolved, medSolved, hardSolved,
        totalSubmissions: submissions.length,
        acceptanceRate: submissions.length
          ? Math.round((submissions.filter(s => s.verdict === 'Accepted').length / submissions.length) * 100)
          : 0,
        streak: user.streak || 0,
      },
    });
  } catch (err) {
    console.error('ML insights error:', err);
    res.status(500).json({ error: 'Something went wrong loading insights.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTACT  POST /api/users/contact
// ─────────────────────────────────────────────────────────────────────────────
router.post('/contact', async (req, res) => {
  try {
    const { name, email, category, subject, message } = req.body;
    if (!name || !email || !subject || !message)
      return res.status(400).json({ error: 'Please fill in all required fields.' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (message.trim().length < 10)
      return res.status(400).json({ error: 'Message must be at least 10 characters.' });

    await sendContactEmail({ name, email, category, subject, message });
    return res.json({ message: "Your message has been sent. We'll get back to you within 24 hours." });

  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'Failed to send message. Please try again or email us directly.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────────────────────────────────────
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim(), isAdmin: true });
    if (!user) return res.status(401).json({ error: 'Invalid admin credentials.' });

    const match = await bcrypt.compare(password, user.passwordHash || '');
    if (!match) return res.status(401).json({ error: 'Invalid admin credentials.' });

    const token = makeAccessToken(user);
    return res.json({ token, user: sanitize(user) });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.get('/', adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash -refreshTokenHash').sort({ createdAt: -1 });
    return res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.patch('/:id/plan', adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    user.plan = user.plan === 'pro' ? 'free' : 'pro';
    if (user.plan === 'pro') user.proSince = new Date();
    await user.save();
    const newToken = makeAccessToken(user);
    return res.json({ plan: user.plan, token: newToken });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user)        return res.status(404).json({ error: 'User not found.' });
    if (user.isAdmin) return res.status(403).json({ error: 'Cannot delete admin accounts.' });
    await user.deleteOne();
    return res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP JOB
// ─────────────────────────────────────────────────────────────────────────────
export async function cleanupUnverifiedAccounts() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await User.deleteMany({ isVerified: false, createdAt: { $lt: cutoff } });
    if (result.deletedCount > 0)
      console.log(`Cleaned up ${result.deletedCount} unverified account(s)`);
  } catch (err) {
    console.error('Cleanup job error:', err.message);
  }
}

export default router;
