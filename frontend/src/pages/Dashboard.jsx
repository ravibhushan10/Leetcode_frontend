import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '../context/AppContext.jsx';
import WeaknessRadar  from '../components/WeaknessRadar.jsx';
import ReadinessScore from '../components/ReadinessScore.jsx';
import MockInterview  from '../components/MockInterview.jsx';
import axios from 'axios';
import styles from './Dashboard.module.css';
import Seo from '../components/Seo.jsx';

export default function Dashboard() {
  const { user, diffBadge, toast, openPayment } = useApp();
  const navigate = useNavigate();
  const [activeTab,  setActiveTab]  = useState('overview');
  const [reviewing,  setReviewing]  = useState(null);
  const [review,     setReview]     = useState('');
  const [reviewLoad, setReviewLoad] = useState(false);

  const isPro = user?.plan === 'pro';

  const { data: insights, isLoading: loading, refetch: refetchInsights } = useQuery({
    queryKey:  ['ml-insights', user?._id],
    queryFn:   () => axios.get('/api/users/ml-insights').then(r => r.data),
    enabled:   !!user,
    staleTime: 5 * 60 * 1000,
    onError:   () => toast('Could not load insights', 'error'),
  });

  const requestReview = async (problem, code) => {
    if (!isPro) { toast('Upgrade to Pro for AI Code Review', 'info'); return; }
    setReviewing(problem);
    setReview('');
    setReviewLoad(true);
    try {
      const { data } = await axios.post('/api/ai/hint', {
        message: `Please review my solution for "${problem.title}". Give feedback on: time complexity, space complexity, code style, edge cases, and suggest any improvements.\n\nMy code:\n\`\`\`\n${code}\n\`\`\``,
        problemContext: `${problem.title} — ${problem.tags?.join(', ')}`,
        history: [],
      });
      setReview(data.reply);
    } catch { setReview('AI review unavailable right now.'); }
    finally { setReviewLoad(false); }
  };

  if (!user) return null;

  const tabs = [
    { id: 'overview',  label: 'Overview' },
    { id: 'weakness',  label: 'Weakness',      pro: true },
    { id: 'readiness', label: 'Readiness',      pro: true },
    { id: 'recommend', label: 'For You',        pro: true },
    { id: 'mock',      label: 'Mock Interview', pro: true },
    { id: 'studyplan', label: 'Study Plan',     pro: true },
  ];

  return (
    <>
    <Seo title="Dashboard" noindex={true} path="/dashboard" />
    <div className={`${styles.page} page-animate`}>
      <div className={styles.inner}>

        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>My Dashboard</h1>
            <p className={styles.sub}>
              {isPro
                ? 'Pro — All features unlocked'
                : 'Free plan — Upgrade to unlock ML features'}
            </p>
          </div>
        </div>

        <div className={styles.tabs}>
          {tabs.map(t => (
            <button key={t.id}
              className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(t.id)}>
              {t.label}
              {t.pro && !isPro && <span className={styles.lockTag}></span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={styles.loadingBox}>
            <span className="spinner spinner-lg" />
            <p>Analysing your submissions…</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && insights && (
              <div className={styles.overviewGrid}>
                <div className={styles.statsRow}>
                  {[
                    { label: 'Total Solved',  val: insights.stats.totalSolved,         color: 'var(--green)',  icon: '' },
                    { label: 'Easy',          val: insights.stats.easySolved,           color: 'var(--green)',  icon: '🟢' },
                    { label: 'Medium',        val: insights.stats.medSolved,            color: 'var(--orange)', icon: '🟡' },
                    { label: 'Hard',          val: insights.stats.hardSolved,           color: 'var(--red)',    icon: '🔴' },
                    { label: 'Submissions',   val: insights.stats.totalSubmissions,     color: 'var(--blue)',   icon: '' },
                    { label: 'Acceptance',    val: `${insights.stats.acceptanceRate}%`, color: 'var(--purple)', icon: '' },
                    { label: 'Rating',        val: user.rating,                         color: 'var(--purple)', icon: '' },
                  ].map(s => (
                    <div key={s.label} className={styles.statBox}>
                      <div className={styles.statVal} style={{ color: s.color }}>{s.val}</div>
                      <div className={styles.statLabel}>{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>Activity — Last 30 Days</h3>
                  {insights.timeline.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '.84rem' }}>No submissions in the last 30 days.</p>
                  ) : (
                    <div className={styles.timeline}>
                      {insights.timeline.map(t => (
                        <div key={t.day} className={styles.timelineBar}>
                          <div className={styles.timelineInner}
                            style={{ height: `${Math.min(100, (t.total / 5) * 100)}%`, background: t.accepted > 0 ? 'var(--green)' : 'var(--red)' }}
                            title={`${t.day}: ${t.accepted} accepted / ${t.total} total`}
                            />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {!isPro && (
                  <div className={styles.proPreviewGrid}>
                    {[
                      { icon: '', title: 'Weakness Analysis',     desc: 'See your skill radar and find blind spots' },
                      { icon: '', title: 'Interview Readiness',   desc: 'Know how ready you are for each company' },
                      { icon: '', title: 'Smart Recommendations', desc: 'ML picks the perfect next problem' },
                      { icon: '', title: 'Mock Interview',        desc: 'Timed sessions with real pressure' },
                    ].map(f => (
                      <div key={f.title} className={styles.proPreviewCard}>
                        <div className={styles.proPreviewLock}>🔒</div>
                        <div className={styles.proPreviewTitle}>{f.title}</div>
                        <div className={styles.proPreviewDesc}>{f.desc}</div>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ justifyContent: 'center', marginTop: 12, width: '100%' }}
                          onClick={openPayment}
                          >
                          Continue with ₹10/month
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'weakness' && (
              <ProGate isPro={isPro} onUpgrade={openPayment}>
                <div className={styles.twoCol}>
                  <div className={styles.card}>
                    <h3 className={styles.cardTitle}>Skill Radar</h3>
                    <p className={styles.cardSub}>Accuracy per topic — red means focus here</p>
                    <WeaknessRadar data={insights?.radarData || []} />
                  </div>
                  <div className={styles.card}>
                    <h3 className={styles.cardTitle}>Tag Breakdown</h3>
                    <p className={styles.cardSub}>Your weakest topics sorted by accuracy</p>
                    <div className={styles.tagBreakdown}>
                      {(insights?.tagScores || []).slice(0, 10).map(t => (
                        <div key={t.tag} className={styles.tagRow}>
                          <span className={styles.tagName}>{t.tag}</span>
                          <div className={styles.tagBarTrack}>
                            <div className={styles.tagBarFill}
                              style={{
                                width: `${t.accuracy}%`,
                                background: t.accuracy >= 70 ? 'var(--green)' : t.accuracy >= 40 ? 'var(--orange)' : 'var(--red)',
                              }}
                              />
                          </div>
                          <span className={styles.tagPct}
                            style={{ color: t.accuracy >= 70 ? 'var(--green)' : t.accuracy >= 40 ? 'var(--orange)' : 'var(--red)' }}>
                            {t.accuracy}%
                          </span>
                          <span className={styles.tagAttempted}>{t.accepted}/{t.total}</span>
                        </div>
                      ))}
                      {(!insights?.tagScores?.length) && (
                        <p className="text-muted" style={{ fontSize: '.84rem' }}>
                          Solve more problems to see your tag breakdown.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </ProGate>
            )}

            {activeTab === 'readiness' && (
              <ProGate isPro={isPro} onUpgrade={openPayment}>
                <div className={styles.twoCol}>
                  <div className={styles.card}>
                    <h3 className={styles.cardTitle}>Interview Readiness</h3>
                    <p className={styles.cardSub}>How prepared you are for each company</p>
                    <ReadinessScore data={insights?.readiness || []} />
                  </div>
                  <div className={styles.card}>
                    <h3 className={styles.cardTitle}>How to Improve</h3>
                    <p className={styles.cardSub}>Target these to boost your scores</p>
                    <div className={styles.tipsList}>
                      {(insights?.readiness || [])
                        .filter(r => r.score < 70)
                        .map(r => (
                          <div key={r.company} className={styles.tip}>
                            <div className={styles.tipCompany}>{r.company}</div>
                            <div className={styles.tipText}>
                              Solve more {r.company}-tagged problems. Currently at {r.score}%.
                              Need {Math.max(0, 5 - r.problemsSolved)} more problems to improve.
                            </div>
                            <Link to={`/problems?search=${r.company}`} className="btn btn-ghost btn-sm">
                              Find problems
                            </Link>
                          </div>
                        ))}
                      {(insights?.readiness || []).every(r => r.score >= 70) && (
                        <div className={styles.tip}>
                          <div style={{ color: 'var(--green)', fontWeight: 600 }}>Great progress!</div>
                          <div className={styles.tipText}>You're performing well across all companies. Keep solving Hard problems.</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </ProGate>
            )}

            {activeTab === 'recommend' && (
              <ProGate isPro={isPro} onUpgrade={openPayment}>
                <div className={styles.card}>
                  <div className={styles.cardHeaderRow}>
                    <div>
                      <h3 className={styles.cardTitle}>Problems Picked Just For You</h3>
                      <p className={styles.cardSub}>Based on your weak tags and solving history</p>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => refetchInsights()}>Refresh</button>
                  </div>
                  <div className={styles.recList}>
                    {(insights?.recommendations || []).map(p => (
                      <Link key={p._id} to={`/problems/${p.slug}`} className={styles.recCard}>
                        <div className={styles.recLeft}>
                          <span className={styles.recNum}>#{p.number}</span>
                          <div>
                            <div className={styles.recTitle}>{p.title}</div>
                            <div className={styles.recReason}>
                              Recommended because: <strong>{p.reason}</strong>
                            </div>
                          </div>
                        </div>
                        <div className={styles.recRight}>
                          <span className={`badge ${diffBadge(p.difficulty)}`}>{p.difficulty}</span>
                          <span className={styles.recAccept}>{p.acceptance?.toFixed(1)}%</span>
                        </div>
                      </Link>
                    ))}
                    {!insights?.recommendations?.length && (
                      <p className="text-muted" style={{ fontSize: '.84rem', padding: '20px 0' }}>
                        Solve a few problems first — then we'll recommend the perfect next ones.
                      </p>
                    )}
                  </div>
                </div>
              </ProGate>
            )}

            {activeTab === 'mock' && (
              <ProGate isPro={isPro} onUpgrade={openPayment}>
                <div className={styles.twoCol}>
                  <div className={styles.card}>
                    <MockInterview />
                  </div>
                  <div className={styles.card}>
                    <h3 className={styles.cardTitle}>About Mock Interviews</h3>
                    <div className={styles.mockInfo}>
                      <div className={styles.mockInfoItem}>
                        <div><strong>3 problems</strong> — 1 Easy, 1 Medium, 1 Hard picked from your target company</div>
                      </div>
                      <div className={styles.mockInfoItem}>
                        <div><strong>Timed pressure</strong> — Choose 45, 90, or 120 minutes. Timer ends the session.</div>
                      </div>
                      <div className={styles.mockInfoItem}>
                        <div><strong>No hints</strong> — AI Tutor is disabled. Just you and the problems.</div>
                      </div>
                      <div className={styles.mockInfoItem}>
                        <div><strong>Scored result</strong> — Easy=20pts, Medium=35pts, Hard=45pts</div>
                      </div>
                    </div>
                  </div>
                </div>
              </ProGate>
            )}

            {activeTab === 'studyplan' && (
              <ProGate isPro={isPro} onUpgrade={openPayment}>
                <div className={styles.twoCol}>
                  <div className={styles.card}>
                    <h3 className={styles.cardTitle}>30-Day Study Plan</h3>
                    <p className={styles.cardSub}>Your personalised milestones</p>
                    <div className={styles.planList}>
                      {(insights?.studyPlan || []).map(p => {
                        const pct = Math.min(100, Math.round((p.current / p.target) * 100));
                        const done = p.current >= p.target;
                        return (
                          <div key={p.label} className={`${styles.planItem} ${done ? styles.planDone : ''}`}>
                            <div className={styles.planHeader}>
                              <span className={styles.planLabel}>
                                {done ? '' : ''} {p.label}
                              </span>
                              <span className={styles.planCount}>{p.current} / {p.target}</span>
                            </div>
                            <div className="progress-track" style={{ marginTop: 6 }}>
                              <div className="progress-fill" style={{ width: `${pct}%`, background: p.color }} />
                            </div>
                            <div className={styles.planPct}>{pct}% complete</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <h3 className={styles.cardTitle}>Recommended Daily Target</h3>
                    <div className={styles.dailyTarget}>
                      <div className={styles.dailyNum}>3</div>
                      <div className={styles.dailyLabel}>problems per day</div>
                      <div className={styles.dailySplit}>
                        <div className={styles.dailyItem} style={{ color: 'var(--green)' }}>1 Easy</div>
                        <div className={styles.dailyItem} style={{ color: 'var(--orange)' }}>1 Medium</div>
                        <div className={styles.dailyItem} style={{ color: 'var(--red)' }}>1 Hard</div>
                      </div>
                      <p className={styles.dailyNote}>
                        At this pace you'll complete the 30-day plan and be interview-ready in 4 weeks.
                      </p>
                      <Link to="/problems" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                        Start Today's Problems
                      </Link>
                    </div>
                  </div>
                </div>
              </ProGate>
            )}
          </>
        )}
      </div>
    </div>
</>
  );
}

function ProGate({ isPro, children, onUpgrade }) {
  if (isPro) return children;
  return (
    <div style={{ position: 'relative', minHeight: 320 }}>
      <div style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.4 }}>
        {children}
      </div>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', padding: '28px 32px',
        textAlign: 'center', width: '100%', maxWidth: 320,
        boxShadow: '0 16px 48px rgba(0,0,0,.5)', zIndex: 10,
      }}>
        <div style={{ fontSize: '2rem', marginBottom: 10 }}>🔒</div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>Pro Feature</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '.82rem', lineHeight: 1.5, marginBottom: 18 }}>
          Upgrade to Pro to unlock all ML-powered features including this one.
        </p>
        <button className="btn btn-primary" style={{ justifyContent: 'center', width: '100%' }} onClick={onUpgrade}>
          Continue with ₹10/month
        </button>
      </div>
    </div>
  );
}
