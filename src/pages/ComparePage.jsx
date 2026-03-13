import React, { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Search, CheckCircle, X, ArrowRight } from 'lucide-react'
import api from '../utils/api'

function ComparePage() {
  const [searchParams] = useSearchParams()
  const [selected, setSelected] = useState([])
  const [comparison, setComparison] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)

  const raceId = searchParams.get('race')

  useEffect(() => {
    if (raceId) {
      api.get(`/races/${raceId}/compare`)
        .then(data => setComparison(data))
        .catch(() => setComparison(null))
    } else {
      setComparison(null)
    }
  }, [raceId])

  const handleSearch = () => {
    if (!searchQuery.trim()) return
    setLoading(true)
    api.get(`/search?q=${encodeURIComponent(searchQuery)}&type=candidates`)
      .then(data => setSearchResults(data.candidates || []))
      .catch(() => setSearchResults([]))
      .finally(() => setLoading(false))
  }

  const [manualComparison, setManualComparison] = useState(null)
  const [comparingManual, setComparingManual] = useState(false)

  const addCandidate = (candidate) => {
    if (selected.length < 4 && !selected.find(c => c.id === candidate.id)) {
      setSelected([...selected, candidate])
    }
  }

  const removeCandidate = (id) => {
    setSelected(selected.filter(c => c.id !== id))
    setManualComparison(null)
  }

  const compareSelected = async () => {
    if (selected.length < 2) return
    setComparingManual(true)
    try {
      // Fetch full candidate data with positions for each
      const results = await Promise.all(
        selected.map(c => api.get(`/candidates/${c.id}`).catch(() => null))
      )
      const fullCandidates = results.filter(Boolean).map(r => r.candidate || r)

      // Collect all unique issues across candidates
      const issueMap = new Map()
      fullCandidates.forEach(c => {
        (c.positions || []).forEach(p => {
          const key = p.issue_id || p.issue_name
          if (!issueMap.has(key)) {
            issueMap.set(key, { id: key, name: p.category_name || p.issue_name || 'Unknown' })
          }
        })
      })

      setManualComparison({
        candidates: fullCandidates,
        issues: Array.from(issueMap.values()),
      })
    } catch {
      alert('Failed to load comparison data')
    } finally {
      setComparingManual(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Compare Candidates</h1>
          <p className="page-subtitle">
            See where candidates stand side-by-side on the issues that matter to you.
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        {/* If we have a race comparison from API */}
        {comparison && comparison.candidates && (
          <div style={{ marginBottom: '3rem' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{comparison.race?.name || 'Race Comparison'}</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid var(--slate-200)', minWidth: 150 }}>Issue</th>
                    {comparison.candidates.map(c => (
                      <th key={c.id} style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid var(--slate-200)', minWidth: 200 }}>
                        <Link to={`/candidate/${c.id}`} style={{ fontWeight: 700, color: 'var(--navy-800)' }}>
                          {c.display_name || c.name}
                        </Link>
                        {c.candidate_verified && <CheckCircle size={14} style={{ color: 'var(--success)', marginLeft: '0.375rem' }} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(comparison.issues || []).map((issue, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '1rem', fontWeight: 600, borderBottom: '1px solid var(--slate-200)' }}>{issue.name}</td>
                      {comparison.candidates.map(c => {
                        const pos = (c.positions || []).find(p => p.issue_id === issue.id)
                        return (
                          <td key={c.id} style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid var(--slate-200)' }}>
                            {pos ? (
                              <div>
                                <span style={{
                                  color: pos.stance === 'support' ? 'var(--success)' : pos.stance === 'oppose' ? 'var(--error)' : 'var(--warning)',
                                  fontWeight: 600
                                }}>
                                  {pos.stance === 'support' ? 'Supports' : pos.stance === 'oppose' ? 'Opposes' : 'Complex'}
                                </span>
                                {pos.explanation && (
                                  <p style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', margin: '0.25rem 0 0' }}>{pos.explanation}</p>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--slate-400)', fontSize: '0.875rem' }}>No position</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Manual comparison search */}
        {!comparison && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Search for candidates to compare</h3>
              <div style={{ display: 'flex', gap: '1rem', maxWidth: 500 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-500)' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search by name..."
                    style={{ paddingLeft: '3rem' }}
                  />
                </div>
                <button className="btn btn-primary" onClick={handleSearch}>Search</button>
              </div>
            </div>

            {/* Selected candidates */}
            {selected.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>Selected ({selected.length}/4)</h4>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {selected.map(c => (
                    <div key={c.id} className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600 }}>{c.display_name || c.name}</span>
                      <button onClick={() => removeCandidate(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-500)' }}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.length >= 2 && !manualComparison && (
              <div style={{ marginBottom: '2rem' }}>
                <button className="btn btn-primary" onClick={compareSelected} disabled={comparingManual}>
                  {comparingManual ? 'Loading...' : `Compare ${selected.length} Candidates`} <ArrowRight size={18} />
                </button>
              </div>
            )}

            {/* Manual comparison table */}
            {manualComparison && (
              <div style={{ marginBottom: '2rem', overflowX: 'auto' }}>
                <h2 style={{ marginBottom: '1.5rem' }}>Comparison</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid var(--slate-200)', minWidth: 150 }}>Issue</th>
                      {manualComparison.candidates.map(c => (
                        <th key={c.id} style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid var(--slate-200)', minWidth: 200 }}>
                          <Link to={`/candidate/${c.id}`} style={{ fontWeight: 700, color: 'var(--navy-800)' }}>
                            {c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()}
                          </Link>
                          {c.candidate_verified && <CheckCircle size={14} style={{ color: 'var(--success)', marginLeft: '0.375rem' }} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {manualComparison.issues.length > 0 ? manualComparison.issues.map((issue, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '1rem', fontWeight: 600, borderBottom: '1px solid var(--slate-200)' }}>{issue.name}</td>
                        {manualComparison.candidates.map(c => {
                          const pos = (c.positions || []).find(p => (p.issue_id || p.issue_name) === issue.id)
                          return (
                            <td key={c.id} style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid var(--slate-200)' }}>
                              {pos ? (
                                <div>
                                  <span style={{
                                    color: pos.stance === 'support' ? 'var(--success)' : pos.stance === 'oppose' ? 'var(--error)' : 'var(--warning)',
                                    fontWeight: 600
                                  }}>
                                    {pos.stance === 'support' ? 'Supports' : pos.stance === 'oppose' ? 'Opposes' : 'Complex'}
                                  </span>
                                  {pos.explanation && (
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', margin: '0.25rem 0 0' }}>{pos.explanation}</p>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--slate-400)', fontSize: '0.875rem' }}>No position</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={manualComparison.candidates.length + 1} style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-500)' }}>
                          None of these candidates have declared issue positions yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Search results */}
            {loading && <div className="loading-state">Searching...</div>}
            {searchResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                {searchResults.map(c => (
                  <div key={c.id} className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{c.display_name || c.name}</span>
                      {c.race_name && <span style={{ color: 'var(--slate-500)', marginLeft: '0.5rem', fontSize: '0.875rem' }}>{c.race_name}</span>}
                    </div>
                    <button className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }} onClick={() => addCandidate(c)}>
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!raceId && selected.length === 0 && searchResults.length === 0 && !loading && (
              <div className="empty-state" style={{ marginTop: '2rem' }}>
                <h3>Compare candidates in a race</h3>
                <p>Visit a race page and click "Compare Candidates" to see a side-by-side comparison, or search above to pick candidates manually.</p>
                <Link to="/races" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                  Browse Races <ArrowRight size={18} />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ComparePage
