import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import styles from './Home.module.css';
import Seo from '../components/Seo.jsx';

export default function Home() {
  const { user } = useApp();
  if (user) return <Navigate to="/problems" replace />;
  return <Landing />;
}


function AnimatedCount({ target, suffix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1400;
          const start = performance.now();
          const num = parseFloat(target.replace(/[^0-9.]/g, ''));

          const animate = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * num));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.4 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  const num = parseFloat(target.replace(/[^0-9.]/g, ''));
  const prefix = target.replace(/[0-9.]+.*/, '');
  const rawSuffix = target.replace(/^[^0-9]*[0-9.]+/, '');

  return <span ref={ref}>{prefix}{count < num ? count : target.replace(/[0-9.]+/, num)}{count === Math.round(num) ? rawSuffix : ''}</span>;
}

function Landing() {
  const { openRegister, openLogin } = useApp();
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const stats = [
    { val: '160', suffix: '+',label: 'Problems' },
    { val: '5',    label: 'Languages' },
    { val: '10',suffix: '+', label: 'Companies' },
    { val: '99',  suffix: '%',label: 'Satisfaction' },
  ];

  const features = [
    {
      icon: '⚡',
      title: 'Real Code Execution',
      desc: 'Run your code against test cases instantly using our Judge0 engine — supports C++, Python, Java, C, and JavaScript.',
      color: 'var(--green)',
    },
    {
      icon: '🤖',
      title: 'AI Tutor',
      desc: 'Groq-powered AI mentor gives hints, explains approaches and analyzes your code without spoiling the solution.',
      color: 'var(--purple)',
    },
    {
      icon: '📊',
      title: 'Track Progress',
      desc: 'Visual heatmap, streak tracking, per-tag analytics and submission history to monitor your growth.',
      color: 'var(--blue)',
    },
    {
      icon: '🎯',
      title: 'Smart Recommendations',
      desc: 'AI-powered problem recommendations based on your solved history and skill gaps.',
      color: 'var(--orange)',
    },
    {
      icon: '🏆',
      title: 'Compete & Rank',
      desc: 'Global leaderboard and rating system inspired by competitive programming platforms.',
      color: 'var(--green)',
    },
    {
      icon: '🔒',
      title: 'Company Tags',
      desc: 'Filter problems by FAANG and top companies. Know exactly what to prepare for your dream interview.',
      color: 'var(--purple)',
    },
  ];

  const steps = [
    { num: '01', title: 'Create Account', desc: 'Sign up in seconds and get instant access to 150+ problems.' },
    { num: '02', title: 'Pick a Problem', desc: 'Browse by difficulty, topic, or company. Filter to match your level.' },
    { num: '03', title: 'Solve & Submit', desc: 'Write code, run it live against test cases, submit for full judgment.' },
    { num: '04', title: 'Get AI Help', desc: 'Stuck? Ask the AI Tutor for hints, approach, or code review.' },
  ];

  const langs = ['C++', 'Python', 'Java', 'C', 'JavaScript'];

  return (
    <>
    <Seo title="Home" path="/" />
    <div className={styles.landing}>


      <section className={styles.hero}>
        <div className={styles.heroGrid} />
        <div className={styles.heroGlow1} />
        <div className={styles.heroGlow2} />

        <div className={`${styles.heroContent} ${heroVisible ? styles.heroContentVisible : ''}`}>
          <h1 className={styles.heroTitle}>
            Master Coding<br />
            <span className={styles.heroAccent}>Interviews with AI</span>
          </h1>

          <p className={styles.heroSub}>
            160+ handcrafted problems, real-time code execution across 5 languages,
            AI-powered hints, and a global leaderboard — everything you need to crack top tech interviews.
          </p>



          <div className={styles.heroCtas}>
            <button className="btn btn-primary btn-lg" onClick={openRegister}>
              Start for Free
            </button>
            <button className="btn btn-secondary btn-lg" onClick={openLogin}>
              Sign In
            </button>
          </div>
        </div>


        <div className={`${styles.heroStats} ${heroVisible ? styles.heroStatsVisible : ''}`}>
          {stats.map((s, i) => (
            <div key={s.label} className={styles.statCard} style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
              <div className={styles.statVal}>
                <AnimatedCount target={s.val} />
                {s.suffix && <span>{s.suffix}</span>}
              </div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>


      </section>





      <section className={styles.featSection}>
        <div className={styles.sectionInner}>

          <h2 className={styles.sectionTitle}>Everything You Need to Level Up</h2>
          <p className={styles.sectionSub}>Built for serious developers preparing for top-tier interviews</p>

          <div className={styles.featGrid}>
            {features.map((f, i) => (
              <div
                key={f.title}
                className={styles.featCard}
                style={{ '--feat-color': f.color, animationDelay: `${i * 0.07}s` }}
              >

                <h3 className={styles.featTitle}>{f.title}</h3>
                <p className={styles.featDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
    </>
  );
}
