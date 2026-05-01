import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '../context/AppContext.jsx';
import axios from 'axios';
import styles from './Problems.module.css';
import { FaMagnifyingGlass, FaShuffle, FaSliders } from 'react-icons/fa6';
import Seo from '../components/Seo.jsx';

const DIFFS = ['All', 'Easy', 'Medium', 'Hard'];

export default function Problems() {
  const { user, loading: authLoading, diffBadge, toast, openPayment } = useApp();
  const navigate = useNavigate();

  const [search,          setSearch]          = useState('');
  const [diff,            setDiff]            = useState('All');
  const [tag,             setTag]             = useState('All');
  const [popupProblem,    setPopupProblem]    = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tagDrawerOpen,   setTagDrawerOpen]   = useState(false);

  const isPro       = user?.plan === 'pro';
  const solvedIds   = new Set((user?.solved || []).map(s => s._id || s));
  const totalSolved = user?.solved?.length || 0;

  // Debounce search
  const debounceRef = useRef(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Close tag drawer on outside click
  const drawerRef = useRef(null);
  useEffect(() => {
    if (!tagDrawerOpen) return;
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setTagDrawerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tagDrawerOpen]);

  const { data: tagsData } = useQuery({
    queryKey:  ['problem-tags'],
    queryFn:   () => axios.get('/api/problems/tags').then(r => r.data),
    staleTime: 30 * 60 * 1000,
  });
  const tags = tagsData ? ['All', ...tagsData] : ['All'];

  const { data: totalData } = useQuery({
    queryKey:  ['problems-total'],
    queryFn:   () => axios.get('/api/problems/total').then(r => r.data),
    staleTime: 30 * 60 * 1000,
  });
  const totalCount = totalData?.total || 0;

  const problemsQueryKey = ['problems-all', isPro];
  const { data: allProblemsData, isLoading: fetching, isFetched } = useQuery({
    queryKey: problemsQueryKey,
    queryFn: async () => {
      const { data } = await axios.get('/api/problems', { params: { limit: 500 } });
      const all = data.problems;
      return isPro ? all : all.filter(p => p.number <= 40);
    },
    staleTime:           15 * 60 * 1000,
    gcTime:              30 * 60 * 1000,
    enabled:             !authLoading,
    refetchOnWindowFocus: false,
  });

  const allProblems = allProblemsData || [];

  const problems = allProblems.filter(p => {
    const q          = debouncedSearch.toLowerCase();
    const matchSearch = !q || p.title.toLowerCase().includes(q) || (p.tags || []).some(t => t.toLowerCase().includes(q));
    const matchDiff   = diff === 'All' || p.difficulty === diff;
    const matchTag    = tag  === 'All' || (p.tags || []).includes(tag);
    return matchSearch && matchDiff && matchTag;
  });

  const initialDone = isFetched || allProblems.length > 0;
  const showSkeleton = authLoading || (!initialDone && problems.length === 0);

  const easy   = allProblems.filter(p => p.difficulty === 'Easy').length;
  const medium = allProblems.filter(p => p.difficulty === 'Medium').length;
  const hard   = allProblems.filter(p => p.difficulty === 'Hard').length;
  const total  = allProblems.length;

  const handleClearFilters = () => { setDiff('All'); setTag('All'); setSearch(''); };

  const handleRandom = () => {
    const pool = allProblems.filter(p => !p.premium);
    if (pool.length) navigate(`/problems/${pool[Math.floor(Math.random() * pool.length)].slug}`);
    else toast('Could not load random problem', 'error');
  };

  const handleRowClick = (p) => {
    if (popupProblem === p._id) { setPopupProblem(null); return; }
    if (!isPro && p.premium)    { setPopupProblem(p._id); return; }
    navigate(`/problems/${p.slug}`);
  };

  const hasFilters = diff !== 'All' || tag !== 'All' || search;

  // ─── Skeleton rows ───────────────────────────────────────────────────────────
  const SkeletonRows = () => Array.from({ length: 10 }).map((_, i) => (
    <tr key={`sk-${i}`} className={styles.skeletonRow}>
      <td><div className={`skeleton ${styles.skCell}`} style={{ width: 24 }} /></td>
      <td><div className={`skeleton ${styles.skCell}`} style={{ width: 20, borderRadius: '50%' }} /></td>
      <td><div className={`skeleton ${styles.skCell}`} style={{ width: `${140 + (i % 4) * 40}px` }} /></td>
      <td><div className={`skeleton ${styles.skCell}`} style={{ width: 60 }} /></td>
      <td><div className={`skeleton ${styles.skCell}`} style={{ width: 80 }} /></td>
      <td><div className={`skeleton ${styles.skCell}`} style={{ width: 44 }} /></td>
    </tr>
  ));

  // ─── Mobile skeleton cards ────────────────────────────────────────────────────
  const SkeletonCards = () => Array.from({ length: 8 }).map((_, i) => (
    <div key={`skc-${i}`} className={styles.problemCard}>
      <div className={styles.cardTop}>
        <div className={`skeleton ${styles.skCell}`} style={{ width: 24, height: 14 }} />
        <div className={`skeleton ${styles.skCell}`} style={{ width: `${100 + (i % 3) * 40}px`, height: 14, flex: 1 }} />
        <div className={`skeleton ${styles.skCell}`} style={{ width: 52, height: 20, borderRadius: 10 }} />
      </div>
      <div className={styles.cardBottom}>
        <div className={`skeleton ${styles.skCell}`} style={{ width: 44, height: 14, borderRadius: 10 }} />
        <div className={`skeleton ${styles.skCell}`} style={{ width: 52, height: 14, borderRadius: 10 }} />
      </div>
    </div>
  ));

  // ─── Problem card (mobile) ────────────────────────────────────────────────────
  const ProblemCard = ({ p }) => {
    const isSolved  = solvedIds.has(p._id);
    const isLocked  = !isPro && p.premium;
    const popupOpen = popupProblem === p._id;

    return (
      <div
        className={`${styles.problemCard} ${isSolved ? styles.cardSolved : ''} ${isLocked ? styles.cardLocked : ''}`}
        onClick={() => handleRowClick(p)}
      >
        <div className={styles.cardTop}>
          <span className={styles.cardNum}>#{p.number}</span>

          {isSolved
            ? <span className={styles.cardSolvedDot} title="Solved" />
            : <span className={styles.cardUnsolvedDot} />}

          <span className={styles.cardTitle}>
            {p.title}
          </span>

          <span className={`badge ${diffBadge(p.difficulty)} ${styles.cardDiffBadge}`}>
            {p.difficulty}
          </span>

          {isLocked && (
            <span className={styles.cardLock}>🔒</span>
          )}
        </div>

        <div className={styles.cardBottom}>
          {(p.tags || []).slice(0, 2).map(t => (
            <button
              key={t}
              className={styles.tagChip}
              onClick={e => { e.stopPropagation(); setTag(t); setTagDrawerOpen(false); }}
            >
              {t}
            </button>
          ))}
          {p.acceptance != null && (
            <span className={styles.cardAccept}>{p.acceptance.toFixed(1)}%</span>
          )}
          {!isPro && p.premium && (
            <span className="badge badge-premium" style={{ marginLeft: 'auto' }}>Premium</span>
          )}
        </div>

        {popupOpen && (
          <div className={styles.cardPopup} onClick={e => e.stopPropagation()}>
            <div className={styles.inlinePopupText}>
              <strong>Premium Problem</strong>
              <span>Unlock Pro to access all premium problems</span>
            </div>
            <button
              className={`btn btn-primary btn-sm ${styles.inlinePopupBtn}`}
              onClick={() => { setPopupProblem(null); openPayment(); }}
            >
              Unlock Pro
            </button>
            <button
              className={styles.inlinePopupClose}
              onClick={e => { e.stopPropagation(); setPopupProblem(null); }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Seo title="Problems" noindex={true} path="/problems" />
      <div className={`${styles.page} page-animate`}>
        <div className={styles.inner}>

          {/* ── Desktop sidebar ─────────────────────────────── */}
          <aside className={styles.sidebar}>
            <div className={styles.sideCard}>
              <div className={styles.sideTitle}>Tags</div>
              <div className={styles.tagList}>
                {tags.map(t => (
                  <button
                    key={t}
                    className={`${styles.tagBtn} ${tag === t ? styles.tagActive : ''}`}
                    onClick={() => setTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Main content ────────────────────────────────── */}
          <div className={styles.main}>

            {/* ── Mobile diff tabs ────────────────────────── */}
            <div className={styles.diffTabs}>
              {DIFFS.map(d => (
                <button
                  key={d}
                  className={`${styles.diffTab} ${diff === d ? styles.diffTabActive : ''} ${d !== 'All' ? styles[`diffTab${d}`] : ''}`}
                  onClick={() => setDiff(d)}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* ── Toolbar ─────────────────────────────────── */}
            <div className={styles.toolbar}>
              <div className={styles.searchWrap}>
                <FaMagnifyingGlass className={styles.searchIcon} />
                <input
                  className={`input ${styles.searchInput}`}
                  placeholder="Search problems…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {/* Desktop-only diff dropdown */}
              <div className={styles.diffDropWrap}>
                <select className={styles.diffSelect} value={diff} onChange={e => setDiff(e.target.value)}>
                  <option value="All">All Levels</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              {/* Desktop-only solved counter */}
              {user && total > 0 && (
                <div className={styles.solvedDropWrap}>
                  <button className={styles.solvedCounter}>
                    <span className={styles.solvedNum}>{totalSolved}</span>
                    <span className={styles.solvedSlash}>/</span>
                    <span className={styles.solvedTotal}>{total}</span>
                    <span className={styles.solvedLabel}>solved</span>
                    <span className={styles.solvedArrow}>▾</span>
                  </button>
                  <div className={styles.solvedDropdown}>
                    <div className={styles.solvedDropRow}>
                      <span className={styles.solvedDropDot} style={{ background: 'var(--green)' }} />
                      <span className={styles.solvedDropLabel}>Easy</span>
                      <span className={styles.solvedDropVal}>
                        {user.solved?.filter(p => p.difficulty === 'Easy').length || 0}
                        <span className={styles.solvedDropTotal}> / {easy}</span>
                      </span>
                    </div>
                    <div className={styles.solvedDropRow}>
                      <span className={styles.solvedDropDot} style={{ background: 'var(--orange)' }} />
                      <span className={styles.solvedDropLabel}>Medium</span>
                      <span className={styles.solvedDropVal}>
                        {user.solved?.filter(p => p.difficulty === 'Medium').length || 0}
                        <span className={styles.solvedDropTotal}> / {medium}</span>
                      </span>
                    </div>
                    <div className={styles.solvedDropRow}>
                      <span className={styles.solvedDropDot} style={{ background: 'var(--red)' }} />
                      <span className={styles.solvedDropLabel}>Hard</span>
                      <span className={styles.solvedDropVal}>
                        {user.solved?.filter(p => p.difficulty === 'Hard').length || 0}
                        <span className={styles.solvedDropTotal}> / {hard}</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <button className={`btn btn-ghost btn-sm ${styles.randomBtn}`} onClick={handleRandom}>
                <FaShuffle style={{ fontSize: 13 }} /> Pick Random
              </button>

              {/* Mobile-only: tag filter button */}
              <div className={styles.mobileTagWrap} ref={drawerRef}>
                <button
                  className={`btn btn-ghost btn-sm ${styles.mobileTagBtn} ${tag !== 'All' ? styles.mobileTagBtnActive : ''}`}
                  onClick={() => setTagDrawerOpen(v => !v)}
                  aria-expanded={tagDrawerOpen}
                >
                  <FaSliders style={{ fontSize: 12 }} />
                  {tag !== 'All' ? tag : 'Tags'}
                </button>
                {tagDrawerOpen && (
                  <div className={styles.tagDrawer}>
                    <div className={styles.tagDrawerTitle}>Filter by tag</div>
                    <div className={styles.tagDrawerList}>
                      {tags.map(t => (
                        <button
                          key={t}
                          className={`${styles.tagBtn} ${tag === t ? styles.tagActive : ''}`}
                          onClick={() => { setTag(t); setTagDrawerOpen(false); }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Mobile tag strip (tablet only, 480–860px) ── */}
            <div className={styles.mobileTagStrip}>
              {tags.map(t => (
                <button
                  key={t}
                  className={`${styles.tagBtn} ${tag === t ? styles.tagActive : ''}`}
                  onClick={() => setTag(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* ── Results row ─────────────────────────────── */}
            <div className={styles.resultsRow}>
              <span className="text-muted" style={{ fontSize: '.8rem' }}>
                {showSkeleton ? '\u00a0' : `${problems.length} problem${problems.length !== 1 ? 's' : ''}`}
              </span>
              {hasFilters && (
                <button className="btn btn-ghost btn-sm" onClick={handleClearFilters}>
                  ✕ Clear filters
                </button>
              )}
            </div>

            {/* ══ DESKTOP / TABLET TABLE ══════════════════════════════════════════ */}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: 48 }}>#</th>
                    <th style={{ width: 44 }}>Status</th>
                    <th>Title</th>
                    <th>Difficulty</th>
                    <th className={styles.thTags}>Tags</th>
                    <th className={styles.thAccept}>Acceptance</th>
                  </tr>
                </thead>
                <tbody>
                  {showSkeleton
                    ? <SkeletonRows />
                    : problems.map(p => {
                        const isSolved  = solvedIds.has(p._id);
                        const isLocked  = !isPro && p.premium;
                        const popupOpen = popupProblem === p._id;

                        return (
                          <tr
                            key={p._id}
                            className={`
                              ${isSolved  ? styles.solvedRow    : ''}
                              ${isLocked  ? styles.lockedRow    : ''}
                              ${popupOpen ? styles.popupOpenRow : ''}
                              ${styles.clickableRow}
                            `}
                            onClick={() => handleRowClick(p)}
                          >
                            <td className={styles.numCell}>{p.number}</td>

                            <td className={styles.statusCell}>
                              {isSolved
                                ? <span className={styles.solvedIcon}>✓</span>
                                : <span className={styles.unsolvedIcon} />}
                            </td>

                            <td className={styles.titleCell} style={{ position: 'relative' }}>
                              <span className={styles.titleLink}>
                                {p.title}
                                {!isPro && p.premium && (
                                  <span className="badge badge-premium" style={{ marginLeft: 8 }}>Premium</span>
                                )}
                              </span>

                              <div className={styles.companies}>
                                {(p.companies || []).slice(0, 3).map(c => (
                                  <span key={c} className={styles.company}>{c}</span>
                                ))}
                              </div>

                              {popupOpen && (
                                <div className={styles.inlinePopup} onClick={e => e.stopPropagation()}>
                                  <div className={styles.inlinePopupText}>
                                    <strong>Premium Problem</strong>
                                    <span>Unlock Pro to access all premium problems</span>
                                  </div>
                                  <button
                                    className={`btn btn-primary btn-sm ${styles.inlinePopupBtn}`}
                                    onClick={() => { setPopupProblem(null); openPayment(); }}
                                  >
                                    Unlock Pro
                                  </button>
                                  <button
                                    className={styles.inlinePopupClose}
                                    onClick={e => { e.stopPropagation(); setPopupProblem(null); }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                            </td>

                            <td>
                              <span className={`badge ${diffBadge(p.difficulty)}`}>{p.difficulty}</span>
                            </td>

                            <td className={`${styles.tagsCell} ${styles.tdTags}`}>
                              {(p.tags || []).slice(0, 2).map(t => (
                                <button
                                  key={t}
                                  className={styles.tagChip}
                                  onClick={e => { e.stopPropagation(); setTag(t); }}
                                >
                                  {t}
                                </button>
                              ))}
                            </td>

                            <td className={`${styles.acceptCell} ${styles.tdAccept}`}>
                              {p.acceptance?.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })
                  }

                  {!isPro && !showSkeleton && totalCount > 0 && (
                    <tr className={styles.upgradeRow}>
                      <td colSpan={6} className={styles.upgradeCell}>
                        <div className={styles.upgradeBanner}>
                          <div className={styles.upgradeText}>
                            <span className={styles.upgradeTitle}>
                              Showing 40 out of {totalCount}+ problems
                            </span>
                            <span className={styles.upgradeSub}>
                              Upgrade to Pro to unlock all {totalCount}+ problems
                            </span>
                          </div>
                          <button className="btn btn-primary btn-sm" onClick={openPayment}>
                            Unlock Pro · ₹10/month
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {!showSkeleton && !fetching && problems.length === 0 && (
                <div className={styles.empty}>
                  <p>No problems found. Try adjusting your filters.</p>
                </div>
              )}
            </div>

            {/* ══ MOBILE CARD LIST (≤ 480px) ═════════════════════════════════════ */}
            <div className={styles.cardList}>
              {showSkeleton
                ? <SkeletonCards />
                : problems.map(p => <ProblemCard key={p._id} p={p} />)
              }

              {!isPro && !showSkeleton && totalCount > 0 && (
                <div className={styles.upgradeBannerMobile}>
                  <div className={styles.upgradeText}>
                    <span className={styles.upgradeTitle}>
                      Showing 40 of {totalCount}+ problems
                    </span>
                    <span className={styles.upgradeSub}>
                      Upgrade to Pro to unlock all {totalCount}+ problems
                    </span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={openPayment}>
                    Unlock Pro · ₹10/month
                  </button>
                </div>
              )}

              {!showSkeleton && !fetching && problems.length === 0 && (
                <div className={styles.empty}>
                  <p>No problems found. Try adjusting your filters.</p>
                </div>
              )}
            </div>

          </div>{/* end .main */}
        </div>{/* end .inner */}

        {/* ── Mobile random FAB ─────────────────────────────── */}
        <button className={styles.randomFab} onClick={handleRandom} aria-label="Pick random problem">
          <FaShuffle style={{ fontSize: 16, color: '#000' }} />
        </button>

      </div>
    </>
  );
}
