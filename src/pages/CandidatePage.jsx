import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  CheckCircle, MapPin, Calendar, MessageCircle, ThumbsUp,
  ChevronDown, ChevronUp, PlayCircle, FileText, ExternalLink,
  Clock, AlertCircle, Share2, Bell, Award, DollarSign, Star, Eye, EyeOff
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import DarkMoneyCallout from '../components/DarkMoneyCallout'
import RubberStampBadge from '../components/RubberStampBadge'
import PacPledgeBadge from '../components/PacPledgeBadge'
import { formatDate, formatDateTime } from '../utils/dateFormat'
import ConnectButton from '../components/ConnectButton'
import CommunityNotes from '../components/CommunityNotes'
import Breadcrumbs from '../components/Breadcrumbs'
import { SkeletonProfile } from '../components/Skeleton'
import { formatDisplayName } from '../utils/formatName'

function PromisesTab({ candidateId }) {
  const [promises, setPromises] = useState([])
  const [score, setScore] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get(`/promises/politician/${candidateId}`)
        setPromises(data.promises || [])
        setScore(data.score || null)
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [candidateId])

  if (loading) return <div style={{ textAlign: 'center', padding: 32, color: '#475569' }}>Loading promises...</div>

  const STATUS_COLORS = { kept: '#16a34a', broken: '#dc2626', in_progress: '#ca8a04', compromised: '#ea580c', pending: '#94a3b8' }
  const STATUS_LABELS = { kept: 'Kept', broken: 'Broken', in_progress: 'In Progress', compromised: 'Compromised', pending: 'Pending' }

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem' }}>Campaign Promises</h2>
      {score && (
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: score.promise_score >= 75 ? '#16a34a' : score.promise_score >= 50 ? '#ca8a04' : '#dc2626' }}>{Math.round(score.promise_score)}%</div>
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>PROMISE SCORE</div>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {['kept', 'in_progress', 'broken', 'compromised', 'pending'].map(s => (
              <div key={s} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: STATUS_COLORS[s] }}>{score[s] || 0}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>{STATUS_LABELS[s]}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {promises.length === 0 ? (
        <div className="empty-state"><p>No promises recorded yet.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {promises.map(p => (
            <div key={p.id} style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0', borderLeft: `4px solid ${STATUS_COLORS[p.status] || '#94a3b8'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <p style={{ margin: 0, flex: 1, lineHeight: 1.5 }}>{p.promise_text}</p>
                <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: `${STATUS_COLORS[p.status]}15`, color: STATUS_COLORS[p.status], whiteSpace: 'nowrap' }}>{STATUS_LABELS[p.status] || p.status}</span>
              </div>
              {p.status_explanation && <p style={{ margin: '8px 0 0', fontSize: 13, color: '#475569' }}>{p.status_explanation}</p>}
              {p.auto_checks && p.auto_checks.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>Auto-detected: {p.auto_checks[0].ai_reasoning}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Short, neutral explainers keyed on office_level + fec_office_type
const OFFICE_EXPLAINERS = {
  'federal:P': 'The President leads the executive branch, signs or vetoes legislation, and commands the armed forces. Elected every four years.',
  'federal:S': 'A U.S. Senator represents their entire state in Washington, serving six-year terms. The Senate confirms federal judges, ratifies treaties, and must pass every bill before it becomes law.',
  'federal:H': 'A U.S. Representative represents a single congressional district and serves a two-year term. The House originates all federal revenue (tax) bills and must pass every bill before it becomes law.',
  'state:governor': 'The Governor leads the state\'s executive branch, signs or vetoes state legislation, and sets the budget agenda.',
  'state:': 'A state-level elected official works on laws and policy inside a single state, including budgets, schools, roads, courts, and everything not reserved to the federal government.',
  'county:': 'A county-level elected official oversees county services — usually some combination of courts, elections, property records, public safety, or roads.',
  'local:': 'A local elected official oversees city or town services such as zoning, utilities, public safety, parks, and the local budget.',
}
function officeExplainer(c) {
  if (!c) return null
  const title = c.official_title || c.race_name || ''
  const t = title.toLowerCase()

  // Title-based detection first — works even when office_level/fec_office_type are null
  if (/president/.test(t) && !/vice/.test(t)) return OFFICE_EXPLAINERS['federal:P']
  if (/u\.?s\.?\s*senat|united states senat/.test(t)) return OFFICE_EXPLAINERS['federal:S']
  if (/u\.?s\.?\s*(house|representative)|united states (house|representative)/.test(t)) return OFFICE_EXPLAINERS['federal:H']
  if (/governor/.test(t)) return OFFICE_EXPLAINERS['state:governor']

  // Then structured fields
  if (c.office_level === 'federal' || c.fec_office_type) {
    if (c.fec_office_type === 'P') return OFFICE_EXPLAINERS['federal:P']
    if (c.fec_office_type === 'S') return OFFICE_EXPLAINERS['federal:S']
    if (c.fec_office_type === 'H') return OFFICE_EXPLAINERS['federal:H']
  }
  if (c.office_level === 'state') return OFFICE_EXPLAINERS['state:']
  if (c.office_level === 'county') return OFFICE_EXPLAINERS['county:']
  if (c.office_level === 'local') return OFFICE_EXPLAINERS['local:']
  return null
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  // Date-only strings parse as UTC; anchor both sides to UTC midnight so
  // the day count lines up with the formatted calendar date.
  const dateOnly = typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
  const target = new Date(dateStr)
  if (isNaN(target.getTime())) return null
  const now = new Date()
  const targetMs = dateOnly
    ? Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
    : target.getTime()
  const nowMs = dateOnly
    ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    : now.getTime()
  return Math.ceil((targetMs - nowMs) / (1000 * 60 * 60 * 24))
}

function CandidatePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [candidate, setCandidate] = useState(null)
  const [activeTab, setActiveTab] = useState('positions')
  const [expandedPosition, setExpandedPosition] = useState(null)
  const [questions, setQuestions] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [newQuestion, setNewQuestion] = useState('')
  const [askingQuestion, setAskingQuestion] = useState(false)
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [votingRecord, setVotingRecord] = useState({ votes: [], stats: {} })
  const [sponsorships, setSponsorships] = useState({ sponsorships: [], counts: [] })
  const [transparency, setTransparency] = useState(null)
  const [finance, setFinance] = useState([])
  const [ratings, setRatings] = useState([])
  const [background, setBackground] = useState({ education: [], experience: [], committees: [] })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [qaSort, setQaSort] = useState('upvotes')
  const [qaFilter, setQaFilter] = useState('all')
  const [relatedCandidates, setRelatedCandidates] = useState([])
  const [accountabilityScore, setAccountabilityScore] = useState(null)
  const [accountabilityGaps, setAccountabilityGaps] = useState([])
  const [donorIndustries, setDonorIndustries] = useState([])
  const [race, setRace] = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/candidates/${id}`).catch(() => null),
      api.get(`/questions/candidate/${id}?sort=${qaSort}&status=${qaFilter}`).catch(() => ({ questions: [] })),
      api.get(`/town-halls/candidate/${id}`).catch(() => ({ townHalls: [] })),
      api.get(`/candidates/${id}/voting-record?limit=20`).catch(() => ({ votes: [], stats: {} })),
      api.get(`/candidates/${id}/sponsorships?limit=20`).catch(() => ({ sponsorships: [], counts: [] })),
      api.get(`/candidates/${id}/transparency`).catch(() => null),
      api.get(`/candidates/${id}/finance`).catch(() => ({ finance: [] })),
      api.get(`/candidates/${id}/ratings`).catch(() => ({ ratings: [] })),
      api.get(`/candidates/${id}/background`).catch(() => ({ education: [], experience: [], committees: [] })),
      api.get(`/accountability/politicians/${id}/score`).catch(() => null),
      api.get(`/accountability/politicians/${id}/gaps`).catch(() => ({ gaps: [] })),
      api.get(`/accountability/politicians/${id}/donors`).catch(() => ({ donors: [] })),
    ]).then(([cData, qData, thData, vrData, spData, trData, finData, ratData, bgData, scoreData, gapsData, donorsData]) => {
      const c = cData?.candidate || cData
      setCandidate(c)
      setQuestions(qData?.questions || [])
      setEvents(thData?.townHalls || [])
      setVotingRecord({ votes: vrData?.votes || [], stats: vrData?.stats || {} })
      setSponsorships({ sponsorships: spData?.sponsorships || [], counts: spData?.counts || [] })
      setTransparency(trData)
      setFinance(finData?.finance || [])
      setRatings(ratData?.ratings || [])
      setBackground(bgData || { education: [], experience: [], committees: [] })
      setAccountabilityScore(scoreData)
      setAccountabilityGaps(gapsData?.gaps || [])
      setDonorIndustries(donorsData?.donors || [])
      if (c?.isFollowing) setFollowing(true)
      // Fetch related candidates + race details (for election date).
      // Shadow profiles (sitting officials ingested from congress-legislators
      // etc.) often lack race_id on the candidate row, so fall back to
      // /races?incumbent_id=... to find their upcoming race.
      if (c?.race_id) {
        api.get(`/candidates?raceId=${c.race_id}`).then(data => {
          const others = (data.candidates || []).filter(rc => rc.id !== c.id)
          setRelatedCandidates(others)
        }).catch(() => setRelatedCandidates([]))
        api.get(`/races/${c.race_id}`).then(data => {
          setRace(data?.race || data)
        }).catch(() => setRace(null))
      } else if (c?.id) {
        setRelatedCandidates([])
        api.get(`/races?incumbent_id=${c.id}&upcoming=true&limit=1`).then(data => {
          setRace((data?.races && data.races[0]) || null)
        }).catch(() => setRace(null))
      } else {
        setRelatedCandidates([])
        setRace(null)
      }
    }).finally(() => setLoading(false))
  }, [id])

  // Load Twitter widget script when candidate has a twitter handle
  useEffect(() => {
    if (!candidate?.twitter_handle) return
    if (window.twttr) {
      window.twttr.widgets.load()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.charset = 'utf-8'
    document.body.appendChild(script)
  }, [candidate?.twitter_handle])

  const handleFollow = async () => {
    if (!user) return alert('Please sign in to follow candidates')
    setFollowLoading(true)
    try {
      if (following) {
        await api.delete(`/users/follow/${id}`, true)
        setFollowing(false)
      } else {
        await api.post(`/users/follow/${id}`, {}, true)
        setFollowing(true)
      }
    } catch (err) {
      alert(err.message || 'Failed to update follow status')
    } finally {
      setFollowLoading(false)
    }
  }

  const handleRsvp = async (townHallId) => {
    if (!user) return alert('Please sign in to RSVP')
    try {
      await api.post(`/town-halls/${townHallId}/rsvp`, {}, true)
      alert('RSVP confirmed!')
    } catch (err) {
      alert(err.message || 'Failed to RSVP')
    }
  }

  const handleAskQuestion = async () => {
    if (!newQuestion.trim() || !user) return
    setAskingQuestion(true)
    try {
      const data = await api.post('/questions', { candidate_id: id, question_text: newQuestion }, true)
      const newQ = data.question || data
      setQuestions([{ ...newQ, question_text: newQuestion, upvote_count: 0, status: 'pending', created_at: new Date().toISOString(), asked_by_username: user?.username }, ...questions])
      setNewQuestion('')
    } catch (err) {
      alert(err.message || 'Failed to submit question')
    } finally {
      setAskingQuestion(false)
    }
  }

  const handleUpvote = async (questionId) => {
    if (!user) return
    try {
      await api.post(`/questions/${questionId}/upvote`, {}, true)
      setQuestions(questions.map(q =>
        q.id === questionId ? { ...q, upvote_count: (q.upvote_count || 0) + 1 } : q
      ))
    } catch (_e) { /* ignored */ }
  }

  const getStanceColor = (stance) => {
    switch (stance) {
      case 'support': return 'var(--success)'
      case 'oppose': return 'var(--error)'
      case 'complicated': return 'var(--warning)'
      default: return 'var(--slate-500)'
    }
  }

  const getStanceLabel = (stance) => {
    switch (stance) {
      case 'support': return 'Supports'
      case 'oppose': return 'Opposes'
      case 'complicated': return 'It\'s Complicated'
      default: return 'No Position'
    }
  }

  const formatCurrency = (value) => {
    if (value == null) return 'N/A'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
  }

  if (loading) return <SkeletonProfile />
  if (!candidate) return <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}><div className="empty-state"><h3>Candidate not found</h3><Link to="/explore" className="btn btn-primary" style={{ marginTop: '1rem' }}>Browse Candidates</Link></div></div>

  const name = formatDisplayName(candidate.display_name) || `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Candidate'
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="container" style={{ paddingTop: '0.5rem' }}>
        <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Explore', path: '/explore' }, { label: name }]} />
      </div>

      {/* Profile Header */}
      <div style={{ background: 'linear-gradient(180deg, var(--navy-800) 0%, var(--navy-900) 100%)', color: 'white', padding: '3rem 0 4rem' }}>
        <div className="container">
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'linear-gradient(135deg, var(--burgundy-500) 0%, var(--burgundy-700) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
              {(candidate.profile_pic_url || candidate.profile_photo_url)
                ? <img src={candidate.profile_pic_url || candidate.profile_photo_url} alt={`${name} profile photo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <h1 style={{ color: 'white', margin: 0 }}>{name}</h1>
                {candidate.candidate_verified && (
                  <span className="badge badge-verified" style={{ background: 'rgba(47, 133, 90, 0.2)' }}>
                    <CheckCircle size={12} /> Verified
                  </span>
                )}
                <PacPledgeBadge candidateId={id} />
              </div>
              <p style={{ fontSize: '1.25rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                {candidate.official_title || candidate.race_name || ''}
              </p>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.9375rem', opacity: 0.8 }}>
                {(candidate.state || candidate.city) && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <MapPin size={16} /> {[candidate.city, candidate.state].filter(Boolean).join(', ')}
                  </span>
                )}
                {candidate.party_affiliation && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Award size={16} /> {candidate.party_affiliation}
                  </span>
                )}
              </div>
              {race?.election_date && (() => {
                const d = daysUntil(race.election_date)
                const dateLabel = formatDate(race.election_date)
                if (d === null) return null
                const future = d >= 0
                return (
                  <div style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.875rem', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', fontSize: '0.875rem' }}>
                    <Calendar size={15} />
                    {future
                      ? <>Next election: <strong style={{ marginLeft: 4 }}>{dateLabel}</strong> <span style={{ opacity: 0.75 }}>({d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'} away`})</span></>
                      : <>Last election: <strong style={{ marginLeft: 4 }}>{dateLabel}</strong></>
                    }
                  </div>
                )
              })()}
              {candidate.full_bio && (
                <p style={{ marginTop: '1rem', maxWidth: '600px', lineHeight: 1.6, opacity: 0.9 }}>
                  {candidate.full_bio}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-primary" style={{ background: 'white', color: 'var(--navy-800)' }} onClick={handleFollow} disabled={followLoading}>
                <Bell size={18} /> {followLoading ? '...' : following ? 'Following' : 'Follow'}
              </button>
              <button className="btn btn-secondary" style={{ borderColor: 'white', color: 'white' }} onClick={async () => {
                const url = window.location.href
                if (navigator.share) {
                  try { await navigator.share({ title: name, url }) } catch (_e) { /* ignored */ }
                } else {
                  await navigator.clipboard.writeText(url)
                  alert('Link copied to clipboard!')
                }
              }}>
                <Share2 size={18} /> Share
              </button>
              {user && candidate.user_id && candidate.user_id !== user.id && (
                <ConnectButton userId={candidate.user_id} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--slate-200)', marginTop: '-2rem', position: 'relative', zIndex: 1 }}>
        <div className="container">
          <div className="card" style={{ display: 'flex', justifyContent: 'space-around', padding: '1.5rem', borderRadius: '12px', transform: 'translateY(-50%)', flexWrap: 'wrap', gap: '1rem' }}>
            <div className="stat">
              <div className="stat-value" style={{ color: (candidate.qa_response_rate || 0) >= 80 ? 'var(--success)' : (candidate.qa_response_rate || 0) >= 50 ? 'var(--warning)' : 'var(--error)' }}>
                {candidate.qa_response_rate || 0}%
              </div>
              <div className="stat-label">
                Response Rate{' '}
                <span style={{ fontWeight: 600 }}>
                  ({(candidate.qa_response_rate || 0) >= 80 ? 'High' : (candidate.qa_response_rate || 0) >= 50 ? 'Medium' : 'Low'})
                </span>
              </div>
            </div>
            <div className="stat">
              <div className="stat-value">{candidate.total_questions_answered || 0}</div>
              <div className="stat-label">Questions Answered</div>
            </div>
            <div className="stat">
              <div className="stat-value">{(candidate.total_questions_received || 0) - (candidate.total_questions_answered || 0)}</div>
              <div className="stat-label">Pending Questions</div>
            </div>
            <div className="stat">
              <div className="stat-value">{candidate.town_halls_held || 0}</div>
              <div className="stat-label">Town Halls Held</div>
            </div>
          </div>
        </div>
      </div>

      {/* Criminal Records - raw facts, no severity ranking, no color coding */}
      {candidate.criminalRecords && candidate.criminalRecords.length > 0 && (
        <div className="container" style={{ marginTop: '-1rem', marginBottom: '2rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Criminal Record</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {candidate.criminalRecords.map(record => (
                <div key={record.id} style={{ padding: '1rem', border: '1px solid var(--slate-200)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--navy-800)' }}>{record.offense}</div>
                    <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.5rem', background: 'var(--slate-100)', borderRadius: '4px', color: 'var(--slate-600)' }}>
                      {record.source === 'self_reported' ? 'Self-Reported' : 'Public Record'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: record.candidate_statement ? '0.75rem' : 0 }}>
                    <span>Disposition: {(record.disposition || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                    {record.year && <span>Year: {record.year}</span>}
                    {record.jurisdiction && <span>{record.jurisdiction_level ? record.jurisdiction_level.charAt(0).toUpperCase() + record.jurisdiction_level.slice(1) + ': ' : ''}{record.jurisdiction}</span>}
                    {record.sentence && <span>Sentence: {record.sentence}</span>}
                  </div>
                  {record.candidate_statement && (
                    <div style={{ background: 'var(--slate-50)', padding: '0.75rem', borderRadius: '6px', borderLeft: '3px solid var(--slate-300)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Candidate Statement
                      </div>
                      <p style={{ color: 'var(--slate-700)', margin: 0, fontSize: '0.9375rem' }}>{record.candidate_statement}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="container" style={{ marginTop: candidate.criminalRecords?.length > 0 ? '0' : '-1rem' }}>
        {(() => {
          const tabList = [
            'positions',
            'promises',
            'background',
            'finance',
            'accountability',
            'record',
            'bills',
            'qa',
            'events',
            'endorsements',
          ]
          const tabLabels = { qa: 'Q&A', record: 'Voting Record', bills: 'Bills & Sponsorships', background: 'Background', finance: 'Follow the Money', accountability: 'Accountability', promises: 'Promises' }
          const handleTabKeyDown = (e, tab) => {
            const idx = tabList.indexOf(tab)
            let newIdx
            if (e.key === 'ArrowRight') { e.preventDefault(); newIdx = (idx + 1) % tabList.length }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); newIdx = (idx - 1 + tabList.length) % tabList.length }
            else if (e.key === 'Home') { e.preventDefault(); newIdx = 0 }
            else if (e.key === 'End') { e.preventDefault(); newIdx = tabList.length - 1 }
            else return
            setActiveTab(tabList[newIdx])
            const btn = document.getElementById(`candidate-tab-${tabList[newIdx]}`)
            if (btn) btn.focus()
          }
          return (
            <div role="tablist" aria-label="Candidate information" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--slate-200)', marginBottom: '2rem', overflowX: 'auto' }}>
              {tabList.map(tab => (
                <button
                  key={tab}
                  id={`candidate-tab-${tab}`}
                  role="tab"
                  aria-selected={activeTab === tab}
                  aria-controls={`candidate-tabpanel-${tab}`}
                  tabIndex={activeTab === tab ? 0 : -1}
                  onClick={() => setActiveTab(tab)}
                  onKeyDown={(e) => handleTabKeyDown(e, tab)}
                  style={{ padding: '1rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--burgundy-500)' : '2px solid transparent', color: activeTab === tab ? 'var(--navy-800)' : 'var(--slate-600)', fontWeight: activeTab === tab ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {tabLabels[tab] || tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          )
        })()}

        <div className="candidate-main-layout" style={{ display: 'flex', gap: '2rem', marginBottom: '3rem', flexWrap: 'wrap' }}>
          {/* Main Content */}
          <div className="candidate-main-content" role="tabpanel" id={`candidate-tabpanel-${activeTab}`} aria-labelledby={`candidate-tab-${activeTab}`} aria-live="polite" style={{ flex: 1, minWidth: 0 }}>
            {activeTab === 'positions' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Issue Positions</h2>
                {(candidate.positions || []).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {candidate.positions.map((pos, idx) => (
                      <div key={idx} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <button
                          onClick={() => setExpandedPosition(expandedPosition === idx ? null : idx)}
                          style={{ width: '100%', padding: '1.25rem', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: 8, height: 40, borderRadius: 4, background: getStanceColor(pos.stance) }} />
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--navy-800)', marginBottom: '0.25rem' }}>{pos.category_name || pos.issue_name || pos.category}</div>
                              <div style={{ fontSize: '0.9375rem', color: 'var(--slate-600)' }}>
                                <span style={{ color: getStanceColor(pos.stance), fontWeight: 500 }}>{getStanceLabel(pos.stance)}:</span> {pos.explanation || pos.summary}
                              </div>
                            </div>
                          </div>
                          {expandedPosition === idx ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                        {expandedPosition === idx && pos.explanation && (
                          <div style={{ padding: '1.25rem', paddingTop: 0, borderTop: '1px solid var(--slate-200)', marginTop: '-0.5rem', paddingLeft: '3.5rem' }}>
                            <p style={{ color: 'var(--slate-700)', lineHeight: 1.7 }}>{pos.explanation}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state"><p>This candidate hasn't declared issue positions yet.</p></div>
                )}
              </div>
            )}

            {activeTab === 'promises' && (
              <PromisesTab candidateId={id} />
            )}

            {activeTab === 'background' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Background & Qualifications</h2>

                {background.education.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', color: 'var(--navy-800)' }}>Education</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {background.education.map((edu, idx) => (
                        <div key={idx} className="card" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                          <div style={{ width: 40, height: 40, borderRadius: '8px', background: 'var(--navy-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Award size={20} style={{ color: 'var(--navy-600)' }} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--navy-800)' }}>{edu.degree || 'Degree'}</div>
                            <div style={{ color: 'var(--slate-600)', fontSize: '0.9375rem' }}>{edu.institution || edu.school}</div>
                            {edu.field_of_study && <div style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>{edu.field_of_study}</div>}
                            {edu.year && <div style={{ color: 'var(--slate-500)', fontSize: '0.8125rem' }}>{edu.year}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {background.experience.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', color: 'var(--navy-800)' }}>Professional Experience</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {background.experience.map((exp, idx) => (
                        <div key={idx} className="card" style={{ padding: '1.25rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--navy-800)' }}>{exp.title || exp.position}</div>
                          <div style={{ color: 'var(--slate-600)', fontSize: '0.9375rem' }}>{exp.organization}</div>
                          {(exp.start_year || exp.end_year) && (
                            <div style={{ color: 'var(--slate-500)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                              {exp.start_year}{exp.end_year ? ` - ${exp.end_year}` : ' - Present'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {background.committees.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', color: 'var(--navy-800)' }}>Committee Memberships</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {background.committees.map((cm, idx) => (
                        <div key={idx} className="card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--navy-800)' }}>{cm.committee_name}</div>
                            {cm.role && <div style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>{cm.role}</div>}
                          </div>
                          {cm.chamber && (
                            <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.5rem', background: 'var(--slate-100)', borderRadius: '4px', color: 'var(--slate-600)' }}>
                              {cm.chamber}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {background.education.length === 0 && background.experience.length === 0 && background.committees.length === 0 && (
                  <div className="empty-state"><p>No background information available yet. Education, work history, and committee assignments will appear here as data becomes available.</p></div>
                )}
              </div>
            )}

            {activeTab === 'finance' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Follow the Money</h2>
                <DarkMoneyCallout candidateId={id} />
                {finance.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {finance.map((f, idx) => (
                      <div key={idx} className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.125rem', marginBottom: '1.25rem', color: 'var(--navy-800)' }}>
                          {f.election_cycle} Election Cycle
                        </h3>

                        {/* Big numbers */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                          <div className="stat" style={{ textAlign: 'center', padding: '1rem', background: 'var(--slate-50)', borderRadius: 8 }}>
                            <div className="stat-value" style={{ color: 'var(--success)', fontSize: '1.5rem' }}>{formatCurrency(f.total_raised)}</div>
                            <div className="stat-label">Total Raised</div>
                          </div>
                          <div className="stat" style={{ textAlign: 'center', padding: '1rem', background: 'var(--slate-50)', borderRadius: 8 }}>
                            <div className="stat-value" style={{ color: 'var(--error)', fontSize: '1.5rem' }}>{formatCurrency(f.total_spent)}</div>
                            <div className="stat-label">Total Spent</div>
                          </div>
                          <div className="stat" style={{ textAlign: 'center', padding: '1rem', background: 'var(--slate-50)', borderRadius: 8 }}>
                            <div className="stat-value" style={{ fontSize: '1.5rem' }}>{formatCurrency(f.cash_on_hand)}</div>
                            <div className="stat-label">Cash on Hand</div>
                          </div>
                          {f.debt != null && Number(f.debt) > 0 && (
                            <div className="stat" style={{ textAlign: 'center', padding: '1rem', background: 'var(--slate-50)', borderRadius: 8 }}>
                              <div className="stat-value" style={{ color: 'var(--warning)', fontSize: '1.5rem' }}>{formatCurrency(f.debt)}</div>
                              <div className="stat-label">Debt</div>
                            </div>
                          )}
                        </div>

                        {/* Funding sources */}
                        {(f.individual_contributions != null || f.pac_contributions != null) && (
                          <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.9375rem', color: 'var(--navy-800)', marginBottom: '0.75rem' }}>Where the Money Comes From</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {[
                                { label: 'Individual Contributions', value: f.individual_contributions },
                                { label: 'PAC Contributions', value: f.pac_contributions },
                                { label: 'Party Contributions', value: f.party_contributions },
                                { label: 'Self-Financing', value: f.self_financing },
                              ].filter(s => s.value != null && Number(s.value) > 0).map((s, i) => {
                                const total = Number(f.total_raised) || 1
                                const pct = Math.round((Number(s.value) / total) * 100)
                                return (
                                  <div key={i}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                      <span style={{ color: 'var(--slate-600)' }}>{s.label}</span>
                                      <span style={{ fontWeight: 600, color: 'var(--navy-800)' }}>{formatCurrency(s.value)} ({pct}%)</span>
                                    </div>
                                    <div style={{ height: 6, background: 'var(--slate-200)', borderRadius: 3, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', background: 'var(--navy-600)', borderRadius: 3, width: `${pct}%`, transition: 'width 0.3s' }} />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Small vs large donors */}
                        {f.small_donor_percent != null && (
                          <div>
                            <h4 style={{ fontSize: '0.9375rem', color: 'var(--navy-800)', marginBottom: '0.75rem' }}>Donor Size Breakdown</h4>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                              <div style={{ flex: 1, height: 24, background: 'var(--slate-200)', borderRadius: 12, overflow: 'hidden', display: 'flex' }}>
                                <div style={{ width: `${Number(f.small_donor_percent)}%`, background: 'var(--success)', transition: 'width 0.3s' }} />
                                <div style={{ flex: 1, background: 'var(--navy-600)' }} />
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.8125rem' }}>
                              <span style={{ color: 'var(--success)' }}>Small donors (&le;$200): {Number(f.small_donor_percent).toFixed(0)}%</span>
                              <span style={{ color: 'var(--navy-600)' }}>Large donors: {(100 - Number(f.small_donor_percent)).toFixed(0)}%</span>
                            </div>
                          </div>
                        )}

                        {f.last_filed_date && (
                          <div style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                            Last filed: {formatDate(f.last_filed_date)} &middot; Source: FEC
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <DollarSign size={32} style={{ color: 'var(--slate-400)', marginBottom: '0.75rem' }} />
                    <p>No campaign finance data available yet.</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>
                      FEC filings for federal candidates are updated regularly. State-level candidates may not have FEC data.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'qa' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <h2 style={{ margin: 0 }}>Questions & Answers</h2>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <select
                      value={qaFilter}
                      onChange={(e) => {
                        setQaFilter(e.target.value)
                        api.get(`/questions/candidate/${id}?sort=${qaSort}&status=${e.target.value}`)
                          .then(data => setQuestions(data.questions || []))
                          .catch(() => {})
                      }}
                      style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid var(--slate-300)' }}
                    >
                      <option value="all">All Questions</option>
                      <option value="answered">Answered</option>
                      <option value="pending">Unanswered</option>
                    </select>
                    <select
                      value={qaSort}
                      onChange={(e) => {
                        setQaSort(e.target.value)
                        api.get(`/questions/candidate/${id}?sort=${e.target.value}&status=${qaFilter}`)
                          .then(data => setQuestions(data.questions || []))
                          .catch(() => {})
                      }}
                      style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid var(--slate-300)' }}
                    >
                      <option value="upvotes">Most Upvoted</option>
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                    </select>
                  </div>
                </div>

                {user && (
                  <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                    <textarea
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                      placeholder="Ask this candidate a question..."
                      rows={3}
                      style={{ marginBottom: '0.75rem', resize: 'vertical' }}
                    />
                    <button className="btn btn-primary" onClick={handleAskQuestion} disabled={askingQuestion || !newQuestion.trim()}>
                      {askingQuestion ? 'Submitting...' : 'Ask Question'}
                    </button>
                  </div>
                )}

                {!user && (
                  <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                    <p style={{ color: 'var(--slate-600)', marginBottom: '0.75rem' }}>Sign in to ask questions</p>
                    <Link to="/login" className="btn btn-primary">Sign In</Link>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {questions.map(q => (
                    <div key={q.id} className="card" style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 50 }}>
                          <button onClick={() => handleUpvote(q.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-500)', padding: '0.5rem' }}>
                            <ThumbsUp size={20} />
                          </button>
                          <span style={{ fontWeight: 600, color: 'var(--navy-700)' }}>{q.upvote_count || 0}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 500, color: 'var(--navy-800)', marginBottom: '0.5rem', fontSize: '1.0625rem' }}>{q.question_text}</p>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                            {q.asked_by_username && <>Asked by {q.asked_by_username} &bull; </>}
                            {q.created_at && formatDate(q.created_at)}
                          </div>
                          {q.answer_text ? (
                            <div style={{ background: 'var(--slate-50)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--navy-600)' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Candidate Response
                              </div>
                              <p style={{ color: 'var(--slate-700)', margin: 0 }}>{q.answer_text}</p>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning)', fontSize: '0.875rem' }}>
                              <AlertCircle size={16} /> Awaiting response
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {questions.length === 0 && (
                    <div className="empty-state"><p>No questions yet. Be the first to ask!</p></div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'events' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Upcoming Events</h2>
                {events.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {events.map(event => (
                      <div key={event.id} className="card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--burgundy-500)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                          <div>
                            <span className="badge badge-candidate" style={{ marginBottom: '0.5rem' }}>
                              {event.format === 'video' ? 'Video Town Hall' : 'Text-Based AMA'}
                            </span>
                            <h4 style={{ marginBottom: '0.5rem' }}>{event.title}</h4>
                            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9375rem', color: 'var(--slate-600)', flexWrap: 'wrap' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <Calendar size={16} /> {formatDate(event.scheduled_at)}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <Clock size={16} /> {new Date(event.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                          <button className="btn btn-primary" onClick={() => handleRsvp(event.id)}>RSVP</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state"><p>No upcoming events scheduled.</p></div>
                )}
              </div>
            )}

            {activeTab === 'endorsements' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Endorsements</h2>
                <p style={{ color: 'var(--slate-600)', marginBottom: '1.5rem' }}>
                  Peer-to-peer endorsements from other verified candidates.
                </p>
                {(candidate.endorsements || []).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {candidate.endorsements.map((endorsement, idx) => (
                      <div key={idx} className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--slate-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: 'var(--slate-600)' }}>
                          {(endorsement.display_name || endorsement.name || 'E').split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--navy-800)' }}>{endorsement.display_name || endorsement.name}</div>
                          {endorsement.official_title && <div style={{ fontSize: '0.875rem', color: 'var(--slate-600)' }}>{endorsement.official_title}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state"><p>No endorsements yet.</p></div>
                )}
              </div>
            )}

            {activeTab === 'record' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Voting Record</h2>

                {/* Voting Stats */}
                {votingRecord.stats && (votingRecord.stats.total_votes > 0 || votingRecord.votes.length > 0) && (
                  <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h4 style={{ marginBottom: '1rem', color: 'var(--navy-800)' }}>Voting Statistics</h4>
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                      <div className="stat">
                        <div className="stat-value">{votingRecord.stats.total_votes || 0}</div>
                        <div className="stat-label">Total Votes</div>
                      </div>
                      <div className="stat">
                        <div className="stat-value">{votingRecord.stats.yes_votes || 0}</div>
                        <div className="stat-label">Yes Votes</div>
                      </div>
                      <div className="stat">
                        <div className="stat-value">{votingRecord.stats.no_votes || 0}</div>
                        <div className="stat-label">No Votes</div>
                      </div>
                      <div className="stat">
                        <div className="stat-value">{votingRecord.stats.missed_votes || 0}</div>
                        <div className="stat-label">Missed Votes</div>
                      </div>
                      <div className="stat">
                        <div className="stat-value">
                          {votingRecord.stats.attendance_rate != null
                            ? `${Number(votingRecord.stats.attendance_rate).toFixed(1)}%`
                            : 'N/A'}
                        </div>
                        <div className="stat-label">Attendance Rate</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Votes */}
                {votingRecord.votes.length > 0 ? (
                  <>
                    {/* Desktop table layout */}
                    <div className="table-responsive desktop-table-layout">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: '500px' }}>
                        <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                          <div style={{ width: 100, flexShrink: 0 }}>Date</div>
                          <div style={{ flex: 1 }}>Bill</div>
                          <div style={{ width: 100, flexShrink: 0 }}>Vote</div>
                          <div style={{ width: 120, flexShrink: 0 }}>Status</div>
                        </div>
                        {votingRecord.votes.map((vote, idx) => (
                          <div key={idx} className="card" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ width: 100, flexShrink: 0, fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                              {vote.vote_date ? formatDate(vote.vote_date) : 'N/A'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500, color: 'var(--navy-800)', fontSize: '0.9375rem' }}>
                                {vote.bill_number || vote.bill_title || 'Unknown Bill'}
                              </div>
                              {vote.bill_title && vote.bill_number && (
                                <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.125rem' }}>{vote.bill_title}</div>
                              )}
                            </div>
                            <div style={{ width: 100, flexShrink: 0, fontSize: '0.875rem', color: 'var(--slate-700)' }}>
                              {(vote.vote || vote.position || 'N/A').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </div>
                            <div style={{ width: 120, flexShrink: 0, fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                              {(vote.bill_status || vote.result || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'N/A'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Mobile card layout */}
                    <div className="mobile-record-cards">
                      {votingRecord.votes.map((vote, idx) => (
                        <div key={idx} className="card mobile-record-card">
                          <div className="mobile-record-row">
                            <span className="mobile-record-label">Bill</span>
                            <span className="mobile-record-value primary">{vote.bill_number || vote.bill_title || 'Unknown Bill'}</span>
                          </div>
                          {vote.bill_title && vote.bill_number && (
                            <div className="mobile-record-row">
                              <span className="mobile-record-label">Title</span>
                              <span className="mobile-record-value">{vote.bill_title}</span>
                            </div>
                          )}
                          <div className="mobile-record-row">
                            <span className="mobile-record-label">Date</span>
                            <span className="mobile-record-value">{vote.vote_date ? formatDate(vote.vote_date) : 'N/A'}</span>
                          </div>
                          <div className="mobile-record-row">
                            <span className="mobile-record-label">Vote</span>
                            <span className="mobile-record-value">{(vote.vote || vote.position || 'N/A').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                          </div>
                          <div className="mobile-record-row">
                            <span className="mobile-record-label">Status</span>
                            <span className="mobile-record-value">{(vote.bill_status || vote.result || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'N/A'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <FileText size={32} style={{ color: 'var(--slate-400)', marginBottom: '0.75rem' }} />
                    <p>No voting record data available yet.</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>
                      Roll call votes will appear here as legislative data is synced from official sources.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'accountability' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Accountability</h2>
                <RubberStampBadge politicianId={id} />
                {!accountabilityScore ? (
                  <div className="empty-state">
                    <AlertCircle size={32} style={{ color: 'var(--slate-400)', marginBottom: '0.75rem' }} />
                    <p>Accountability data is being compiled for this politician. Check back soon.</p>
                  </div>
                ) : (
                  <>
                    {/* Score Gauges */}
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                      {/* Consistency Score Gauge */}
                      <div className="card" style={{ padding: '1.5rem', flex: '1 1 280px', textAlign: 'center' }}>
                        <h4 style={{ marginBottom: '1rem', color: 'var(--navy-800)' }}>Consistency Score</h4>
                        {(() => {
                          const score = accountabilityScore.consistency_score || 0
                          const color = score >= 70 ? '#38a169' : score >= 40 ? '#d69e2e' : '#e53e3e'
                          const angle = (score / 100) * 180
                          const rad = (angle * Math.PI) / 180
                          const x = 100 - 80 * Math.cos(rad)
                          const y = 100 - 80 * Math.sin(rad)
                          const largeArc = angle > 180 ? 1 : 0
                          return (
                            <svg viewBox="0 0 200 120" width="200" height="120">
                              <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--slate-200)" strokeWidth="12" strokeLinecap="round" />
                              {score > 0 && (
                                <path d={`M 20 100 A 80 80 0 ${largeArc} 1 ${x} ${y}`} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
                              )}
                              <text x="100" y="90" textAnchor="middle" fontSize="32" fontWeight="700" fill={color}>{score}</text>
                              <text x="100" y="112" textAnchor="middle" fontSize="11" fill="var(--slate-500)">out of 100</text>
                            </svg>
                          )
                        })()}
                      </div>

                      {/* Donor Influence Score Gauge */}
                      <div className="card" style={{ padding: '1.5rem', flex: '1 1 200px', textAlign: 'center' }}>
                        <h4 style={{ marginBottom: '1rem', color: 'var(--navy-800)' }}>Donor Influence</h4>
                        {(() => {
                          const score = accountabilityScore.donor_influence_score || 0
                          const color = score >= 70 ? '#e53e3e' : score >= 40 ? '#d69e2e' : '#38a169'
                          const angle = (score / 100) * 180
                          const rad = (angle * Math.PI) / 180
                          const x = 100 - 80 * Math.cos(rad)
                          const y = 100 - 80 * Math.sin(rad)
                          const largeArc = angle > 180 ? 1 : 0
                          return (
                            <svg viewBox="0 0 200 120" width="160" height="96">
                              <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--slate-200)" strokeWidth="12" strokeLinecap="round" />
                              {score > 0 && (
                                <path d={`M 20 100 A 80 80 0 ${largeArc} 1 ${x} ${y}`} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
                              )}
                              <text x="100" y="90" textAnchor="middle" fontSize="32" fontWeight="700" fill={color}>{score}</text>
                              <text x="100" y="112" textAnchor="middle" fontSize="11" fill="var(--slate-500)">out of 100</text>
                            </svg>
                          )
                        })()}
                        <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.5rem' }}>Higher = more donor-aligned voting</p>
                      </div>
                    </div>

                    {/* Gap Cards */}
                    {accountabilityGaps.length > 0 && (
                      <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--navy-800)' }}>Accountability Gaps</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {accountabilityGaps.map((gap, idx) => {
                            const typeLabel = gap.gap_type === 'donor_vote' ? 'Donor \u2194 Vote'
                              : gap.gap_type === 'statement_vote' ? 'Said \u2194 Did'
                              : gap.gap_type === 'statement_donor' ? 'Said \u2194 Funded By'
                              : gap.gap_type || 'Gap'
                            const severityColor = (gap.gap_severity || 0) >= 7 ? '#e53e3e' : (gap.gap_severity || 0) >= 4 ? '#d69e2e' : '#38a169'
                            return (
                              <div key={idx} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid var(--slate-200)', background: 'var(--slate-50)' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.125rem 0.5rem', background: 'var(--navy-100)', color: 'var(--navy-700)', borderRadius: '4px' }}>{typeLabel}</span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Severity: {gap.gap_severity || 'N/A'}/10</span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                                  <div style={{ flex: '1 1 200px', padding: '1rem', background: 'rgba(56, 161, 105, 0.06)', borderRight: '1px solid var(--slate-200)' }}>
                                    <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#38a169', fontWeight: 600, marginBottom: '0.375rem' }}>What they said</div>
                                    <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--slate-700)' }}>{gap.stated_position || 'No statement recorded'}</p>
                                  </div>
                                  <div style={{ flex: '1 1 200px', padding: '1rem', background: 'rgba(229, 62, 62, 0.06)' }}>
                                    <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#e53e3e', fontWeight: 600, marginBottom: '0.375rem' }}>What they did</div>
                                    <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--slate-700)' }}>{gap.actual_action || 'No action recorded'}</p>
                                  </div>
                                </div>
                                <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--slate-200)' }}>
                                  <div style={{ height: '4px', borderRadius: '2px', background: 'var(--slate-100)', marginBottom: '0.5rem' }}>
                                    <div style={{ height: '100%', borderRadius: '2px', background: severityColor, width: `${((gap.gap_severity || 0) / 10) * 100}%` }} />
                                  </div>
                                  {gap.ai_analysis && (
                                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--slate-600)', lineHeight: 1.5 }}>{gap.ai_analysis}</p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Donor Force Graph */}
                    <div style={{ marginBottom: '2rem' }}>
                      <h3 style={{ marginBottom: '1rem', color: 'var(--navy-800)' }}>Donor Industries</h3>
                      {donorIndustries.length === 0 ? (
                        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                          <p style={{ color: 'var(--slate-500)' }}>No donor data available</p>
                        </div>
                      ) : (
                        <div className="card" style={{ padding: '1.5rem' }}>
                          {(() => {
                            const maxAmount = Math.max(...donorIndustries.map(d => d.total_amount || 0), 1)
                            const centerX = 250
                            const centerY = 200
                            const radius = 140
                            return (
                              <svg viewBox="0 0 500 400" width="100%" style={{ maxWidth: '600px', margin: '0 auto', display: 'block' }}>
                                {/* Lines */}
                                {donorIndustries.map((donor, i) => {
                                  const angle = (i / donorIndustries.length) * 2 * Math.PI - Math.PI / 2
                                  const x = centerX + radius * Math.cos(angle)
                                  const y = centerY + radius * Math.sin(angle)
                                  return (
                                    <line key={`line-${i}`} x1={centerX} y1={centerY} x2={x} y2={y} stroke="var(--slate-300)" strokeWidth="1.5" />
                                  )
                                })}
                                {/* Donor nodes + labels */}
                                {donorIndustries.map((donor, i) => {
                                  const angle = (i / donorIndustries.length) * 2 * Math.PI - Math.PI / 2
                                  const x = centerX + radius * Math.cos(angle)
                                  const y = centerY + radius * Math.sin(angle)
                                  const nodeSize = 12 + ((donor.total_amount || 0) / maxAmount) * 24
                                  const amountLabel = (donor.total_amount || 0) >= 1000000
                                    ? `$${((donor.total_amount || 0) / 1000000).toFixed(1)}M`
                                    : (donor.total_amount || 0) >= 1000
                                    ? `$${((donor.total_amount || 0) / 1000).toFixed(0)}K`
                                    : `$${donor.total_amount || 0}`
                                  const midX = (centerX + x) / 2
                                  const midY = (centerY + y) / 2
                                  return (
                                    <g key={`node-${i}`}>
                                      <circle cx={x} cy={y} r={nodeSize} fill="var(--burgundy-500)" opacity="0.8" />
                                      <text x={x} y={y + nodeSize + 14} textAnchor="middle" fontSize="10" fill="var(--slate-600)">{donor.industry || donor.name || 'Unknown'}</text>
                                      <text x={midX} y={midY - 6} textAnchor="middle" fontSize="9" fill="var(--slate-500)">{amountLabel}</text>
                                    </g>
                                  )
                                })}
                                {/* Center node */}
                                <circle cx={centerX} cy={centerY} r="28" fill="var(--navy-800)" />
                                <text x={centerX} y={centerY + 4} textAnchor="middle" fontSize="10" fill="white" fontWeight="600">{name.split(' ').pop()}</text>
                              </svg>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'bills' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Bills & Sponsorships</h2>

                {/* Sponsorship Counts */}
                {sponsorships.counts && sponsorships.counts.length > 0 && (
                  <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h4 style={{ marginBottom: '1rem', color: 'var(--navy-800)' }}>Sponsorship Summary</h4>
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                      {sponsorships.counts.map((count, idx) => (
                        <div key={idx} className="stat">
                          <div className="stat-value">{count.count || 0}</div>
                          <div className="stat-label">
                            {(count.sponsorship_type || count.type || 'Sponsor').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sponsorship List */}
                {sponsorships.sponsorships.length > 0 ? (
                  <>
                    {/* Desktop table layout */}
                    <div className="table-responsive desktop-table-layout">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: '600px' }}>
                        <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                          <div style={{ width: 120, flexShrink: 0 }}>Bill Number</div>
                          <div style={{ flex: 1 }}>Title</div>
                          <div style={{ width: 110, flexShrink: 0 }}>Type</div>
                          <div style={{ width: 100, flexShrink: 0 }}>Status</div>
                          <div style={{ width: 100, flexShrink: 0 }}>Introduced</div>
                        </div>
                        {sponsorships.sponsorships.map((sp, idx) => (
                          <div key={idx} className="card" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ width: 120, flexShrink: 0, fontWeight: 600, color: 'var(--navy-800)', fontSize: '0.9375rem' }}>
                              {sp.bill_number || 'N/A'}
                            </div>
                            <div style={{ flex: 1, fontSize: '0.9375rem', color: 'var(--slate-700)' }}>
                              {sp.bill_title || sp.title || 'Untitled'}
                            </div>
                            <div style={{ width: 110, flexShrink: 0, fontSize: '0.8125rem', color: 'var(--slate-600)' }}>
                              {(sp.sponsorship_type || sp.type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'N/A'}
                            </div>
                            <div style={{ width: 100, flexShrink: 0, fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                              {(sp.bill_status || sp.status || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'N/A'}
                            </div>
                            <div style={{ width: 100, flexShrink: 0, fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                              {sp.introduced_date ? formatDate(sp.introduced_date) : 'N/A'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Mobile card layout */}
                    <div className="mobile-record-cards">
                      {sponsorships.sponsorships.map((sp, idx) => (
                        <div key={idx} className="card mobile-record-card">
                          <div className="mobile-record-row">
                            <span className="mobile-record-label">Bill</span>
                            <span className="mobile-record-value primary">{sp.bill_number || 'N/A'}</span>
                          </div>
                          <div className="mobile-record-row">
                            <span className="mobile-record-label">Title</span>
                            <span className="mobile-record-value">{sp.bill_title || sp.title || 'Untitled'}</span>
                          </div>
                          <div className="mobile-record-row">
                            <span className="mobile-record-label">Type</span>
                            <span className="mobile-record-value">{(sp.sponsorship_type || sp.type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'N/A'}</span>
                          </div>
                          <div className="mobile-record-row">
                            <span className="mobile-record-label">Status</span>
                            <span className="mobile-record-value">{(sp.bill_status || sp.status || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'N/A'}</span>
                          </div>
                          <div className="mobile-record-row">
                            <span className="mobile-record-label">Introduced</span>
                            <span className="mobile-record-value">{sp.introduced_date ? formatDate(sp.introduced_date) : 'N/A'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <FileText size={32} style={{ color: 'var(--slate-400)', marginBottom: '0.75rem' }} />
                    <p>No bill sponsorship data available yet.</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>
                      Bills this candidate has sponsored or co-sponsored will appear here.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="candidate-sidebar" style={{ width: 300, flexShrink: 0 }}>
            <button
              className="btn btn-secondary sidebar-toggle-mobile"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <EyeOff size={18} /> : <Eye size={18} />}
              {sidebarOpen ? 'Hide Details' : 'View Details'}
            </button>
            <div style={sidebarOpen ? {} : {}} className={`sidebar-content ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
            {/* What This Office Does — short neutral explainer */}
            {(() => {
              const explainer = officeExplainer(candidate)
              if (!explainer) return null
              return (
                <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', background: 'var(--slate-50)', borderLeft: '3px solid var(--navy-600)' }}>
                  <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9375rem' }}>About this office</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--slate-700)', lineHeight: 1.55, margin: 0 }}>{explainer}</p>
                </div>
              )
            })()}

            {/* Contact This Official — consolidated */}
            {(candidate.campaign_website || candidate.campaign_phone || candidate.campaign_email || candidate.office_phone || candidate.office_address) && (
              <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.75rem' }}>Contact</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                  {candidate.campaign_website && (
                    <a href={candidate.campaign_website.startsWith('http') ? candidate.campaign_website : `https://${candidate.campaign_website}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--navy-700)', textDecoration: 'none' }}>
                      <ExternalLink size={15} /> Campaign website
                    </a>
                  )}
                  {candidate.campaign_phone && (
                    <a href={`tel:${candidate.campaign_phone}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--slate-700)', textDecoration: 'none' }}>
                      <span style={{ fontWeight: 600, color: 'var(--slate-500)', minWidth: 15 }}>☎</span>
                      {candidate.campaign_phone}
                    </a>
                  )}
                  {candidate.campaign_email && (
                    <a href={`mailto:${candidate.campaign_email}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--slate-700)', textDecoration: 'none' }}>
                      <span style={{ fontWeight: 600, color: 'var(--slate-500)', minWidth: 15 }}>✉</span>
                      {candidate.campaign_email}
                    </a>
                  )}
                  {candidate.office_phone && candidate.office_phone !== candidate.campaign_phone && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: 'var(--slate-600)', fontSize: '0.8125rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--slate-500)', minWidth: 15 }}>▲</span>
                      <span>Official office: {candidate.office_phone}</span>
                    </div>
                  )}
                  {candidate.office_address && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: 'var(--slate-600)', fontSize: '0.8125rem' }}>
                      <MapPin size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{candidate.office_address}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>Quick Actions</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setActiveTab('qa')}>
                  <MessageCircle size={18} /> Ask a Question
                </button>
                <Link to={candidate?.race_id ? `/compare?race=${candidate.race_id}` : '/compare'} className="btn btn-secondary" style={{ width: '100%' }}>
                  <FileText size={18} /> Compare Candidates
                </Link>
                <Link to="/voting-guide" className="btn btn-secondary" style={{ width: '100%' }}>
                  <CheckCircle size={18} /> Add to Voting Guide
                </Link>
              </div>
            </div>

            {/* Social Media Links */}
            {(candidate.twitter_handle || candidate.facebook_handle || candidate.instagram_handle || candidate.youtube_handle || candidate.linkedin_url || candidate.campaign_website) && (
              <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>Social Media & Links</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {candidate.campaign_website && (
                    <a href={candidate.campaign_website.startsWith('http') ? candidate.campaign_website : `https://${candidate.campaign_website}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--navy-700)', fontSize: '0.875rem', textDecoration: 'none' }}>
                      <ExternalLink size={16} /> Campaign Website
                    </a>
                  )}
                  {candidate.twitter_handle && (
                    <a href={`https://x.com/${candidate.twitter_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--navy-700)', fontSize: '0.875rem', textDecoration: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      @{candidate.twitter_handle.replace('@', '')}
                    </a>
                  )}
                  {candidate.facebook_handle && (
                    <a href={`https://facebook.com/${candidate.facebook_handle}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--navy-700)', fontSize: '0.875rem', textDecoration: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      Facebook
                    </a>
                  )}
                  {candidate.instagram_handle && (
                    <a href={`https://instagram.com/${candidate.instagram_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--navy-700)', fontSize: '0.875rem', textDecoration: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                      @{candidate.instagram_handle.replace('@', '')}
                    </a>
                  )}
                  {candidate.youtube_handle && (
                    <a href={`https://youtube.com/${candidate.youtube_handle.startsWith('@') ? candidate.youtube_handle : '@' + candidate.youtube_handle}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--navy-700)', fontSize: '0.875rem', textDecoration: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                      YouTube
                    </a>
                  )}
                  {candidate.linkedin_url && (
                    <a href={candidate.linkedin_url.startsWith('http') ? candidate.linkedin_url : `https://${candidate.linkedin_url}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--navy-700)', fontSize: '0.875rem', textDecoration: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Embedded Twitter Timeline */}
            {candidate.twitter_handle && (
              <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>Latest Posts</h4>
                <div style={{ maxHeight: 400, overflow: 'hidden', borderRadius: '8px' }}>
                  <a
                    className="twitter-timeline"
                    data-height="400"
                    data-theme="light"
                    data-chrome="noheader nofooter noborders"
                    href={`https://twitter.com/${candidate.twitter_handle.replace('@', '')}`}
                  >
                    Loading tweets...
                  </a>
                </div>
              </div>
            )}

            {events.length > 0 && (
              <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>Next Event</h4>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{events[0].title}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '1rem' }}>
                    {formatDateTime(events[0].scheduled_at)}
                  </div>
                  <button className="btn btn-accent" style={{ width: '100%' }} onClick={() => handleRsvp(events[0].id)}>
                    <PlayCircle size={18} /> RSVP Now
                  </button>
                </div>
              </div>
            )}

            {transparency && (
              <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>Transparency Profile</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {transparency.votingRecord?.attendance_rate != null && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Attendance Rate</div>
                      <div style={{ fontWeight: 600, fontSize: '1.25rem', color: 'var(--navy-800)' }}>
                        {Number(transparency.votingRecord.attendance_rate).toFixed(1)}%
                      </div>
                    </div>
                  )}
                  {transparency.votingRecord?.total_votes != null && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Total Votes Cast</div>
                      <div style={{ fontWeight: 600, fontSize: '1.25rem', color: 'var(--navy-800)' }}>
                        {transparency.votingRecord.total_votes}
                      </div>
                    </div>
                  )}
                  {transparency.sponsorships?.total_sponsorships != null && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Total Bills Sponsored</div>
                      <div style={{ fontWeight: 600, fontSize: '1.25rem', color: 'var(--navy-800)' }}>
                        {transparency.sponsorships.total_sponsorships}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {finance.length > 0 && (
              <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <DollarSign size={18} /> Campaign Finance
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {finance.map((f, idx) => (
                    <div key={idx} style={{ paddingBottom: idx < finance.length - 1 ? '1rem' : 0, borderBottom: idx < finance.length - 1 ? '1px solid var(--slate-200)' : 'none' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        {f.election_cycle} Cycle
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                          <span style={{ color: 'var(--slate-600)' }}>Total Raised</span>
                          <span style={{ fontWeight: 600, color: 'var(--navy-800)' }}>{formatCurrency(f.total_raised)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                          <span style={{ color: 'var(--slate-600)' }}>Total Spent</span>
                          <span style={{ fontWeight: 600, color: 'var(--navy-800)' }}>{formatCurrency(f.total_spent)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                          <span style={{ color: 'var(--slate-600)' }}>Cash on Hand</span>
                          <span style={{ fontWeight: 600, color: 'var(--navy-800)' }}>{formatCurrency(f.cash_on_hand)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ratings.length > 0 && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <Star size={18} /> Interest Group Ratings
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {ratings.map((r, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: idx < ratings.length - 1 ? '0.75rem' : 0, borderBottom: idx < ratings.length - 1 ? '1px solid var(--slate-100)' : 'none' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--navy-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.group_name || r.sig_name || 'Unknown Group'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                          {r.rating_year || ''}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--navy-800)', flexShrink: 0, marginLeft: '0.75rem' }}>
                        {r.rating_score != null ? `${r.rating_score}%` : r.rating}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Candidates in the Same Race */}
        {relatedCandidates.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Candidates in the Same Race</h2>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {relatedCandidates.map(rc => {
                const rcName = rc.display_name || `${rc.first_name || ''} ${rc.last_name || ''}`.trim() || 'Candidate'
                const rcInitials = rcName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <Link
                    key={rc.id}
                    to={`/candidate/${rc.id}`}
                    className="card"
                    style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit', minWidth: 200, maxWidth: 280 }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--navy-100, #e0e7ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: 'var(--navy-700)', flexShrink: 0, fontSize: '0.875rem', overflow: 'hidden' }}>
                      {rc.profile_pic_url
                        ? <img src={rc.profile_pic_url} alt={rcName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : rcInitials
                      }
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--navy-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rcName}</div>
                      {rc.party_affiliation && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rc.party_affiliation}</div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Community Notes */}
        {candidate && candidate.id && (
          <div style={{ marginBottom: '3rem' }}>
            <CommunityNotes contentType="candidate" contentId={candidate.id} />
          </div>
        )}
      </div>
    </div>
  )
}

export default CandidatePage
