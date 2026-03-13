import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { FileText, CheckCircle, HelpCircle, ArrowRight, Share2, Printer, X, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import useFocusTrap from '../hooks/useFocusTrap'
import Breadcrumbs from '../components/Breadcrumbs'
import OnboardingModal from '../components/OnboardingModal'

const votingGuideOnboardingSteps = [
  { title: 'Build Your Voting Guide', description: 'Create a personalized ballot for upcoming elections. Research candidates and make informed choices before heading to the polls.', icon: <FileText size={28} /> },
  { title: 'Pick Candidates for Each Race', description: 'Browse through each race, compare candidates side-by-side, and select your preferred candidate or mark yourself as undecided.', icon: <CheckCircle size={28} /> },
  { title: 'Share With Friends', description: 'Print your voting guide or share it with friends and family to help them make informed decisions too.', icon: <Users size={28} /> },
]

function VotingGuidePage() {
  const { user } = useAuth()
  const [guide, setGuide] = useState(null)
  const [races, setRaces] = useState([])
  const [elections, setElections] = useState([])
  const [selectedElection, setSelectedElection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pickingRace, setPickingRace] = useState(null)
  const [raceCandidates, setRaceCandidates] = useState([])
  const [saving, setSaving] = useState(false)

  const closePicker = useCallback(() => setPickingRace(null), [])
  const { trapRef } = useFocusTrap(!!pickingRace, closePicker)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    api.get('/elections')
      .then(data => {
        const electionsList = data.elections || []
        setElections(electionsList)
        if (electionsList.length > 0) {
          setSelectedElection(electionsList[0].id)
        }
      })
      .catch(() => setElections([]))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!user || !selectedElection) return
    setLoading(true)
    Promise.all([
      api.get(`/users/voting-guide/${selectedElection}`, true).catch(() => null),
      api.get(`/races?electionId=${selectedElection}&limit=100`).catch(() => ({ races: [] })),
    ]).then(([guideData, racesData]) => {
      setGuide(guideData?.guide || guideData || null)
      setRaces(racesData.races || [])
    }).finally(() => setLoading(false))
  }, [user, selectedElection])

  const handlePickCandidate = async (raceId, candidateId) => {
    if (!selectedElection) return
    setSaving(true)
    try {
      await api.post(`/users/voting-guide/${selectedElection}/pick`, {
        raceId,
        candidateId,
      }, true)
      // Refresh guide
      const data = await api.get(`/users/voting-guide/${selectedElection}`, true)
      setGuide(data?.guide || data || null)
      setPickingRace(null)
      setRaceCandidates([])
    } catch (err) {
      alert(err.message || 'Failed to save pick')
    } finally {
      setSaving(false)
    }
  }

  const handleMarkUndecided = async (raceId) => {
    if (!selectedElection) return
    setSaving(true)
    try {
      await api.post(`/users/voting-guide/${selectedElection}/pick`, {
        raceId,
        candidateId: null,
        isUndecided: true,
      }, true)
      const data = await api.get(`/users/voting-guide/${selectedElection}`, true)
      setGuide(data?.guide || data || null)
      setPickingRace(null)
    } catch (err) {
      alert(err.message || 'Failed to save pick')
    } finally {
      setSaving(false)
    }
  }

  const openPicker = async (raceId) => {
    setPickingRace(raceId)
    try {
      const data = await api.get(`/candidates?raceId=${raceId}`)
      setRaceCandidates(data.candidates || [])
    } catch {
      setRaceCandidates([])
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: 'My Voting Guide', url }) } catch (_e) { /* ignored */ }
    } else {
      await navigator.clipboard.writeText(url)
      alert('Link copied to clipboard!')
    }
  }

  if (!user) {
    return (
      <div>
        <div className="page-header">
          <div className="container">
            <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Voting Guide' }]} />
            <h1>Voting Guide Builder</h1>
            <p className="page-subtitle">Create your personalized ballot and take it to the polls.</p>
          </div>
        </div>
        <div className="container" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
          <div className="empty-state">
            <FileText size={48} style={{ color: 'var(--slate-400)', marginBottom: '1rem' }} />
            <h3>Sign in to build your voting guide</h3>
            <p>Create a free account to research candidates, make your picks, and build a personalized ballot.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
              <Link to="/login" className="btn btn-secondary">Sign In</Link>
              <Link to="/register" className="btn btn-primary">Create Account <ArrowRight size={18} /></Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <OnboardingModal pageKey="voting_guide" steps={votingGuideOnboardingSteps} />

      <div className="page-header">
        <div className="container">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Voting Guide' }]} />
          <h1>Your Voting Guide</h1>
          <p className="page-subtitle">Your personalized ballot for upcoming elections.</p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        {/* Print-only title */}
        <div className="voting-guide-print-title">My Voting Guide</div>

        {elections.length > 1 && (
          <div className="voting-guide-election-select" style={{ marginBottom: '2rem' }}>
            <select
              value={selectedElection || ''}
              onChange={(e) => setSelectedElection(e.target.value)}
              style={{ maxWidth: 300 }}
            >
              {elections.map(el => (
                <option key={el.id} value={el.id}>{el.name}</option>
              ))}
            </select>
          </div>
        )}

        {loading && <div className="loading-state" aria-live="polite">Loading your voting guide...</div>}

        {!loading && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={18} /> Print
              </button>
              <button className="btn btn-secondary" onClick={handleShare}>
                <Share2 size={18} /> Share
              </button>
            </div>

            {/* Existing picks */}
            {guide && guide.picks && guide.picks.length > 0 && (
              <div className="voting-guide-picks" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                {guide.picks.map((pick, idx) => (
                  <div key={idx} className="card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ marginBottom: '0.25rem' }}>{pick.race_name}</h4>
                      {pick.candidate_name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                          <span style={{ fontWeight: 600 }}>{pick.candidate_name}</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--slate-500)' }}>
                          <HelpCircle size={16} />
                          <span>Undecided</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }} onClick={() => openPicker(pick.race_id)}>
                        Change
                      </button>
                      {pick.candidate_id && (
                        <Link to={`/candidate/${pick.candidate_id}`} className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}>
                          View
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Available races to add picks for */}
            {races.length > 0 && (
              <div className="voting-guide-add-races">
                <h3 style={{ marginBottom: '1rem' }}>
                  {guide?.picks?.length > 0 ? 'Add More Races' : 'Choose Your Candidates'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {races
                    .filter(r => !guide?.picks?.some(p => p.race_id === r.id))
                    .map(race => (
                      <div key={race.id} className="card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ marginBottom: '0.25rem' }}>{race.name}</h4>
                          {race.candidate_count !== undefined && (
                            <span style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>
                              {race.candidate_count} candidate{race.candidate_count !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <button className="btn btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }} onClick={() => openPicker(race.id)}>
                          Pick Candidate
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {races.length === 0 && (!guide || !guide.picks || guide.picks.length === 0) && (
              <div className="empty-state">
                <FileText size={48} style={{ color: 'var(--slate-400)', marginBottom: '1rem' }} />
                <h3>No races available yet</h3>
                <p>Browse candidates to learn more while we add races to the database.</p>
                <Link to="/explore" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                  Find Candidates <ArrowRight size={18} />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Candidate picker modal */}
        {pickingRace && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setPickingRace(null)}>
            <div ref={trapRef} role="dialog" aria-modal="true" aria-label="Choose a candidate" className="card" style={{ maxWidth: 500, width: '100%', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Choose a Candidate</h3>
                <button onClick={() => setPickingRace(null)} aria-label="Close dialog" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-500)' }}>
                  <X size={20} />
                </button>
              </div>
              {raceCandidates.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {raceCandidates.map(c => {
                    const name = c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate'
                    return (
                      <button
                        key={c.id}
                        className="card"
                        style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', border: '1px solid var(--slate-200)', textAlign: 'left', width: '100%', background: 'white' }}
                        onClick={() => handlePickCandidate(pickingRace, c.id)}
                        disabled={saving}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--navy-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: 'var(--navy-700)', flexShrink: 0 }}>
                          {name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{name}</div>
                          {c.party_affiliation && <div style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>{c.party_affiliation}</div>}
                        </div>
                        {c.candidate_verified && <CheckCircle size={16} style={{ color: 'var(--success)', marginLeft: 'auto' }} />}
                      </button>
                    )
                  })}
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', marginTop: '0.5rem' }}
                    onClick={() => handleMarkUndecided(pickingRace)}
                    disabled={saving}
                  >
                    <HelpCircle size={18} /> Mark as Undecided
                  </button>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <p>No candidates found for this race yet.</p>
                  <button className="btn btn-secondary" onClick={() => handleMarkUndecided(pickingRace)} disabled={saving}>
                    Mark as Undecided
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default VotingGuidePage
