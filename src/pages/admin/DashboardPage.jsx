import React, { useState, useEffect } from 'react'
import {
  RefreshCw, CheckCircle, XCircle, Clock, Database,
  Users, Vote, Building, AlertTriangle, Play
} from 'lucide-react'
import api from '../../utils/api'
import AdminLayout from './AdminLayout'

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [syncStatus, setSyncStatus] = useState([])
  const [syncing, setSyncing] = useState({})
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/admin/stats', true).catch(() => null),
      api.get('/admin/ingestion/status', true).catch(() => []),
    ]).then(([s, ss]) => {
      setStats(s)
      setSyncStatus(Array.isArray(ss) ? ss : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const triggerSync = async (source) => {
    setSyncing(p => ({ ...p, [source]: true }))
    try {
      const endpoints = {
        fec: '/admin/ingestion/sync/fec',
        open_states: '/admin/ingestion/sync/openstates',
        congress_gov: '/admin/ingestion/sync/congress',
        bills: '/admin/ingestion/sync/bills',
      }
      await api.post(endpoints[source], {}, true)
      alert(`${source} sync started. Check sync logs for progress.`)
    } catch (err) {
      if (err.status === 409 || (err.message && err.message.includes('already in progress'))) {
        setSyncing(p => ({ ...p, [source]: 'locked' }))
        alert('Sync already in progress for this source. Please wait for it to finish.')
        return
      }
      alert(err.message || 'Failed to start sync')
    } finally {
      setSyncing(p => ({ ...p, [source]: p[source] === 'locked' ? 'locked' : false }))
    }
  }

  const formatDate = (d) => d ? new Date(d).toLocaleString() : 'Never'

  const getStatusIcon = (status) => {
    if (status === 'success') return <CheckCircle size={16} style={{ color: 'var(--success)' }} />
    if (status === 'failed') return <XCircle size={16} style={{ color: 'var(--error)' }} />
    if (status === 'partial') return <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
    return <Clock size={16} style={{ color: 'var(--slate-500)' }} />
  }

  const syncSources = [
    { key: 'fec', label: 'FEC (Federal Candidates)' },
    { key: 'open_states', label: 'Open States (Legislators)' },
    { key: 'bills', label: 'Open States (Bills)' },
    { key: 'congress_gov', label: 'Congress.gov' },
  ]

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h2>Dashboard</h2>
        <button className="btn btn-secondary" onClick={load} style={{ padding: '0.5rem 1rem' }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {loading ? <div className="loading-state">Loading dashboard...</div> : (
        <>
          {/* Stats Grid */}
          {stats && (
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <Users size={24} style={{ color: 'var(--navy-600)' }} />
                <div className="admin-stat-value">{parseInt(stats.total_candidates || 0).toLocaleString()}</div>
                <div className="admin-stat-label">Total Candidates</div>
              </div>
              <div className="admin-stat-card">
                <CheckCircle size={24} style={{ color: 'var(--success)' }} />
                <div className="admin-stat-value">{parseInt(stats.verified_candidates || 0).toLocaleString()}</div>
                <div className="admin-stat-label">Verified</div>
              </div>
              <div className="admin-stat-card">
                <Vote size={24} style={{ color: 'var(--burgundy-600)' }} />
                <div className="admin-stat-value">{parseInt(stats.total_races || 0).toLocaleString()}</div>
                <div className="admin-stat-label">Races</div>
              </div>
              <div className="admin-stat-card">
                <Building size={24} style={{ color: 'var(--navy-500)' }} />
                <div className="admin-stat-value">{parseInt(stats.active_elections || 0).toLocaleString()}</div>
                <div className="admin-stat-label">Active Elections</div>
              </div>
              <div className="admin-stat-card">
                <Database size={24} style={{ color: 'var(--slate-600)' }} />
                <div className="admin-stat-value">{parseInt(stats.total_offices || 0).toLocaleString()}</div>
                <div className="admin-stat-label">Offices</div>
              </div>
              <div className="admin-stat-card">
                <Users size={24} style={{ color: 'var(--warning)' }} />
                <div className="admin-stat-value">{parseInt(stats.total_users || 0).toLocaleString()}</div>
                <div className="admin-stat-label">Users</div>
              </div>
            </div>
          )}

          {/* Sync Status */}
          <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Data Source Sync Status</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Last Sync</th>
                  <th>Status</th>
                  <th>Records</th>
                  <th>Errors</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {syncSources.map(src => {
                  const s = syncStatus.find(ss => ss.name === src.key) || {}
                  return (
                    <tr key={src.key}>
                      <td style={{ fontWeight: 600 }}>{src.label}</td>
                      <td>{formatDate(s.last_sync_at)}</td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          {getStatusIcon(s.last_sync_status)}
                          {s.last_sync_status || 'Never run'}
                        </span>
                      </td>
                      <td>
                        {s.records_fetched != null
                          ? `${s.records_created || 0} new / ${s.records_updated || 0} updated`
                          : '-'}
                      </td>
                      <td>
                        {s.errors_count > 0 ? (
                          <span style={{ color: 'var(--error)', fontWeight: 600 }}>{s.errors_count}</span>
                        ) : (
                          <span style={{ color: 'var(--slate-500)' }}>0</span>
                        )}
                      </td>
                      <td>
                        <button
                          className={`btn ${syncing[src.key] === 'locked' ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                          onClick={() => triggerSync(src.key)}
                          disabled={!!syncing[src.key]}
                        >
                          {syncing[src.key] === 'locked' ? (
                            <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Sync in Progress</>
                          ) : syncing[src.key] ? (
                            <><Play size={14} /> Starting...</>
                          ) : (
                            <><Play size={14} /> Sync Now</>
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Failed Syncs */}
          {syncStatus.some(s => s.last_sync_status === 'failed' && s.last_sync_error) && (
            <>
              <h3 style={{ marginTop: '2rem', marginBottom: '1rem', color: 'var(--error)' }}>Failed Sync Errors</h3>
              {syncStatus.filter(s => s.last_sync_status === 'failed').map(s => (
                <div key={s.name} className="card" style={{ padding: '1rem', marginBottom: '0.75rem', borderLeft: '3px solid var(--error)' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{s.display_name || s.name}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--slate-600)', fontFamily: 'monospace' }}>{s.last_sync_error}</div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </AdminLayout>
  )
}
