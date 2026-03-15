import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Search, ChevronRight, CheckCircle, ArrowRight, Users } from 'lucide-react'
import api from '../utils/api'
import Breadcrumbs from '../components/Breadcrumbs'

const STATE_NAMES = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
  CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',
  LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
  MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
  NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',
  OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',
  WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'
}

function FindMyBallotPage() {
  const [state, setState] = useState('')
  const [county, setCounty] = useState('')
  const [counties, setCounties] = useState([])
  const [candidates, setCandidates] = useState([])
  const [races, setRaces] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    if (!state) {
      setCounties([])
      setCounty('')
      return
    }
    api.get(`/search/locations/cities?state=${state}`)
      .catch(() => [])
  }, [state])

  const handleSearch = async () => {
    if (!state) return
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams({ state, limit: '100' })
      if (county) params.set('county', county)

      const [candidateData, raceData] = await Promise.all([
        api.get(`/search/candidates/by-location?${params.toString()}`).catch(() => ({ candidates: [] })),
        api.get(`/races?state=${state}&limit=50`).catch(() => ({ races: [] })),
      ])

      setCandidates(candidateData.candidates || [])
      setRaces(raceData.races || [])
    } catch {
      setCandidates([])
      setRaces([])
    } finally {
      setLoading(false)
    }
  }

  const groupByLevel = (candidates) => {
    const groups = { federal: [], state: [], county: [], local: [] }
    candidates.forEach(c => {
      const level = c.office_level || 'state'
      if (groups[level]) groups[level].push(c)
      else groups.state.push(c)
    })
    return groups
  }

  const grouped = groupByLevel(candidates)
  const levelLabels = { federal: 'Federal', state: 'State', county: 'County', local: 'Local' }

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Find My Ballot' }]} />
          <h1>Find My Ballot</h1>
          <p className="page-subtitle">
            Discover who's running in your area at every level of government.
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        {/* Location Selection */}
        <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <MapPin size={24} style={{ color: 'var(--burgundy-500)' }} />
            <h2 style={{ margin: 0 }}>Enter Your Location</h2>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '0.375rem' }}>
                State *
              </label>
              <select
                value={state}
                onChange={(e) => { setState(e.target.value); setCounty(''); setSearched(false) }}
                style={{ width: '100%' }}
              >
                <option value="">Select your state...</option>
                {Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
                  <option key={abbr} value={abbr}>{name}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '0.375rem' }}>
                County (optional)
              </label>
              <input
                type="text"
                value={county}
                onChange={(e) => setCounty(e.target.value)}
                placeholder="e.g. Los Angeles"
                style={{ width: '100%' }}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSearch}
              disabled={!state || loading}
              style={{ padding: '0.75rem 1.5rem', whiteSpace: 'nowrap' }}
            >
              <Search size={18} /> {loading ? 'Searching...' : 'Find My Ballot'}
            </button>
          </div>
        </div>

        {/* Results */}
        {loading && <div className="loading-state">Finding candidates in your area...</div>}

        {searched && !loading && candidates.length === 0 && (
          <div className="empty-state">
            <Users size={48} style={{ color: 'var(--slate-400)', marginBottom: '1rem' }} />
            <h3>No candidates found for this location</h3>
            <p>Try selecting just your state, or check back as more candidates are added.</p>
            <Link to="/explore" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Browse All Candidates <ArrowRight size={18} />
            </Link>
          </div>
        )}

        {searched && !loading && candidates.length > 0 && (
          <div>
            <div style={{ marginBottom: '1.5rem', color: 'var(--slate-600)' }}>
              Found <strong>{candidates.length}</strong> candidates in {STATE_NAMES[state] || state}
              {county ? `, ${county} County` : ''}
            </div>

            {Object.entries(grouped).map(([level, levelCandidates]) => {
              if (levelCandidates.length === 0) return null
              return (
                <div key={level} style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.125rem', color: 'var(--navy-800)', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--slate-200)' }}>
                    {levelLabels[level]} ({levelCandidates.length})
                  </h3>
                  <div className="candidate-grid">
                    {levelCandidates.map(candidate => {
                      const name = candidate.display_name || `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Candidate'
                      return (
                        <Link
                          to={`/candidate/${candidate.id}`}
                          key={candidate.id}
                          className="card candidate-card"
                        >
                          <div className="candidate-card-top">
                            <div className="candidate-avatar">
                              {name.charAt(0)}{(name.split(' ')[1] || '').charAt(0)}
                            </div>
                            <div className="candidate-info">
                              <h4 className="candidate-name">{name}</h4>
                              <div className="candidate-race">{candidate.office_name || candidate.official_title || ''}</div>
                              <div className="candidate-badges">
                                {candidate.party_affiliation && (
                                  <span className="badge" style={{ background: 'var(--slate-100)', color: 'var(--slate-600)' }}>{candidate.party_affiliation}</span>
                                )}
                                {candidate.candidate_verified && (
                                  <span className="badge badge-verified"><CheckCircle size={12} /> Verified</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="candidate-stats">
                            <div className="stat">
                              <div className="stat-value" style={{
                                color: (candidate.qa_response_rate || 0) >= 80 ? 'var(--success)' :
                                       (candidate.qa_response_rate || 0) >= 50 ? 'var(--warning)' : 'var(--error)'
                              }}>
                                {candidate.qa_response_rate || 0}%
                              </div>
                              <div className="stat-label">Response Rate</div>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Races in this area */}
            {races.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h3 style={{ fontSize: '1.125rem', color: 'var(--navy-800)', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--slate-200)' }}>
                  Upcoming Races ({races.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {races.map(race => (
                    <Link key={race.id} to={`/races/${race.id}`} className="card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                      <div>
                        <h4 style={{ marginBottom: '0.25rem' }}>{race.name}</h4>
                        <span style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>
                          {race.office_name || ''}{race.election_date ? ` • ${new Date(race.election_date).toLocaleDateString()}` : ''}
                        </span>
                      </div>
                      <ChevronRight size={20} style={{ color: 'var(--slate-400)' }} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default FindMyBallotPage
