import { useState, useEffect, useRef, useCallback } from 'react'
import ProblemModal      from '../components/ProblemModal'
import DeleteByNumModal  from '../components/DeleteByNumModal'
import ConfirmModal      from '../components/ConfirmModal'
import { diffBadgeClass } from '../utils/helpers'

function ProblemRow({ p, onEdit, onDelete, onTogglePremium }) {
  const [prem, setPrem] = useState(p.premium)
  useEffect(() => { setPrem(p.premium) }, [p.premium])

  const handleToggle = e => {
    const next = e.target.checked
    setPrem(next)
    onTogglePremium(p._id, next, prev => setPrem(prev))
  }

  return (
    <tr>
      <td data-label="#" className="mono muted">{p.number}</td>
      <td data-label="Title">
        <div className="prob-title">{p.title}</div>
        <div className="prob-sub">{(p.companies || []).slice(0, 3).join(' · ')}</div>
      </td>
      <td data-label="Difficulty"><span className={`badge ${diffBadgeClass(p.difficulty)}`}>{p.difficulty}</span></td>
      <td data-label="Tags" className="tags-cell">
        {(p.tags || []).slice(0, 3).map(t => <span key={t} className="tag-chip">{t}</span>)}
      </td>
      <td data-label="Accept" className="mono">{(p.acceptance || 0).toFixed(1)}%</td>
      <td data-label="Premium">
        <label className="toggle">
          <input type="checkbox" checked={prem} onChange={handleToggle} />
          <span className="toggle-slider" />
        </label>
      </td>
      <td data-label="Actions">
        <div className="action-btns">
          <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
          <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
        </div>
      </td>
    </tr>
  )
}

export default function ProblemsPage({ apiFetch, toast }) {
  const [problems, setProblems] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [diff,     setDiff]     = useState('')
  const [premOnly, setPremOnly] = useState(false)
  const [probModal,  setProbModal]  = useState(false)
  const [editing,    setEditing]    = useState(null)
  const [delModal,   setDelModal]   = useState(false)
  const [confirm,    setConfirm]    = useState(null)
  const fileRef = useRef()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/api/problems?limit=1000')
      setProblems(data.problems || [])
    } catch (e) {
      toast('Failed to load problems: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [apiFetch, toast])

  useEffect(() => { load() }, [load])

  const totals = {
    total: problems.length,
    easy:  problems.filter(p => p.difficulty === 'Easy').length,
    med:   problems.filter(p => p.difficulty === 'Medium').length,
    hard:  problems.filter(p => p.difficulty === 'Hard').length,
    prem:  problems.filter(p => p.premium).length,
  }

  const filtered = problems.filter(p => {
    const q = search.toLowerCase()
    return (
      (!q    || p.title.toLowerCase().includes(q) || (p.tags || []).some(t => t.toLowerCase().includes(q))) &&
      (!diff || p.difficulty === diff) &&
      (!premOnly || p.premium)
    )
  })

  const saveProblem = async (payload, id) => {
    try {
      if (id) {
        await apiFetch(`/api/problems/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
        toast(`Updated: ${payload.title}`, 'success')
      } else {
        const r = await apiFetch('/api/problems', { method: 'POST', body: JSON.stringify(payload) })
        toast(`Added: ${payload.title} (#${r.number})`, 'success')
      }
      setProbModal(false); setEditing(null); load()
    } catch (e) {
      toast('Save failed: ' + e.message, 'error')
      throw e
    }
  }

  const togglePremium = async (id, next, rollback) => {
    try {
      const r = await apiFetch(`/api/problems/${id}/toggle-premium`, { method: 'PATCH' })
      setProblems(ps => ps.map(p => p._id === id ? { ...p, premium: r.premium } : p))
      toast(`Premium ${r.premium ? 'enabled' : 'disabled'}`, 'success')
    } catch (e) {
      rollback(!next)
      toast('Toggle failed: ' + e.message, 'error')
    }
  }

  const deleteProb = (id, title, number) => {
    setConfirm({
      msg: `Delete "${title}"?`,
      sub: `Problem #${number} will be permanently deleted and all remaining problems renumbered.`,
      onOk: async () => {
        try {
          const r = await apiFetch(`/api/problems/${id}`, { method: 'DELETE' })
          toast(r.message, 'success'); load()
        } catch (e) { toast('Delete failed: ' + e.message, 'error') }
      },
    })
  }

  const uploadJSON = async file => {
    if (!file) return
    let parsed
    try { parsed = JSON.parse(await file.text()) }
    catch { toast('Invalid JSON file', 'error'); return }
    const arr = Array.isArray(parsed) ? parsed : [parsed]
    if (!arr.length || !arr[0].title) { toast('JSON must contain objects with a "title" field', 'error'); return }
    try {
      const r = await apiFetch('/api/problems/bulk', { method: 'POST', body: JSON.stringify({ problems: arr }) })
      const added   = r.results.filter(x => x.status === 'added').length
      const skipped = r.results.filter(x => x.status === 'skipped').length
      toast(`✓ ${added} added, ${skipped} skipped (duplicates)`, 'success'); load()
    } catch (e) { toast('Upload failed: ' + e.message, 'error') }
  }

  return (
    <>
      <div className="page-header">
        <div><h1>Problems</h1><p>Manage all coding problems</p></div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setDelModal(true)}>Delete by #</button>
          <button className="btn btn-secondary" onClick={() => fileRef.current.click()}>Upload JSON</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
            onChange={e => { uploadJSON(e.target.files[0]); e.target.value = '' }} />
          <button className="btn btn-primary" onClick={() => { setEditing(null); setProbModal(true) }}>
            + Add Problem
          </button>
        </div>
      </div>

      <div className="filter-row">
        <input className="input" placeholder="Search problems…" style={{ maxWidth: 300 }}
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" style={{ maxWidth: 160 }} value={diff} onChange={e => setDiff(e.target.value)}>
          <option value="">All Difficulty</option>
          <option>Easy</option><option>Medium</option><option>Hard</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.82rem', color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={premOnly} onChange={e => setPremOnly(e.target.checked)} /> Premium only
        </label>
      </div>

      <div className="mini-stats">
        <div className="mini-stat">{totals.total} Problems</div>
        <div className="mini-stat">{totals.easy} Easy</div>
        <div className="mini-stat">{totals.med} Medium</div>
        <div className="mini-stat">{totals.hard} Hard</div>
        <div className="mini-stat">{totals.prem} Premium</div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>#</th><th>Title</th><th>Difficulty</th><th>Tags</th><th>Acceptance</th><th>Premium</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="loading-row"><span className="spinner" /> Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="loading-row">No problems found.</td></tr>
            ) : filtered.map(p => (
              <ProblemRow key={p._id} p={p}
                onEdit={() => { setEditing(p); setProbModal(true) }}
                onDelete={() => deleteProb(p._id, p.title, p.number)}
                onTogglePremium={togglePremium} />
            ))}
          </tbody>
        </table>
      </div>

      <ProblemModal open={probModal} editingProb={editing}
        onClose={() => { setProbModal(false); setEditing(null) }} onSave={saveProblem} />
      <DeleteByNumModal open={delModal} problems={problems}
        onClose={() => setDelModal(false)} onDeleted={load} apiFetch={apiFetch} toast={toast} />
      <ConfirmModal confirm={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}
