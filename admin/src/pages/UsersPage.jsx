import { useState, useEffect, useCallback } from 'react'
import ConfirmModal from '../components/ConfirmModal'

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString() : '—'
}

export default function UsersPage({ apiFetch, toast }) {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setUsers(await apiFetch('/api/users')) }
    catch (e) { toast('Failed to load users: ' + e.message, 'error') }
    finally { setLoading(false) }
  }, [apiFetch, toast])

  useEffect(() => { load() }, [load])

  const togglePro = async id => {
    try {
      const r = await apiFetch(`/api/users/${id}/plan`, { method: 'PATCH' })
      setUsers(us => us.map(u => u._id === id ? { ...u, plan: r.plan } : u))
      toast(`Plan updated to ${r.plan}`, 'success')
    } catch (e) { toast('Update failed: ' + e.message, 'error') }
  }

  const deleteUser = (id, name) => {
    setConfirm({
      msg: `Delete user "${name}"?`,
      sub: 'All their data including submissions and progress will be permanently removed.',
      onOk: async () => {
        try {
          await apiFetch(`/api/users/${id}`, { method: 'DELETE' })
          toast(`User "${name}" deleted`, 'success'); load()
        } catch (e) { toast('Delete failed: ' + e.message, 'error') }
      },
    })
  }

  return (
    <>
      <div className="page-header">
        <div><h1>Users</h1><p>Manage registered users</p></div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Rating</th><th>Solved</th><th>Plan</th><th>Joined</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="loading-row"><span className="spinner" /> Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="loading-row">No users found.</td></tr>
            ) : users.map(u => (
              <tr key={u._id} className={u.isAdmin ? 'admin-row' : ''}>
                <td data-label="User">
                  <div className="user-cell">
                    <div className="user-avatar">{u.initials || '??'}</div>
                    <div>
                      <div className="user-name">{u.name}</div>
                      {u.isAdmin && <span className="badge badge-orange" style={{ fontSize: '.62rem' }}>Admin</span>}
                    </div>
                  </div>
                </td>
                <td data-label="Email" className="muted" style={{ fontSize: '.8rem' }}>{u.email}</td>
                <td data-label="Rating" className="mono text-purple">{u.rating || 0}</td>
                <td data-label="Solved" className="mono">{(u.solved || []).length}</td>
                <td data-label="Plan">
                  <span className={`badge ${u.plan === 'pro' ? 'badge-green' : 'badge-info'}`}>
                    {u.plan || 'free'}
                  </span>
                </td>
                <td data-label="Joined" className="muted" style={{ fontSize: '.78rem' }}>{formatDate(u.createdAt)}</td>
                <td data-label="Actions">
                  <div className="action-btns">
                    <button className="btn btn-ghost btn-sm" onClick={() => togglePro(u._id)}>
                      {u.plan === 'pro' ? 'Cancel Pro' : 'Give Pro'}
                    </button>
                    {!u.isAdmin && (
                      <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u._id, u.name)}>Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmModal confirm={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}
