import React, { useState, useEffect } from 'react'
import { Shield, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import api from '../../utils/api'
import AdminLayout from './AdminLayout'

export default function ModerationPage() {
  const [flags, setFlags] = useState([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.get(`/admin/moderation?status=${statusFilter}`, true)
      .then(data => setFlags(Array.isArray(data) ? data : []))
      .catch(() => setFlags([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [statusFilter])

  const resolveFlag = async (id, status, actionTaken) => {
    try {
      await api.put(`/admin/moderation/${id}`, { status, actionTaken }, true)
      setFlags(prev => prev.filter(f => f.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  const getContentTypeLabel = (type) => {
    const labels = { post: 'Post', question: 'Question', answer: 'Answer', candidate: 'Candidate Profile' }
    return labels[type] || type
  }

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h2>Moderation Queue</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['pending', 'reviewed', 'actioned', 'dismissed'].map(s => (
            <button
              key={s}
              className={`btn ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', textTransform: 'capitalize' }}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="loading-state">Loading moderation queue...</div> : (
        <>
          {flags.length === 0 && (
            <div className="empty-state">
              <Shield size={48} style={{ color: 'var(--slate-400)', marginBottom: '1rem' }} />
              <h3>No {statusFilter} flags</h3>
              <p>{statusFilter === 'pending' ? 'The moderation queue is clear.' : `No ${statusFilter} items.`}</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {flags.map(flag => (
              <div key={flag.id} className="card" style={{ padding: '1.25rem', borderLeft: `3px solid ${flag.status === 'pending' ? 'var(--warning)' : flag.status === 'actioned' ? 'var(--error)' : 'var(--slate-300)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span className="badge badge-candidate">{getContentTypeLabel(flag.content_type)}</span>
                      {flag.flagged_by_ai && <span className="badge" style={{ background: 'rgba(74,111,165,0.1)', color: 'var(--navy-600)' }}>AI Flagged</span>}
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: '0.375rem', color: 'var(--navy-800)' }}>
                      Reason: {flag.reason || 'Not specified'}
                    </div>
                    {flag.details && (
                      <p style={{ fontSize: '0.9375rem', color: 'var(--slate-600)', marginBottom: '0.5rem' }}>{flag.details}</p>
                    )}
                    <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                      Flagged by: {flag.flagged_by_username || 'Unknown'} &bull; {new Date(flag.created_at).toLocaleString()}
                      {flag.reviewed_by_username && <> &bull; Reviewed by: {flag.reviewed_by_username}</>}
                    </div>
                  </div>

                  {flag.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
                        onClick={() => resolveFlag(flag.id, 'actioned', 'Content removed or hidden')}
                      >
                        <AlertTriangle size={14} /> Action
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
                        onClick={() => resolveFlag(flag.id, 'dismissed', 'No violation found')}
                      >
                        <XCircle size={14} /> Dismiss
                      </button>
                    </div>
                  )}

                  {flag.status !== 'pending' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: flag.status === 'actioned' ? 'var(--error)' : 'var(--success)', fontSize: '0.875rem', fontWeight: 600 }}>
                      {flag.status === 'actioned' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                      {flag.status === 'actioned' ? 'Actioned' : 'Dismissed'}
                    </div>
                  )}
                </div>
                {flag.action_taken && (
                  <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--slate-50)', borderRadius: '4px', fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                    Action: {flag.action_taken}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  )
}
