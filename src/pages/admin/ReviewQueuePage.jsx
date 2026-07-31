import React, { useState, useEffect } from 'react'
import { ClipboardCheck, CheckCircle, XCircle, Send } from 'lucide-react'
import api from '../../utils/api'
import AdminLayout from './AdminLayout'

const severityColor = (severity) => {
  const colors = {
    critical: 'var(--error)',
    high: '#d97706',
    medium: 'var(--warning)',
    low: 'var(--slate-400)'
  }
  return colors[severity] || 'var(--slate-400)'
}

const formatAmount = (low, high) => {
  if (low == null && high == null) return null
  const fmt = (n) => `$${Number(n).toLocaleString()}`
  if (low != null && high != null) return `${fmt(low)} – ${fmt(high)}`
  return fmt(low != null ? low : high)
}

export default function ReviewQueuePage() {
  const [tab, setTab] = useState('conflicts')
  const [conflicts, setConflicts] = useState([])
  const [gaps, setGaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState(null)

  const load = () => {
    setLoading(true)
    const req = tab === 'conflicts'
      ? api.get('/conflicts/admin/pending', true).then(data => setConflicts(data.data || []))
      : api.get('/accountability/admin/pending', true).then(data => setGaps(data.data || []))
    req
      .catch(() => (tab === 'conflicts' ? setConflicts([]) : setGaps([])))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tab])

  const act = async (endpoint, id, onSuccess) => {
    setActingId(id)
    try {
      await api.post(endpoint, {}, true)
      onSuccess()
    } catch (err) {
      alert(err.message)
    } finally {
      setActingId(null)
    }
  }

  const verifyConflict = (id) =>
    act(`/conflicts/admin/${id}/verify`, id, () =>
      setConflicts(prev => prev.map(c => c.id === id ? { ...c, verified: true } : c)))

  const publishConflict = (id) =>
    act(`/conflicts/admin/${id}/publish`, id, () =>
      setConflicts(prev => prev.filter(c => c.id !== id)))

  const rejectConflict = (id) => {
    if (!confirm('Reject and permanently delete this flag?')) return
    act(`/conflicts/admin/${id}/reject`, id, () =>
      setConflicts(prev => prev.filter(c => c.id !== id)))
  }

  const verifyGap = (id) =>
    act(`/accountability/admin/gaps/${id}/verify`, id, () =>
      setGaps(prev => prev.map(g => g.id === id ? { ...g, verified: true } : g)))

  const publishGap = (id) =>
    act(`/accountability/admin/gaps/${id}/publish`, id, () =>
      setGaps(prev => prev.filter(g => g.id !== id)))

  const items = tab === 'conflicts' ? conflicts : gaps

  const renderActions = (item, onVerify, onPublish, onReject) => (
    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
      {!item.verified && (
        <button
          className="btn btn-secondary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
          disabled={actingId === item.id}
          onClick={() => onVerify(item.id)}
        >
          <CheckCircle size={14} /> Verify
        </button>
      )}
      <button
        className="btn btn-primary"
        style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem', opacity: item.verified ? 1 : 0.5 }}
        disabled={actingId === item.id || !item.verified}
        title={item.verified ? 'Publish this item' : 'Verify before publishing'}
        onClick={() => onPublish(item.id)}
      >
        <Send size={14} /> Publish
      </button>
      {onReject && (
        <button
          className="btn btn-secondary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem', color: 'var(--error)' }}
          disabled={actingId === item.id}
          onClick={() => onReject(item.id)}
        >
          <XCircle size={14} /> Reject
        </button>
      )}
    </div>
  )

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h2>AI Content Review Queue</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[['conflicts', 'Conflicts'], ['gaps', 'Accountability Gaps']].map(([key, label]) => (
            <button
              key={key}
              className={`btn ${tab === key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="loading-state">Loading review queue...</div> : (
        <>
          {items.length === 0 && (
            <div className="empty-state">
              <ClipboardCheck size={48} style={{ color: 'var(--slate-400)', marginBottom: '1rem' }} />
              <h3>Queue is clear</h3>
              <p>No unpublished {tab === 'conflicts' ? 'conflict flags' : 'accountability gaps'} awaiting review.</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tab === 'conflicts' && conflicts.map(flag => (
              <div key={flag.id} className="card" style={{ padding: '1.25rem', borderLeft: `3px solid ${severityColor(flag.severity)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="badge" style={{ background: severityColor(flag.severity), color: '#fff', textTransform: 'capitalize' }}>{flag.severity}</span>
                      {flag.verified
                        ? <span className="badge" style={{ background: 'rgba(22,163,74,0.12)', color: 'var(--success)' }}>Verified</span>
                        : <span className="badge" style={{ background: 'var(--slate-100)', color: 'var(--slate-500)' }}>Unverified</span>}
                      {flag.confidence != null && (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                          Confidence: {Math.round(Number(flag.confidence) * 100)}%
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: '0.375rem', color: 'var(--navy-800)' }}>
                      {flag.politician_name}
                      {(flag.party || flag.state) && (
                        <span style={{ fontWeight: 400, color: 'var(--slate-500)' }}>
                          {' '}({[flag.party, flag.state].filter(Boolean).join(' – ')})
                        </span>
                      )}
                    </div>
                    {flag.description && (
                      <p style={{ fontSize: '0.9375rem', color: 'var(--slate-600)', marginBottom: '0.5rem' }}>{flag.description}</p>
                    )}
                    <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', display: 'flex', flexWrap: 'wrap', gap: '0.25rem 1rem' }}>
                      {flag.trade_ticker && <span>Trade: {flag.trade_ticker} ({flag.trade_type}){flag.trade_asset_name ? ` — ${flag.trade_asset_name}` : ''}</span>}
                      {formatAmount(flag.trade_amount_range_low, flag.trade_amount_range_high) && (
                        <span>Amount: {formatAmount(flag.trade_amount_range_low, flag.trade_amount_range_high)}</span>
                      )}
                      {flag.trade_date && <span>Trade date: {new Date(flag.trade_date).toLocaleDateString()}</span>}
                      {flag.vote_date && <span>Vote date: {new Date(flag.vote_date).toLocaleDateString()}</span>}
                      {flag.time_gap_days != null && <span>Gap: {flag.time_gap_days} days</span>}
                      {flag.bill_title && <span>Bill: {flag.bill_title}</span>}
                    </div>
                    {flag.ai_reasoning && (
                      <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--slate-50)', borderRadius: '4px', fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                        AI reasoning: {flag.ai_reasoning}
                      </div>
                    )}
                  </div>
                  {renderActions(flag, verifyConflict, publishConflict, rejectConflict)}
                </div>
              </div>
            ))}

            {tab === 'gaps' && gaps.map(gap => (
              <div key={gap.id} className="card" style={{ padding: '1.25rem', borderLeft: `3px solid ${severityColor(gap.gap_severity)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      {gap.gap_severity && (
                        <span className="badge" style={{ background: severityColor(gap.gap_severity), color: '#fff', textTransform: 'capitalize' }}>{gap.gap_severity}</span>
                      )}
                      {gap.gap_type && <span className="badge badge-candidate" style={{ textTransform: 'capitalize' }}>{String(gap.gap_type).replace(/_/g, ' ')}</span>}
                      {gap.topic_tag && <span className="badge" style={{ background: 'rgba(74,111,165,0.1)', color: 'var(--navy-600)' }}>{gap.topic_tag}</span>}
                      {gap.verified
                        ? <span className="badge" style={{ background: 'rgba(22,163,74,0.12)', color: 'var(--success)' }}>Verified</span>
                        : <span className="badge" style={{ background: 'var(--slate-100)', color: 'var(--slate-500)' }}>Unverified</span>}
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: '0.375rem', color: 'var(--navy-800)' }}>
                      {gap.politician_name}
                      {(gap.party_affiliation || gap.official_title) && (
                        <span style={{ fontWeight: 400, color: 'var(--slate-500)' }}>
                          {' '}({[gap.official_title, gap.party_affiliation].filter(Boolean).join(', ')})
                        </span>
                      )}
                    </div>
                    {gap.stated_position && (
                      <p style={{ fontSize: '0.9375rem', color: 'var(--slate-600)', marginBottom: '0.375rem' }}>
                        <strong>Stated position:</strong> {gap.stated_position}
                      </p>
                    )}
                    {gap.actual_action && (
                      <p style={{ fontSize: '0.9375rem', color: 'var(--slate-600)', marginBottom: '0.375rem' }}>
                        <strong>Actual action:</strong> {gap.actual_action}
                      </p>
                    )}
                    {gap.ai_analysis && (
                      <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--slate-50)', borderRadius: '4px', fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                        AI analysis: {gap.ai_analysis}
                      </div>
                    )}
                  </div>
                  {renderActions(gap, verifyGap, publishGap, null)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  )
}
