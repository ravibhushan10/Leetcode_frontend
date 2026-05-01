import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../context/AppContext.jsx';
import { useResizable } from '../hooks/useResizable.js';
import UserAvatar from '../components/UserAvatar.jsx';
import axios from 'axios';
import styles from './Solve.module.css';
import PaymentModal from '../components/PaymentModal.jsx';
import Seo from '../components/Seo.jsx';

const LANGS = [
  { id: 'cpp',        label: 'C++'        },
  { id: 'python',     label: 'Python 3'   },
  { id: 'java',       label: 'Java'       },
  { id: 'c',          label: 'C'          },
  { id: 'javascript', label: 'JavaScript' },
];

export default function Solve() {
  const { slug }    = useParams();
  const navigate    = useNavigate();
  const location    = useLocation();
  const queryClient = useQueryClient();
  const { user, diffBadge, toast, openPayment, showPayment, setShowPayment } = useApp();

  const [activeTab,    setActiveTab]    = useState('description');
  const [mobilePanelTab, setMobilePanelTab] = useState('description'); // 'description' | 'editor'
  const [lang,         setLang]         = useState(user?.langPref || 'python');
  const [code,         setCode]         = useState('');
  const [codeSet,      setCodeSet]      = useState(false);
  const [running,      setRunning]      = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [consoleTab,   setConsoleTab]   = useState('testcase');
  const [activeCase,   setActiveCase]   = useState(0);
  const [caseVars,     setCaseVars]     = useState([]);
  const [runResults,   setRunResults]   = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [aiMessages,   setAiMessages]   = useState([]);
  const [aiInput,      setAiInput]      = useState('');
  const [aiLoading,    setAiLoading]    = useState(false);
  const [submissions,  setSubmissions]  = useState([]);
  const [subsLoading,  setSubsLoading]  = useState(false);

  const aiChatRef    = useRef(null);
  const leftPanel    = useResizable('cf_left_w',    420, 'horizontal', 280, 700);
  const consolePanel = useResizable('cf_console_h', 260, 'vertical',   120, 450);

  const { data: problem, isLoading: loading } = useQuery({
    queryKey:  ['problem', slug],
    queryFn:   () => axios.get(`/api/problems/${slug}`).then(r => r.data),
    staleTime: 5 * 60 * 1000,
    retry:     1,
    onError:   () => { toast('Problem not found', 'error'); navigate('/problems'); },
  });

  useEffect(() => {
    if (!problem || codeSet) return;
    const fromProfile     = location.state?.lastCode;
    const fromProfileLang = location.state?.lastLang;
    if (fromProfile) {
      setCode(fromProfile);
      if (fromProfileLang) setLang(fromProfileLang);
    } else {
      setCode(problem.starter?.[lang] || '');
    }
    if (problem.examples?.[0]) setCaseVars(parseVars(problem.examples[0].input));
    setAiMessages([{
      role: 'ai',
      text: `Hey! I'm your AI Tutor for **${problem.title}**.\n\nI can walk you through hints, approach strategies, complexity analysis, debugging, or any coding/DSA concept that helps you solve this. Let's crack it together — without spoiling the fun!`,
    }]);
    setCodeSet(true);
  }, [problem]);

  useEffect(() => {
    if (!codeSet) return;
    if (problem?.starter?.[lang]) setCode(problem.starter[lang]);
  }, [lang]);

  useEffect(() => {
    if (!problem?.examples) return;
    const ex = problem.examples[activeCase];
    if (ex) setCaseVars(parseVars(ex.input));
  }, [activeCase, problem]);

  const handleEditorKey = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en } = e.target;
      setCode(code.slice(0, s) + '    ' + code.slice(en));
      setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = s + 4; }, 0);
    }
  };

  const runCode = async () => {
    if (!user) { toast('Please sign in to run code', 'info'); return; }
    setRunning(true); setConsoleTab('testcase'); setRunResults(null);
    try {
      const { data } = await axios.post('/api/submissions/run', { code, language: lang, problemId: problem._id });
      setRunResults(data.results);
      const firstFail = data.results.findIndex(r => !r.passed);
      if (firstFail !== -1) setActiveCase(firstFail);
    } catch (e) {
      toast(e.response?.data?.error || 'Run failed', 'error');
    } finally { setRunning(false); }
  };

  const submitCode = async () => {
    if (!user) { toast('Please sign in to submit', 'info'); return; }
    if (problem?.locked) { toast('Upgrade to Pro to submit premium problems', 'warning'); return; }
    setSubmitting(true); setConsoleTab('result'); setSubmitResult({ status: 'judging' });
    try {
      const { data } = await axios.post('/api/submissions', { code, language: lang, problemId: problem._id });
      setSubmitResult({ status: 'done', ...data });
      if (data.verdict === 'Accepted') {
        toast(`Accepted! +${problem.points} rating points`, 'success');
        queryClient.invalidateQueries({ queryKey: ['submissions-recent'] });
        queryClient.invalidateQueries({ queryKey: ['submissions-all'] });
        queryClient.invalidateQueries({ queryKey: ['ml-insights'] });
      }
    } catch (e) {
      setSubmitResult({ status: 'error', verdict: 'Error', stderr: e.response?.data?.error || 'Submission failed' });
    } finally { setSubmitting(false); }
  };

  const loadSubmissions = async () => {
    if (!user || !problem) return;
    setSubsLoading(true);
    try {
      const { data } = await axios.get(`/api/submissions/me?problemId=${problem._id}`);
      setSubmissions(data);
    } catch {} finally { setSubsLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'submissions') loadSubmissions();
  }, [activeTab, problem]);

  const sendAI = async (overrideMsg) => {
    if (!overrideMsg && !aiInput.trim()) return;
    const msg = overrideMsg || aiInput.trim();
    setAiInput('');
    setAiMessages(prev => [...prev, { role: 'user', text: msg }]);
    setAiLoading(true);
    try {
      const { data } = await axios.post('/api/ai/hint', {
        message: msg,
        problemContext: problem ? `${problem.title} — ${problem.aiContext}` : 'General coding',
        history: aiMessages.slice(-6).map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
      });
      setAiMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
    } catch {
      setAiMessages(prev => [...prev, { role: 'ai', text: "I'm having trouble connecting. Try again in a moment!" }]);
    } finally { setAiLoading(false); }
    setTimeout(() => aiChatRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 100);
  };

  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <span className="spinner spinner-lg" />
        <p>Loading problem…</p>
      </div>
    );
  }

  if (!problem) return null;

  const isSolved = user?.solved?.some(s => (s._id || s) === problem._id);
  const examples = problem.examples || [];

  return (
    <>
    <Seo title={problem?.title || "Solve"} noindex={true} path={`/problems/${slug}`} />

    <div className={`${styles.page} page-animate`}>

      {/* Mobile top tab switcher — LeetCode style */}
      <div className={styles.mobilePanelSwitch}>
        <button
          className={`${styles.mobilePanelBtn} ${mobilePanelTab === 'description' ? styles.mobilePanelBtnActive : ''}`}
          onClick={() => setMobilePanelTab('description')}
        >Description</button>
        <button
          className={`${styles.mobilePanelBtn} ${mobilePanelTab === 'editor' ? styles.mobilePanelBtnActive : ''}`}
          onClick={() => setMobilePanelTab('editor')}
        >Code</button>
      </div>

      <div className={styles.workspace}>

        <div className={`${styles.leftPanel} ${mobilePanelTab !== 'description' ? styles.mobileHidden : ''}`} style={{ width: leftPanel.size, minWidth: 280, maxWidth: 700 }}>
          <div className={styles.panelTabs}>
            {[
              { id: 'description', label: 'Description' },
              { id: 'ai',          label: 'AI Tutor'    },
              { id: 'submissions', label: 'Submissions' },
            ].map(t => (
              <button key={t.id}
                className={`${styles.tabBtn} ${activeTab === t.id ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className={styles.leftContent}>

            {activeTab === 'description' && (
              <div className={styles.descTab}>
                {problem.locked ? (
                  <div className={styles.lockedOverlay}>
                    <div className={styles.lockedIcon}>🔒</div>
                    <h3>Premium Problem</h3>
                    <p>This is a paid problem. Upgrade to Pro to unlock all problems.</p>
                    <button
                      className={`btn btn-primary ${styles.unlockBtn}`}
                      onClick={() => openPayment()}
                    >
                      Upgrade to Pro — ₹10/month
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={styles.probHeader}>
                      <h2 className={styles.probTitle}>
                        {problem.number}. {problem.title}
                        {isSolved && <span className={styles.solvedCheck}>Solved ✓</span>}
                      </h2>
                      <div className={styles.tagRow}>
                        <span className={`badge ${diffBadge(problem.difficulty)}`}>
                          {problem.difficulty}
                        </span>
                        {problem.tags?.length > 0 && (
                          <div className={styles.pillWrap}>
                            <button className={styles.metaPill}>Topics</button>
                            <div className={styles.pillDropdown}>
                              {problem.tags.map(t => (
                                <span key={t} className={styles.pillTag}>{t}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {problem.companies?.length > 0 && (
                          <div className={styles.pillWrap}>
                            <button className={styles.metaPill}>Companies</button>
                            <div className={styles.pillDropdown}>
                              {problem.companies.map(c => (
                                <span key={c} className={styles.pillTag}>{c}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.descBody}
                      dangerouslySetInnerHTML={{ __html: problem.description }} />

                    {examples.map((ex, i) => (
                      <div key={i} className={styles.exampleBox}>
                        <div className={styles.exampleTitle}>Example {i + 1}</div>
                        <div className={styles.exampleCode}>
                          <div><strong>Input:</strong> {ex.input}</div>
                          <div><strong>Output:</strong> {ex.output}</div>
                          {ex.explanation && <div><strong>Explanation:</strong> {ex.explanation}</div>}
                        </div>
                      </div>
                    ))}

                    {problem.constraints?.length > 0 && (
                      <div className={styles.constraintsBox}>
                        <div className={styles.constraintsTitle}>Constraints</div>
                        {problem.constraints.map((c, i) => (
                          <div key={i} className={styles.constraint}>• {c}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'ai' && (
              <div className={styles.aiTab}>
                <div className={styles.aiChat} ref={aiChatRef}>
                  {aiMessages.map((m, i) => (
                    <div key={i} className={`${styles.aiMsg} ${m.role === 'user' ? styles.userMsg : ''}`}>
                      <div className={`${styles.aiAvatar} ${m.role === 'user' ? styles.userAvatar : ''}`}>
                        {m.role === 'user'
                          ? <UserAvatar avatarUrl={user?.avatarUrl} name={user?.name} size={28} />
                          : 'CF'}
                      </div>
                      <div className={styles.aiBubble}
                        dangerouslySetInnerHTML={{
                          __html: m.text
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/`([^`]+)`/g, '<code>$1</code>')
                            .replace(/\n/g, '<br>'),
                        }}
                      />
                    </div>
                  ))}
                  {aiLoading && (
                    <div className={styles.aiMsg}>
                      <div className={styles.aiAvatar}>CF</div>
                      <div className={styles.aiBubble}>
                        <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.aiQuick}>
                  {['Hint', 'Approach', 'Complexity'].map(q => (
                    <button key={q} className={styles.quickBtn} onClick={() => sendAI(q)}>{q}</button>
                  ))}
                </div>
                <div className={styles.aiInputRow}>
                  <input className="input"
                    placeholder="Ask anything about this problem…"
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendAI()}
                  />
                  <button className="btn btn-primary btn-sm" onClick={sendAI}
                    disabled={aiLoading || !aiInput.trim()}>
                    Send
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'submissions' && (
              <div className={styles.subsTab}>
                {!user ? (
                  <p className="text-muted text-center" style={{ padding: 32 }}>Sign in to see your submissions.</p>
                ) : subsLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><span className="spinner" /></div>
                ) : submissions.length === 0 ? (
                  <p className="text-muted text-center" style={{ padding: 32 }}>No submissions yet.</p>
                ) : (
                  <div className={styles.subsList}>
                    {submissions.map(s => (
                      <div key={s._id} className={styles.subItem}>
                        <div>
                          <span className={`${styles.verdict} ${s.verdict === 'Accepted' ? styles.accepted : styles.failed}`}>
                            {s.verdict === 'Accepted' ? '✓' : '✕'} {s.verdict}
                          </span>
                          <div className={styles.subMeta}>
                            {s.language} · {s.runtime} · {s.testsPassed}/{s.testsTotal} tests · {new Date(s.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => { setCode(s.code); setLang(s.language); }}>
                          Load
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="resize-handle resize-handle-v" onMouseDown={leftPanel.onMouseDown} />

        <div className={`${styles.rightPanel} ${mobilePanelTab !== 'editor' ? styles.mobileHiddenRight : ''}`}>
          <div className={styles.editorHeader}>
            <select className={styles.langSelect} value={lang} onChange={e => setLang(e.target.value)}>
              {LANGS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            <div className={styles.editorActions}>
              <button className="btn btn-ghost btn-sm"
                onClick={() => { if (window.confirm('Reset code to starter template?')) setCode(problem?.starter?.[lang] || ''); }}>
                Reset
              </button>
            </div>
          </div>

          <div className={styles.editorWrap}>
            <textarea
              className={styles.editor}
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={handleEditorKey}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>

          <div className="resize-handle resize-handle-h" onMouseDown={consolePanel.onMouseDown} />

          <div className={styles.console} style={{ height: consolePanel.size, minHeight: 120 }}>
            <div className={styles.consoleTabs}>
              <button className={`${styles.consoleTab} ${consoleTab === 'testcase' ? styles.consoleTabActive : ''}`}
                onClick={() => setConsoleTab('testcase')}>Testcase</button>
              <button className={`${styles.consoleTab} ${consoleTab === 'result' ? styles.consoleTabActive : ''}`}
                onClick={() => setConsoleTab('result')}>Final Submission</button>
              <div className={styles.consoleRightBtns}>
                <button className="btn btn-secondary btn-sm" onClick={runCode} disabled={running || submitting}>
                  {running ? <><span className="spinner" /> Running…</> : '▶ Run'}
                </button>
                <button className="btn btn-primary btn-sm" onClick={submitCode} disabled={running || submitting || problem?.locked}>
                  {submitting ? <><span className="spinner" /> Judging…</> : 'Submit'}
                </button>
              </div>
            </div>

            <div className={styles.consoleBody}>
              {consoleTab === 'testcase' && (
                <div className={styles.testcasePanel}>
                  <div className={styles.caseTabs}>
                    {examples.map((_, i) => {
                      const result = runResults?.[i];
                      return (
                        <button key={i}
                          className={`${styles.caseTab}
                            ${activeCase === i ? styles.caseTabActive : ''}
                            ${result ? (result.passed ? styles.caseTabPass : styles.caseTabFail) : ''}
                          `}
                          onClick={() => setActiveCase(i)}>
                          {result ? (result.passed ? '✓ ' : '✕ ') : ''}Case {i + 1}
                        </button>
                      );
                    })}
                  </div>

                  {runResults && runResults[activeCase] ? (
                    <div className={styles.caseResult}>
                      <div className={styles.caseBlock}>
                        <div className={styles.caseBlockLabel}>Input</div>
                        <pre className={styles.caseBlockPre}>{runResults[activeCase].input}</pre>
                      </div>
                      {!runResults[activeCase].stderr && (
                        <>
                          <div className={styles.caseBlock}>
                            <div className={styles.caseBlockLabel}>Expected</div>
                            <pre className={styles.caseBlockPre}>{runResults[activeCase].expected}</pre>
                          </div>
                          <div className={styles.caseBlock}>
                            <div className={styles.caseBlockLabel}>Your Output</div>
                            <pre className={`${styles.caseBlockPre} ${!runResults[activeCase].passed ? styles.caseBlockFail : styles.caseBlockPass}`}>
                              {runResults[activeCase].actual || '(empty)'}
                            </pre>
                          </div>
                        </>
                      )}
                      {runResults[activeCase].stderr && (
                        <div className={styles.caseBlock}>
                          <div className={styles.caseBlockLabel} style={{ color: 'var(--red)' }}>
                            {runResults[activeCase].statusLabel || 'Error'}
                          </div>
                          <div className={styles.errorBox}>{runResults[activeCase].stderr}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={styles.varList}>
                      {caseVars.map((v, i) => (
                        <div key={i} className={styles.varRow}>
                          <div className={styles.varName}>{v.name} =</div>
                          <div className={styles.varValueBox}>
                            <textarea className={styles.varInput} value={v.value} rows={1}
                              onChange={e => {
                                const updated = [...caseVars];
                                updated[i] = { ...updated[i], value: e.target.value };
                                setCaseVars(updated);
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {consoleTab === 'result' && (
                <div className={styles.resultPanel}>
                  {!submitResult ? (
                    <span className="text-muted" style={{ fontSize: '.82rem' }}>
                      Click <strong>Submit</strong> to run against all test cases.
                    </span>
                  ) : submitResult.status === 'judging' ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="spinner" /> Judging against all test cases…
                    </div>
                  ) : (
                    <>
                      <div className={`${styles.verdictBig} ${submitResult.verdict === 'Accepted' ? styles.verdictAC : styles.verdictWA}`}>
                        {submitResult.verdict === 'Accepted' ? '✓ Accepted' : `✕ ${submitResult.verdict}`}
                      </div>
                      {submitResult.verdict === 'Accepted' && submitResult.beats && (
                        <div className={styles.beatLine}>
                          Faster than {submitResult.beats}% of {LANGS.find(l => l.id === lang)?.label} solutions
                        </div>
                      )}
                      <div className={styles.verdictMeta}>
                        {submitResult.testsPassed}/{submitResult.testsTotal} tests passed
                        {submitResult.runtime && ` · ${submitResult.runtime}`}
                      </div>
                      {submitResult.failCase && (
                        <div className={styles.failCase}>
                          <div className={styles.failLabel}>Failed test case:</div>
                          <div className={styles.caseBlock}>
                            <div className={styles.caseBlockLabel}>Input</div>
                            <pre className={styles.caseBlockPre}>{submitResult.failCase.input}</pre>
                          </div>
                          <div className={styles.caseBlock}>
                            <div className={styles.caseBlockLabel}>Expected</div>
                            <pre className={styles.caseBlockPre}>{submitResult.failCase.expected}</pre>
                          </div>
                          <div className={styles.caseBlock}>
                            <div className={styles.caseBlockLabel} style={{ color: 'var(--red)' }}>Your Output</div>
                            <pre className={`${styles.caseBlockPre} ${styles.caseBlockFail}`}>{submitResult.failCase.actual}</pre>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <PaymentModal show={showPayment} onClose={() => setShowPayment(false)} />
    </div>
    </>
  );
}

function parseVars(inputStr) {
  if (!inputStr) return [];
  const parts = inputStr.split(/,\s*(?=[a-zA-Z_]\w*\s*=)/);
  return parts.map(p => {
    const eq = p.indexOf('=');
    if (eq === -1) return { name: 'input', value: p.trim() };
    return { name: p.slice(0, eq).trim(), value: p.slice(eq + 1).trim() };
  }).filter(v => v.value !== '');
}
