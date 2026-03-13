import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, XCircle, Plus, Search, FileText } from 'lucide-react'
import api from '../../utils/api'
import AdminLayout from './AdminLayout'

const formatDisposition = (d) => d ? d.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : ''

export default function CriminalRecordsPage() {
  const [records, setRecords] = useState([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState({})

  // Add record form
  const [showAddForm, setShowAddForm] = useState(false)
  const [candidateSearch, setCandidateSearch] = useState('')
  const [candidateResults, setCandidateResults] = useState([])
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [addForm, setAddForm] = useState({ offense: '', year: '', jurisdiction: '', jurisdictionLevel: '', disposition: '', sentence: '' })
  const [addSaving, setAddSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api.get(`/admin/criminal-records/queue?status=${statusFilter}`, true)
      .then(data => setRecords(data.records || []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [statusFilter])

  const moderate = async (id, status) => {
    try {
      await api.put(`/admin/criminal-records/${id}/moderate`, { status, notes: notes[id] || '' }, true)
      setRecords(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      alert(err.message || 'Failed to moderate record')
    }
  }

  const searchCandidates = async () => {
    if (!candidateSearch.trim()) return
    try {
      const data = await api.get(`/admin/candidates?search=${encodeURIComponent(candidateSearch)}&limit=10`, true)
      setCandidateResults(data.candidates || [])
    } catch {
      setCandidateResults([])
    }
  }

  const addRecord = async () => {
    if (!selectedCandidate || !addForm.offense || !addForm.disposition) return
    setAddSaving(true)
    try {
      await api.post('/admin/criminal-records', {
        candidateId: selectedCandidate.id,
        ...addForm,
        year: addForm.year ? parseInt(addForm.year) : null,
      }, true)
      setAddForm({ offense: '', year: '', jurisdiction: '', jurisdictionLevel: '', disposition: '', sentence: '' })
      setSelectedCandidate(null)
      setCandidateSearch('')
      setCandidateResults([])
      setShowAddForm(false)
      if (statusFilter === 'pending') load()
      alert('Record added (pending moderation)')
    } catch (err) {
      alert(err.message || 'Failed to add record')
    } finally {
      setAddSaving(false)
    }
  }

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h2>Criminal Records</h2>
        <button className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={() => setShowAddForm(!showAddForm)}>
          <Plus size={16} /> Add System Record
        </button>
      </div>

      {/* Add system-pulled record form */}
      {showAddForm && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '1rem' }}>Add System-Pulled Record</h4>

          {/* Candidate search */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>Candidate</label>
            {selectedCandidate ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--slate-50)', borderRadius: '6px' }}>
                <span style={{ fontWeight: 600 }}>{selectedCandidate.display_name}</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>{selectedCandidate.party_affiliation}</span>
                <button type="button" className="btn btn-secondary" style={{ marginLeft: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => { setSelectedCandidate(null); setCandidateSearch('') }}>
                  Change
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" value={candidateSearch} onChange={e => setCandidateSearch(e.target.value)} placeholder="Search candidate by name..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchCandidates())} style={{ flex: 1 }} />
                <button type="button" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }} onClick={searchCandidates}>
                  <Search size={16} />
                </button>
              </div>
            )}
            {candidateResults.length > 0 && !selectedCandidate && (
              <div style={{ border: '1px solid var(--slate-200)', borderRadius: '6px', marginTop: '0.5rem', maxHeight: 200, overflow: 'auto' }}>
                {candidateResults.map(c => (
                  <button key={c.id} type="button" onClick={() => { setSelectedCandidate(c); setCandidateResults([]) }} style={{ display: 'block', width: '100%', padding: '0.5rem 0.75rem', background: 'none', border: 'none', borderBottom: '1px solid var(--slate-100)', textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ fontWeight: 600 }}>{c.display_name}</span>
                    {c.party_affiliation && <span style={{ color: 'var(--slate-500)', marginLeft: '0.5rem', fontSize: '0.875rem' }}>{c.party_affiliation}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Record fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>Offense *</label>
              <input type="text" value={addForm.offense} onChange={e => setAddForm(p => ({ ...p, offense: e.target.value }))} placeholder="Description of the offense" />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>Year</label>
                <input type="number" value={addForm.year} onChange={e => setAddForm(p => ({ ...p, year: e.target.value }))} placeholder="e.g. 2019" />
              </div>
              <div style={{ flex: 2, minWidth: 180 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>Jurisdiction</label>
                <input type="text" value={addForm.jurisdiction} onChange={e => setAddForm(p => ({ ...p, jurisdiction: e.target.value }))} placeholder="e.g. Cook County, IL" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>Jurisdiction Level</label>
                <select value={addForm.jurisdictionLevel} onChange={e => setAddForm(p => ({ ...p, jurisdictionLevel: e.target.value }))}>
                  <option value="">Select...</option>
                  <option value="county">County</option>
                  <option value="state">State</option>
                  <option value="federal">Federal</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>Disposition *</label>
                <select value={addForm.disposition} onChange={e => setAddForm(p => ({ ...p, disposition: e.target.value }))}>
                  <option value="">Select...</option>
                  <option value="convicted">Convicted</option>
                  <option value="acquitted">Acquitted</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="expunged">Expunged</option>
                  <option value="pending">Pending</option>
                  <option value="no_contest">No Contest</option>
                  <option value="deferred">Deferred</option>
                  <option value="pardoned">Pardoned</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>Sentence</label>
              <input type="text" value={addForm.sentence} onChange={e => setAddForm(p => ({ ...p, sentence: e.target.value }))} placeholder="e.g. 6 months probation" />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn btn-primary" disabled={addSaving || !selectedCandidate || !addForm.offense || !addForm.disposition} onClick={addRecord}>
                {addSaving ? 'Adding...' : 'Add Record'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['pending', 'approved', 'rejected'].map(s => (
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

      {loading ? <div className="loading-state">Loading records...</div> : (
        <>
          {records.length === 0 && (
            <div className="empty-state">
              <FileText size={48} style={{ color: 'var(--slate-400)', marginBottom: '1rem' }} />
              <h3>No {statusFilter} records</h3>
              <p>{statusFilter === 'pending' ? 'The moderation queue is clear.' : `No ${statusFilter} records.`}</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {records.map(record => (
              <div key={record.id} className="card" style={{ padding: '1.25rem', borderLeft: `3px solid ${statusFilter === 'pending' ? 'var(--warning)' : statusFilter === 'approved' ? 'var(--success)' : 'var(--error)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      <Link to={`/candidate/${record.candidate_id}`} style={{ fontWeight: 600, color: 'var(--navy-700)' }}>
                        {record.candidate_name}
                      </Link>
                      <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.5rem', background: 'var(--slate-100)', borderRadius: '4px', color: 'var(--slate-600)' }}>
                        {record.source === 'self_reported' ? 'Self-Reported' : 'System-Pulled'}
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: '0.375rem', color: 'var(--navy-800)' }}>
                      {record.offense}
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '0.5rem' }}>
                      <span>Disposition: {formatDisposition(record.disposition)}</span>
                      {record.year && <span>Year: {record.year}</span>}
                      {record.jurisdiction && <span>{record.jurisdiction}</span>}
                      {record.sentence && <span>Sentence: {record.sentence}</span>}
                    </div>
                    {record.candidate_statement && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--slate-600)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                        Candidate statement: "{record.candidate_statement}"
                      </div>
                    )}
                    <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                      Added {new Date(record.created_at).toLocaleString()}
                    </div>
                  </div>

                  {statusFilter === 'pending' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0, minWidth: 200 }}>
                      <textarea
                        value={notes[record.id] || ''}
                        onChange={e => setNotes(p => ({ ...p, [record.id]: e.target.value }))}
                        placeholder="Moderation notes (optional)"
                        rows={2}
                        style={{ fontSize: '0.8125rem', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-primary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8125rem' }} onClick={() => moderate(record.id, 'approved')}>
                          <CheckCircle size={14} /> Approve
                        </button>
                        <button className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8125rem' }} onClick={() => moderate(record.id, 'rejected')}>
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {record.moderation_notes && statusFilter !== 'pending' && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--slate-50)', borderRadius: '4px', fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                    Notes: {record.moderation_notes}
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
