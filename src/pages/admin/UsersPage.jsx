import React, { useState, useEffect, useCallback } from 'react'
import { Search, Shield, Ban, UserCheck, ChevronDown, ChevronUp, Activity } from 'lucide-react'
import api from '../../utils/api'
import AdminLayout from './AdminLayout'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [expandedUser, setExpandedUser] = useState(null)
  const [activity, setActivity] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '50', offset: String(page * 50) })
    if (search) params.set('search', search)
    if (typeFilter) params.set('userType', typeFilter)
    api.get(`/admin/users?${params}`, true)
      .then(data => { setUsers(data.users || []); setTotal(data.total || 0) })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [search, typeFilter, page])

  useEffect(() => { load() }, [load])

  const toggleSuspend = async (id, currentBanned) => {
    const banReason = currentBanned ? null : prompt('Reason for suspension:')
    if (!currentBanned && banReason === null) return
    try {
      const result = await api.put(`/admin/users/${id}/suspend`, { banned: !currentBanned, banReason }, true)
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_banned: result.is_banned, ban_reason: result.ban_reason } : u))
    } catch (err) { alert(err.message) }
  }

  const changeRole = async (id, userType) => {
    if (!confirm(`Change this user's role to ${userType}?`)) return
    try {
      const result = await api.put(`/admin/users/${id}/role`, { userType }, true)
      setUsers(prev => prev.map(u => u.id === id ? { ...u, user_type: result.user_type } : u))
    } catch (err) { alert(err.message) }
  }

  const viewActivity = async (userId) => {
    if (expandedUser === userId) { setExpandedUser(null); return }
    setActivityLoading(true)
    setExpandedUser(userId)
    try {
      const data = await api.get(`/admin/users/${userId}/activity`, true)
      setActivity(Array.isArray(data) ? data : [])
    } catch { setActivity([]) }
    finally { setActivityLoading(false) }
  }

  const getRoleBadge = (type) => {
    const styles = {
      admin: { bg: 'rgba(139,41,66,0.1)', color: 'var(--burgundy-600)' },
      candidate: { bg: 'rgba(30,58,95,0.1)', color: 'var(--navy-600)' },
      voter: { bg: 'var(--slate-100)', color: 'var(--slate-600)' },
    }
    const s = styles[type] || styles.voter
    return <span className="badge" style={{ background: s.bg, color: s.color }}>{type}</span>
  }

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h2>Users ({total})</h2>
      </div>

      <div className="admin-filters">
        <div className="admin-search-wrap">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          />
        </div>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(0) }}>
          <option value="">All Types</option>
          <option value="voter">Voters</option>
          <option value="candidate">Candidates</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {loading ? <div className="loading-state">Loading users...</div> : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <React.Fragment key={u.id}>
                    <tr style={u.is_banned ? { background: 'rgba(197,48,48,0.03)' } : {}}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{u.first_name} {u.last_name}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>@{u.username}</div>
                      </td>
                      <td style={{ fontSize: '0.875rem' }}>{u.email}</td>
                      <td>{getRoleBadge(u.user_type)}</td>
                      <td style={{ fontSize: '0.875rem', color: 'var(--slate-600)' }}>{[u.city, u.state].filter(Boolean).join(', ') || '-'}</td>
                      <td>
                        {u.is_banned ? (
                          <span className="badge" style={{ background: 'rgba(197,48,48,0.1)', color: 'var(--error)' }}>Suspended</span>
                        ) : (
                          <span className="badge" style={{ background: 'rgba(47,133,90,0.1)', color: 'var(--success)' }}>Active</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            className="admin-icon-btn"
                            onClick={() => toggleSuspend(u.id, u.is_banned)}
                            title={u.is_banned ? 'Unsuspend' : 'Suspend'}
                          >
                            {u.is_banned ? <UserCheck size={16} style={{ color: 'var(--success)' }} /> : <Ban size={16} style={{ color: 'var(--error)' }} />}
                          </button>
                          {u.user_type !== 'admin' && (
                            <button
                              className="admin-icon-btn"
                              onClick={() => changeRole(u.id, 'admin')}
                              title="Promote to admin"
                            >
                              <Shield size={16} style={{ color: 'var(--burgundy-600)' }} />
                            </button>
                          )}
                          {u.user_type === 'admin' && (
                            <button
                              className="admin-icon-btn"
                              onClick={() => changeRole(u.id, 'voter')}
                              title="Demote to voter"
                            >
                              <Shield size={16} style={{ color: 'var(--slate-400)' }} />
                            </button>
                          )}
                          <button
                            className="admin-icon-btn"
                            onClick={() => viewActivity(u.id)}
                            title="View activity"
                          >
                            <Activity size={16} />
                            {expandedUser === u.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedUser === u.id && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0, background: 'var(--slate-50)' }}>
                          <div style={{ padding: '1rem 1.25rem' }}>
                            {u.ban_reason && <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(197,48,48,0.05)', borderRadius: '4px', fontSize: '0.875rem', color: 'var(--error)' }}>Ban reason: {u.ban_reason}</div>}
                            <h4 style={{ fontSize: '0.9375rem', marginBottom: '0.5rem' }}>Activity Log</h4>
                            {activityLoading ? <div style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>Loading...</div> : (
                              activity.length === 0 ? <div style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>No activity recorded.</div> : (
                                <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                                  {activity.map((a, i) => (
                                    <div key={i} style={{ padding: '0.375rem 0', borderBottom: '1px solid var(--slate-200)', fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between' }}>
                                      <span>{a.action} - {a.entity_type} {a.entity_id?.slice(0, 8)}</span>
                                      <span style={{ color: 'var(--slate-500)' }}>{new Date(a.created_at).toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-pagination">
            <button className="btn btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ padding: '0.375rem 0.75rem' }}>Previous</button>
            <span style={{ fontSize: '0.875rem', color: 'var(--slate-600)' }}>Page {page + 1} of {Math.max(1, Math.ceil(total / 50))}</span>
            <button className="btn btn-secondary" disabled={(page + 1) * 50 >= total} onClick={() => setPage(p => p + 1)} style={{ padding: '0.375rem 0.75rem' }}>Next</button>
          </div>
        </>
      )}
    </AdminLayout>
  )
}
