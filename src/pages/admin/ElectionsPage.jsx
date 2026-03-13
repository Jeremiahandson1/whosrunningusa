import React, { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, UserPlus } from 'lucide-react'
import api from '../../utils/api'
import AdminLayout from './AdminLayout'

export default function ElectionsPage() {
  const [elections, setElections] = useState([])
  const [races, setRaces] = useState([])
  const [offices, setOffices] = useState([])
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedElection, setExpandedElection] = useState(null)
  const [showElectionForm, setShowElectionForm] = useState(false)
  const [showRaceForm, setShowRaceForm] = useState(null)
  const [electionForm, setElectionForm] = useState({ name: '', electionDate: '', electionType: 'general', scope: 'state', state: '' })
  const [raceForm, setRaceForm] = useState({ officeId: '', name: '', description: '' })
  const [addCandidateIds, setAddCandidateIds] = useState({})

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/admin/elections', true).catch(() => []),
      api.get('/admin/offices', true).catch(() => []),
      api.get('/admin/candidates?limit=1000', true).catch(() => ({ candidates: [] })),
    ]).then(([e, o, c]) => {
      setElections(Array.isArray(e) ? e : [])
      setOffices(Array.isArray(o) ? o : [])
      setCandidates(c.candidates || [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const loadRaces = async (electionId, forceRefresh = false) => {
    if (!forceRefresh && expandedElection === electionId) { setExpandedElection(null); return }
    const data = await api.get(`/admin/races?electionId=${electionId}`, true).catch(() => [])
    setRaces(Array.isArray(data) ? data : [])
    setExpandedElection(electionId)
  }

  const createElection = async (e) => {
    e.preventDefault()
    try {
      await api.post('/admin/elections', electionForm, true)
      setShowElectionForm(false)
      setElectionForm({ name: '', electionDate: '', electionType: 'general', scope: 'state', state: '' })
      load()
    } catch (err) { alert(err.message) }
  }

  const deleteElection = async (id, name) => {
    if (!confirm(`Delete "${name}"? All races will also be deleted.`)) return
    try { await api.delete(`/admin/elections/${id}`, true); load() } catch (err) { alert(err.message) }
  }

  const createRace = async (e, electionId) => {
    e.preventDefault()
    try {
      await api.post('/admin/races', { electionId, ...raceForm }, true)
      setShowRaceForm(null)
      setRaceForm({ officeId: '', name: '', description: '' })
      await loadRaces(electionId, true)
    } catch (err) { alert(err.message) }
  }

  const deleteRace = async (id) => {
    if (!confirm('Delete this race?')) return
    try {
      await api.delete(`/admin/races/${id}`, true)
      setRaces(prev => prev.filter(r => r.id !== id))
    } catch (err) { alert(err.message) }
  }

  const addCandidateToRace = async (raceId) => {
    if (!addCandidateIds[raceId]) return
    try {
      await api.post(`/admin/races/${raceId}/candidates`, { candidateId: addCandidateIds[raceId] }, true)
      setAddCandidateIds(prev => ({ ...prev, [raceId]: '' }))
      await loadRaces(expandedElection, true)
    } catch (err) { alert(err.message) }
  }

  const removeCandidateFromRace = async (raceId, candidateId) => {
    try {
      await api.delete(`/admin/races/${raceId}/candidates/${candidateId}`, true)
      await loadRaces(expandedElection, true)
    } catch (err) { alert(err.message) }
  }

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h2>Elections & Races</h2>
        <button className="btn btn-primary" onClick={() => setShowElectionForm(!showElectionForm)} style={{ padding: '0.5rem 1rem' }}>
          <Plus size={16} /> New Election
        </button>
      </div>

      {showElectionForm && (
        <form onSubmit={createElection} className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '1rem' }}>Create Election</h4>
          <div className="admin-form-grid">
            <div>
              <label className="admin-label">Name</label>
              <input value={electionForm.name} onChange={e => setElectionForm({ ...electionForm, name: e.target.value })} required />
            </div>
            <div>
              <label className="admin-label">Date</label>
              <input type="date" value={electionForm.electionDate} onChange={e => setElectionForm({ ...electionForm, electionDate: e.target.value })} required />
            </div>
            <div>
              <label className="admin-label">Type</label>
              <select value={electionForm.electionType} onChange={e => setElectionForm({ ...electionForm, electionType: e.target.value })}>
                <option value="general">General</option>
                <option value="primary">Primary</option>
                <option value="special">Special</option>
                <option value="runoff">Runoff</option>
              </select>
            </div>
            <div>
              <label className="admin-label">Scope</label>
              <select value={electionForm.scope} onChange={e => setElectionForm({ ...electionForm, scope: e.target.value })}>
                <option value="federal">Federal</option>
                <option value="state">State</option>
                <option value="county">County</option>
                <option value="city">City</option>
              </select>
            </div>
            <div>
              <label className="admin-label">State</label>
              <input value={electionForm.state} onChange={e => setElectionForm({ ...electionForm, state: e.target.value })} placeholder="e.g. WI" maxLength="2" />
            </div>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>Create</button>
            <button type="button" className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => setShowElectionForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? <div className="loading-state">Loading elections...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {elections.map(el => (
            <div key={el.id} className="card" style={{ overflow: 'hidden' }}>
              <div
                style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => loadRaces(el.id)}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--navy-800)' }}>{el.name}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                    {new Date(el.election_date).toLocaleDateString()} &bull; {el.election_type} &bull; {el.scope}
                    {el.state && ` &bull; ${el.state}`}
                    &bull; {el.race_count || 0} races
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge" style={{ background: el.is_active ? 'rgba(47,133,90,0.1)' : 'var(--slate-100)', color: el.is_active ? 'var(--success)' : 'var(--slate-500)' }}>
                    {el.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button className="admin-icon-btn" onClick={(e) => { e.stopPropagation(); deleteElection(el.id, el.name) }}>
                    <Trash2 size={16} style={{ color: 'var(--error)' }} />
                  </button>
                  {expandedElection === el.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              {expandedElection === el.id && (
                <div style={{ borderTop: '1px solid var(--slate-200)', padding: '1rem 1.25rem', background: 'var(--slate-50)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem' }}>Races</h4>
                    <button className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }} onClick={() => setShowRaceForm(showRaceForm === el.id ? null : el.id)}>
                      <Plus size={14} /> Add Race
                    </button>
                  </div>

                  {showRaceForm === el.id && (
                    <form onSubmit={(e) => createRace(e, el.id)} style={{ marginBottom: '1rem', padding: '1rem', background: 'white', borderRadius: '6px', border: '1px solid var(--slate-200)' }}>
                      <div className="admin-form-grid">
                        <div>
                          <label className="admin-label">Office</label>
                          <select value={raceForm.officeId} onChange={e => setRaceForm({ ...raceForm, officeId: e.target.value })} required>
                            <option value="">Select office...</option>
                            {offices.map(o => <option key={o.id} value={o.id}>{o.name} ({o.office_level}{o.state ? `, ${o.state}` : ''})</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="admin-label">Race Name</label>
                          <input value={raceForm.name} onChange={e => setRaceForm({ ...raceForm, name: e.target.value })} required />
                        </div>
                      </div>
                      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                        <button type="submit" className="btn btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>Create Race</button>
                        <button type="button" className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }} onClick={() => setShowRaceForm(null)}>Cancel</button>
                      </div>
                    </form>
                  )}

                  {races.length === 0 && <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>No races yet.</p>}

                  {races.map(race => (
                    <div key={race.id} style={{ padding: '0.75rem', background: 'white', borderRadius: '6px', border: '1px solid var(--slate-200)', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{race.name || race.office_name}</span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginLeft: '0.5rem' }}>{race.candidate_count || 0} candidates</span>
                        </div>
                        <button className="admin-icon-btn" onClick={() => deleteRace(race.id)}><Trash2 size={14} style={{ color: 'var(--error)' }} /></button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select value={addCandidateIds[race.id] || ''} onChange={e => setAddCandidateIds(prev => ({ ...prev, [race.id]: e.target.value }))} style={{ flex: 1, padding: '0.375rem', fontSize: '0.8125rem' }}>
                          <option value="">Add candidate...</option>
                          {candidates.map(c => <option key={c.id} value={c.id}>{c.display_name} ({c.party_affiliation || 'No party'})</option>)}
                        </select>
                        <button className="admin-icon-btn" onClick={() => addCandidateToRace(race.id)} title="Add"><UserPlus size={16} style={{ color: 'var(--success)' }} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {elections.length === 0 && <div className="empty-state"><h3>No elections</h3><p>Create your first election above.</p></div>}
        </div>
      )}
    </AdminLayout>
  )
}
