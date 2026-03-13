import React, { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react'
import api from '../../utils/api'
import AdminLayout from './AdminLayout'

export default function SyncLogsPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [limit, setLimit] = useState(50)

  const load = () => {
    setLoading(true)
    api.get(`/admin/ingestion/sync-runs?limit=${limit}`, true)
      .then(data => setLogs(Array.isArray(data) ? data : []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [limit])

  const getStatusIcon = (status) => {
    if (status === 'success') return <CheckCircle size={16} style={{ color: 'var(--success)' }} />
    if (status === 'failed') return <XCircle size={16} style={{ color: 'var(--error)' }} />
    if (status === 'partial') return <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
    if (status === 'running') return <RefreshCw size={16} style={{ color: 'var(--navy-600)', animation: 'spin 1s linear infinite' }} />
    return <Clock size={16} style={{ color: 'var(--slate-500)' }} />
  }

  const getDuration = (start, end) => {
    if (!start || !end) return '-'
    const ms = new Date(end) - new Date(start)
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const getStatusBg = (status) => {
    if (status === 'success') return 'rgba(47,133,90,0.05)'
    if (status === 'failed') return 'rgba(197,48,48,0.05)'
    if (status === 'partial') return 'rgba(192,86,33,0.05)'
    return 'transparent'
  }

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h2>Sync Logs</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select value={limit} onChange={e => setLimit(parseInt(e.target.value))} style={{ padding: '0.375rem', width: 'auto' }}>
            <option value={20}>Last 20</option>
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
          </select>
          <button className="btn btn-secondary" onClick={load} style={{ padding: '0.5rem 1rem' }}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {loading ? <div className="loading-state">Loading sync logs...</div> : (
        <>
          {logs.length === 0 && (
            <div className="empty-state">
              <RefreshCw size={48} style={{ color: 'var(--slate-400)', marginBottom: '1rem' }} />
              <h3>No sync runs yet</h3>
              <p>Trigger a sync from the Dashboard to see logs here.</p>
            </div>
          )}

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Fetched</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Unchanged</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <React.Fragment key={log.id}>
                    <tr style={{ background: getStatusBg(log.status) }}>
                      <td style={{ fontWeight: 600 }}>{log.source_display_name || log.source_name}</td>
                      <td style={{ fontSize: '0.8125rem' }}>{new Date(log.started_at).toLocaleString()}</td>
                      <td>{getDuration(log.started_at, log.completed_at)}</td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          {getStatusIcon(log.status)}
                          <span style={{ textTransform: 'capitalize' }}>{log.status || 'running'}</span>
                        </span>
                      </td>
                      <td>{log.records_fetched ?? '-'}</td>
                      <td style={{ color: log.records_created > 0 ? 'var(--success)' : 'var(--slate-500)' }}>{log.records_created ?? '-'}</td>
                      <td>{log.records_updated ?? '-'}</td>
                      <td>{log.records_unchanged ?? '-'}</td>
                      <td>
                        {log.errors_count > 0 ? (
                          <span style={{ color: 'var(--error)', fontWeight: 600 }}>{log.errors_count}</span>
                        ) : (
                          <span style={{ color: 'var(--slate-500)' }}>0</span>
                        )}
                      </td>
                    </tr>
                    {log.error_log && (
                      <tr>
                        <td colSpan={9} style={{ padding: '0.5rem 1rem', background: 'rgba(197,48,48,0.03)' }}>
                          <details>
                            <summary style={{ cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--error)', fontWeight: 600 }}>Error Details</summary>
                            <pre style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--slate-700)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '150px', overflow: 'auto' }}>{log.error_log}</pre>
                          </details>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminLayout>
  )
}
