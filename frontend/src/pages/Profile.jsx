import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '../context/AppContext.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import axios from 'axios';
import styles from './Profile.module.css';
import Seo from '../components/Seo.jsx';

const BADGES = [
  { icon: '🔥', label: 'First Solve',  threshold: 1,    key: 'solved' },
  { icon: '⚡', label: 'Speed Coder',   threshold: 10,   key: 'solved' },
  { icon: '💯', label: 'Century',       threshold: 100,  key: 'solved' },
  { icon: '🏆', label: 'Hard Crusher',  threshold: 5,    key: 'hard'   },
  { icon: '🌟', label: 'Streak Master', threshold: 7,    key: 'streak' },
  { icon: '🎯', label: 'Specialist',    threshold: 1200, key: 'rating' },
];

function timeAgo(dateStr) {
  const now  = new Date();
  const past = new Date(dateStr);
  const diff = Math.floor((now - past) / 1000);
  if (diff < 60)       return 'just now';
  if (diff < 3600)     return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000)  return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}

const VISIBLE_SUBS = 5;

export default function Profile() {
  const { user, refreshUser, toast, diffBadge, openPayment } = useApp();
  const navigate = useNavigate();

  const [editing,     setEditing]     = useState(false);
  const [form,        setForm]        = useState({});
  const [saving,      setSaving]      = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [tooltip,     setTooltip]     = useState(null);
  const [period,      setPeriod]      = useState('last6');
  const subsListRef = useRef(null);

  const { data: subs = [] } = useQuery({
    queryKey:  ['submissions-recent', user?._id],
    queryFn:   () => axios.get('/api/submissions/me?limit=200').then(r => r.data),
    enabled:   !!user,
    staleTime: 2 * 60 * 1000,
  });

  const { data: allSubs = [] } = useQuery({
    queryKey:  ['submissions-all', user?._id],
    queryFn:   () => axios.get('/api/submissions/me?limit=500').then(r => r.data),
    enabled:   !!user,
    staleTime: 2 * 60 * 1000,
  });

  const { data: suggestedData } = useQuery({
    queryKey:  ['suggested-problems'],
    queryFn:   () => axios.get('/api/problems?limit=10').then(r => r.data),
    staleTime: 10 * 60 * 1000,
  });
  const suggested = (suggestedData?.problems || []).slice(0, 10);

  const { data: availableData } = useQuery({
    queryKey:  ['problems-counts'],
    queryFn:   () => axios.get('/api/problems', { params: { limit: 500 } }).then(r => r.data),
    staleTime: 10 * 60 * 1000,
  });
  const availableCounts = {
    Easy:   (availableData?.problems || []).filter(p => p.difficulty === 'Easy').length,
    Medium: (availableData?.problems || []).filter(p => p.difficulty === 'Medium').length,
    Hard:   (availableData?.problems || []).filter(p => p.difficulty === 'Hard').length,
  };

  if (!user) return null;

  const save = async () => {
    setSaving(true);
    try {
      await axios.put('/api/users/me', form);
      await refreshUser();
      setEditing(false);
      toast('Profile updated!', 'success');
    } catch (e) {
      toast(e.response?.data?.error || 'Save failed', 'error');
    } finally { setSaving(false); }
  };

  const solved = user.solved?.length || 0;
  const easy   = user.solved?.filter(p => p.difficulty === 'Easy').length   || 0;
  const medium = user.solved?.filter(p => p.difficulty === 'Medium').length || 0;
  const hard   = user.solved?.filter(p => p.difficulty === 'Hard').length   || 0;
  const rating = user.rating || 0;
  const streak = user.streak || 0;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const hasOldSubmissions = allSubs.some(s => new Date(s.createdAt) < sixMonthsAgo);

  const now         = new Date();
  const currentYear = now.getFullYear();
  const years       = [currentYear - 1, currentYear, currentYear + 1];

  const PERIODS = hasOldSubmissions
    ? [
        { id: 'last6', label: 'Last 6 months' },
        ...years.flatMap(y => [
          { id: `h1_${y}`, label: `Jan ${y} – Jun ${y}` },
          { id: `h2_${y}`, label: `Jul ${y} – Dec ${y}` },
        ]),
      ]
    : [{ id: 'last6', label: 'Last 6 months' }];

  const getPeriodStart = () => {
    const n = new Date();
    if (period === 'last6') { const d = new Date(n); d.setMonth(d.getMonth() - 6); return d; }
    const map = {};
    years.forEach(y => { map[`h1_${y}`] = new Date(y, 0, 1); map[`h2_${y}`] = new Date(y, 6, 1); });
    return map[period] || new Date(n.setMonth(n.getMonth() - 6));
  };

  const submissionMap = {};
  allSubs.forEach(s => {
    const day = new Date(s.createdAt).toLocaleDateString('en-CA');
    if (!submissionMap[day]) submissionMap[day] = { total: 0, accepted: 0 };
    submissionMap[day].total++;
    if (s.verdict === 'Accepted') submissionMap[day].accepted++;
  });

  const periodStart = getPeriodStart();
  const heatmap = Array.from({ length: 26 * 7 }, (_, i) => {
    const d = new Date(periodStart);
    d.setDate(periodStart.getDate() + i);
    const dateStr = d.toLocaleDateString('en-CA');
    const data    = submissionMap[dateStr];
    const count   = data?.total || 0;
    const level   = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : 3;
    return {
      date:      dateStr,
      count,
      accepted:  data?.accepted || 0,
      level,
      display:   d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
      dayOfWeek: d.getDay(),
    };
  });

  const activeDays = heatmap.filter(c => c.count > 0).length;

  const earnedBadges = BADGES.filter(b => {
    if (b.key === 'solved')  return solved  >= b.threshold;
    if (b.key === 'hard')    return hard    >= b.threshold;
    if (b.key === 'streak')  return streak  >= b.threshold;
    if (b.key === 'rating')  return rating  >= b.threshold;
    return false;
  });

  const stats = [
    { label: 'SOLVED', val: solved,       color: 'var(--green)'  },
    { label: 'EASY',   val: easy,         color: 'var(--green)'  },
    { label: 'MEDIUM', val: medium,       color: 'var(--orange)' },
    { label: 'HARD',   val: hard,         color: 'var(--red)'    },
    { label: 'RATING', val: rating,       color: 'var(--purple)' },
    { label: 'STREAK', val: `${streak}d`, color: 'var(--orange)' },
  ];

  const showViewAll = subs.length > VISIBLE_SUBS;

  return (
    <>
    <Seo title="Profile" noindex={true} path="/profile" />
    <div className={`${styles.page} page-animate`}>
      <div className={styles.inner}>

        <div className={styles.leftCol}>
          <div className={styles.profileCard}>
            <div className={styles.avatarWrap}>
              <UserAvatar avatarUrl={user.avatarUrl} name={user.name} size={98} />
            </div>

            {editing ? (
              <div className={styles.editForm}>
                <input className="input" placeholder="Full name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <textarea className={`input ${styles.bioInput}`} placeholder="Short bio…" rows={3}
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
                <input className="input" placeholder="GitHub username"
                  value={form.github}
                  onChange={e => setForm(f => ({ ...f, github: e.target.value }))} />
                <input className="input" placeholder="LinkedIn URL"
                  value={form.linkedin}
                  onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                    {saving ? <><span className="spinner" /> Saving…</> : 'Save'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h2 className={styles.name}>{user.name}</h2>
                {user.bio && <p className={styles.bio}>{user.bio}</p>}
                <div className={styles.links}>
                  {user.github && (
                    <a href={`https://github.com/${user.github}`} target="_blank" rel="noreferrer" className={styles.linkBtn}>
                      GitHub
                    </a>
                  )}
                  {user.linkedin && (
                    <a href={user.linkedin} target="_blank" rel="noreferrer" className={styles.linkBtn}>
                      LinkedIn
                    </a>
                  )}
                </div>
                <div className={styles.planRow}>
                  <span className={`badge ${user.plan === 'pro' ? 'badge-pro' : 'badge-info'}`}>
                    {user.plan === 'pro' ? 'Pro' : 'Free'}
                  </span>
                  {user.plan !== 'pro' && (
                    <button className={styles.upgradeBtn} onClick={() => setShowUpgrade(true)}>
                      Upgrade
                    </button>
                  )}
                </div>
                <button className={styles.editBtn} onClick={() => {
                  setForm({ name: user.name, bio: user.bio || '', github: user.github || '', linkedin: user.linkedin || '' });
                  setEditing(true);
                }}>
                  Edit Profile
                </button>
              </>
            )}
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Badges</h3>
            <div className={styles.badgeGrid}>
              {BADGES.map(b => {
                const earned = earnedBadges.includes(b);
                return (
                  <div key={b.label}
                  className={`${styles.badgeCard} ${earned ? styles.badgeEarned : styles.badgeLocked}`}
                    title={b.label}>
                    <div className={styles.badgeIcon}>{earned ? b.icon : '🔒'}</div>
                    <div className={styles.badgeLabel}>{b.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        <div className={styles.midCol}>
         


<div className={styles.section}>
            <h3 className={styles.sectionTitle}>Progress</h3>
            {[
              { label: 'Easy',   solved: easy,   total: availableCounts.Easy,   color: 'var(--green)'  },
              { label: 'Medium', solved: medium, total: availableCounts.Medium, color: 'var(--orange)' },
              { label: 'Hard',   solved: hard,   total: availableCounts.Hard,   color: 'var(--red)'    },
            ].map(p => (
              <div key={p.label} className={styles.progressRow}>
                <div className={styles.progressMeta}>
                  <span style={{ color: p.color, fontSize: '.82rem', fontWeight: 600 }}>{p.label}</span>
                  <span className={styles.progCount}>{p.solved} / {p.total || '…'}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{
                    width:      p.total ? `${Math.min(100, (p.solved / p.total) * 100)}%` : '0%',
                    background: p.color,
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div className={styles.section}>
            <div className={styles.heatmapTopRow}>
              <div className={styles.heatmapHeadline}>
                <strong>{allSubs.length}</strong> submissions in last 6 months
                <span className={styles.heatmapStats}>
                  · Total active days: <strong>{activeDays}</strong>
                  · Max streak: <strong>{streak}d</strong>
                </span>
              </div>
              <div className={styles.periodWrap}>
                <select
                  className={styles.periodSelect}
                  value={period}
                  onChange={e => setPeriod(e.target.value)}
                  disabled={!hasOldSubmissions}
                >
                  {PERIODS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.heatmapWrap} onMouseLeave={() => setTooltip(null)}>
              <div className={styles.heatmapOuter}>
                <div className={styles.heatmapGrid}>
                  {heatmap.map((cell, i) => (
                    <div key={i}
                    className={`${styles.hcell} ${styles[`h${cell.level}`]}`}
                    onMouseEnter={e => {
                      const rect = e.target.getBoundingClientRect();
                      setTooltip({
                        text: cell.count === 0
                        ? `No submissions · ${cell.display}`
                        : `${cell.count} submission${cell.count !== 1 ? 's' : ''} (${cell.accepted} accepted)\n${cell.display}`,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 10,
                      });
                    }}
                    />
                  ))}
                </div>
                <div className={styles.heatmapMonths}>
                  {Array.from({ length: 26 }, (_, wi) => {
                    const d = new Date(periodStart);
                    d.setDate(periodStart.getDate() + wi * 7);
                    const isFirst = d.getDate() <= 7;
                    return (
                      <span key={wi} className={styles.monthLabel}>
                        {isFirst ? d.toLocaleDateString('en-US', { month: 'short' }) : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className={styles.heatmapLegend}>
              <span>Less</span>
              {[0, 1, 2, 3].map(l => (
                <div key={l} className={`${styles.hcell} ${styles[`h${l}`]}`}
                style={{ width: 11, height: 11, minWidth: 11, cursor: 'default' }} />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>

        <div className={styles.rightCol}>


          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Recent Submissions</h3>
              {showViewAll && (
                <Link to="/problems" className={styles.viewAll}>View all</Link>
              )}
            </div>

            {subs.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '.84rem' }}>
                No submissions yet.{' '}
                <Link to="/problems" style={{ color: 'var(--green)' }}>Start solving!</Link>
              </p>
            ) : (
              <div
              ref={subsListRef}
              className={`${styles.subsList} ${showViewAll ? styles.subsListScrollable : ''}`}
              >
                {subs.map(s => {
                  const title = s.problem?.title || '—';
                  const slug  = s.problem?.slug  || '';
                  const isAC  = s.verdict === 'Accepted';
                  return (
                    <div key={s._id} className={styles.subItem}>
                      {slug ? (
                        <Link
                        to={`/problems/${slug}`}
                        state={{ lastCode: s.code, lastLang: s.language }}
                        className={styles.subTitle}
                        title={title}
                        >
                          {title}
                        </Link>
                      ) : (
                        <span className={styles.subTitleDead}>{title}</span>
                      )}
                      <div className={styles.subRight}>
                        <span className={styles.subMeta}>{timeAgo(s.createdAt)}</span>
                        <span className={`${styles.subBadge} ${isAC ? styles.subBadgeAC : styles.subBadgeWA}`}>
                          {isAC ? 'Accepted' : 'Wrong'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {tooltip && (
        <div className={styles.heatmapTooltip} style={{
          position: 'fixed', left: tooltip.x, top: tooltip.y,
          transform: 'translate(-50%, -100%)', pointerEvents: 'none', zIndex: 9999,
        }}>
          {tooltip.text.split('\n').map((line, i) => (
            <div key={i} style={i === 0 ? { fontWeight: 600 } : { color: 'var(--green)' }}>{line}</div>
          ))}
        </div>
      )}

      {showUpgrade && (
        <div className="modal-overlay" onClick={() => setShowUpgrade(false)}>
          <div className="modal" style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowUpgrade(false)}>✕</button>
            <h2>Upgrade to Pro</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '10px 0 20px' }}>
              ₹10/month · Unlock all problems, AI Tutor, analytics and more.
            </p>
            <button
              className="btn btn-primary"
              style={{ justifyContent: 'center' }}
              onClick={() => { setShowUpgrade(false); openPayment(); }}
              >
              Upgrade Now
            </button>
          </div>
        </div>
      )}
    </div>
</>
  );
}
