import React, { useState, useEffect, useCallback } from 'react'
import { Search, CheckCircle, XCircle, Edit2, Trash2, GitMerge, Save, X } from 'lucide-react'
import api from '../../utils/api'
import AdminLayout from './AdminLayout'

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [mergeTarget, setMergeTarget] = useState(null)
  const [page, setPage] = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '50', offset: String(page * 50) })
    if (search) params.set('search', search)
    if (filter !== 'all') params.set('verified', filter)
    api.get(`/admin/candidates?${params}`, true)
      .then(data => { setCandidates(data.candidates || []); setTotal(data.total || 0) })
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false))
  }, [search, filter, page])

  useEffect(() => { load() }, [load])

  const toggleVerify = async (id, current) => {
    try {
      await api.post(`/admin/candidates/${id}/verify`, { verified: !current }, true)
      setCandidates(prev => prev.map(c => c.id === id ? { ...c, candidate_verified: !current } : c))
    } catch (err) {
      alert(err.message)
    }
  }

  const startEdit = (c) => {
    setEditing(c.id)
    setEditForm({ displayName: c.display_name, partyAffiliation: c.party_affiliation, officialTitle: c.official_title, fullBio: c.full_bio })
  }

  const saveEdit = async (id) => {
    try {
      const updated = await api.put(`/admin/candidates/${id}`, editForm, true)
      setCandidates(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c))
      setEditing(null)
    } catch (err) {
      alert(err.message)
    }
  }

  const deleteCandidate = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/admin/candidates/${id}`, true)
      setCandidates(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  const mergeCandidates = async (keepId, mergeId) => {
    if (!confirm('Merge these candidates? All data from the merged candidate will be moved to the kept candidate.')) return
    try {
      await api.post('/admin/candidates/merge', { keepId, mergeId }, true)
      setMergeTarget(null)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h2>Candidates ({total})</h2>
      </div>

      <div className="admin-filters">
        <div className="admin-search-wrap">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search candidates..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          />
        </div>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0) }}>
          <option value="all">All</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </select>
      </div>

      {loading ? <div className="loading-state">Loading candidates...</div> : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Party</th>
                  <th>Title</th>
                  <th>Verified</th>
                  <th>Source</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(c => (
                  <tr key={c.id}>
                    <td>
                      {editing === c.id ? (
                        <input value={editForm.displayName || ''} onChange={e => setEditForm({ ...editForm, displayName: e.target.value })} style={{ width: '100%' }} />
                      ) : (
                        <span style={{ fontWeight: 600 }}>{c.display_name}</span>
                      )}
                      {c.is_shadow_profile && <span className="badge" style={{ marginLeft: '0.5rem', background: 'var(--slate-100)', color: 'var(--slate-600)', fontSize: '0.625rem' }}>Shadow</span>}
                    </td>
                    <td>
                      {editing === c.id ? (
                        <input value={editForm.partyAffiliation || ''} onChange={e => setEditForm({ ...editForm, partyAffiliation: e.target.value })} style={{ width: '100%' }} />
                      ) : (
                        c.party_affiliation || '-'
                      )}
                    </td>
                    <td>
                      {editing === c.id ? (
                        <input value={editForm.officialTitle || ''} onChange={e => setEditForm({ ...editForm, officialTitle: e.target.value })} style={{ width: '100%' }} />
                      ) : (
                        c.official_title || '-'
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => toggleVerify(c.id, c.candidate_verified)}
                        className="admin-icon-btn"
                        title={c.candidate_verified ? 'Click to unverify' : 'Click to verify'}
                      >
                        {c.candidate_verified
                          ? <CheckCircle size={18} style={{ color: 'var(--success)' }} />
                          : <XCircle size={18} style={{ color: 'var(--slate-400)' }} />
                        }
                      </button>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--slate-600)' }}>{c.verification_source || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {editing === c.id ? (
                          <>
                            <button className="admin-icon-btn" onClick={() => saveEdit(c.id)} title="Save"><Save size={16} style={{ color: 'var(--success)' }} /></button>
                            <button className="admin-icon-btn" onClick={() => setEditing(null)} title="Cancel"><X size={16} /></button>
                          </>
                        ) : (
                          <>
                            <button className="admin-icon-btn" onClick={() => startEdit(c)} title="Edit"><Edit2 size={16} /></button>
                            <button className="admin-icon-btn" onClick={() => setMergeTarget(mergeTarget === c.id ? null : c.id)} title="Merge">
                              <GitMerge size={16} style={mergeTarget === c.id ? { color: 'var(--burgundy-600)' } : {}} />
                            </button>
                            {mergeTarget && mergeTarget !== c.id && (
                              <button
                                className="btn btn-accent"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                onClick={() => mergeCandidates(c.id, mergeTarget)}
                              >
                                Keep This
                              </button>
                            )}
                            <button className="admin-icon-btn" onClick={() => deleteCandidate(c.id, c.display_name)} title="Delete"><Trash2 size={16} style={{ color: 'var(--error)' }} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {mergeTarget && (
            <div style={{ padding: '0.75rem', background: 'var(--burgundy-600)', color: 'white', borderRadius: '6px', marginTop: '1rem', fontSize: '0.875rem' }}>
              Merge mode: Select another candidate and click "Keep This" to merge the selected candidate into it.
              <button onClick={() => setMergeTarget(null)} style={{ marginLeft: '1rem', color: 'white', background: 'none', border: '1px solid white', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>Cancel</button>
            </div>
          )}

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
