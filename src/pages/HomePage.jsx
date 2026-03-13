import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search, MapPin, ChevronRight, Building2,
  Calendar, CheckCircle,
  ArrowRight, PlayCircle, Globe, MessageCircle, FileText
} from 'lucide-react'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import OnboardingModal from '../components/OnboardingModal'

function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(targetDate))
  function getTimeLeft(date) {
    const diff = new Date(date) - new Date()
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0 }
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
    }
  }
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 60000)
    return () => clearInterval(timer)
  }, [targetDate])
  return timeLeft
}

const homeOnboardingSteps = [
  { title: 'Welcome to WhosRunningUSA', description: 'Your one-stop platform for civic engagement. Find candidates, ask questions, and make informed voting decisions.', icon: <Globe size={28} /> },
  { title: 'Find Candidates in Your Area', description: 'Search by name, office, or location to discover who is running in your local, state, and federal races.', icon: <Search size={28} /> },
  { title: 'Ask Questions Directly', description: 'Submit questions to candidates and see their responses. Upvote the questions that matter most to you.', icon: <MessageCircle size={28} /> },
  { title: 'Build Your Voting Guide', description: 'Pick your preferred candidates for each race and create a personalized ballot to take with you to the polls.', icon: <FileText size={28} /> },
]

function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState([])
  const [nextElection, setNextElection] = useState(null)
  const [townHalls, setTownHalls] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let failures = 0
    const onFail = () => { failures++; if (failures >= 3) setLoadError(true) }
    api.get('/candidates?limit=3')
      .then(data => setCandidates(data.candidates || []))
      .catch(onFail)
    api.get('/elections')
      .then(data => {
        const upcoming = (data.elections || []).find(e => new Date(e.election_date) > new Date())
        if (upcoming) setNextElection(upcoming)
      })
      .catch(onFail)
    api.get('/town-halls/upcoming?limit=2')
      .then(data => setTownHalls(data.townHalls || []))
      .catch(onFail)
  }, [])

  const countdown = useCountdown(nextElection?.election_date)

  return (
    <div>
      {!user && (
        <OnboardingModal pageKey="home" steps={homeOnboardingSteps} />
      )}

      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content animate-fade-in-up">
            <h1>
              Find candidates who<br />
              <span>earn your vote</span>
            </h1>
            <p className="hero-tagline">
              "Every race. Every candidate. No hiding."
            </p>
            <p>
              See where candidates stand on the issues, ask them questions directly,
              and hold them accountable. Democracy works better when it's transparent.
            </p>
            <div className="hero-actions">
              <Link to="/explore" className="btn btn-primary">
                Find Your Candidates
                <ArrowRight size={18} />
              </Link>
              <Link to="/run" className="btn btn-secondary">
                Run For Office
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Location Bar */}
      <div className="location-bar">
        <div className="container location-inner">
          <div className="location-info">
            <MapPin size={16} />
            <span>Showing results for: <strong>All Locations</strong></span>
          </div>
          <Link to="/explore" className="location-change">Browse by state</Link>
        </div>
      </div>

      {loadError && (
        <div className="container" style={{ paddingTop: '1rem' }}>
          <div style={{ background: '#fef3cd', color: '#856404', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.875rem' }}>
            Some data couldn't be loaded. The server may be starting up — try refreshing in a moment.
          </div>
        </div>
      )}

      {/* Search Section */}
      <section className="search-section">
        <div className="container">
          <div className="search-bar">
            <div className="search-input-wrapper">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search by candidate name, office, or issue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    navigate(`/explore?q=${encodeURIComponent(searchQuery)}`)
                  }
                }}
              />
            </div>
            <Link to={`/explore${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`} className="btn btn-primary">Search</Link>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container">
        {/* Election Countdown — only shown when there's an upcoming election */}
        {nextElection && (
          <section className="section" style={{ paddingBottom: 0 }}>
            <div className="election-countdown animate-fade-in-up animate-delay-1">
              <div className="countdown-label">Next Election</div>
              <h3 className="countdown-title">{nextElection.name}</h3>
              <div className="countdown-numbers">
                <div className="countdown-item">
                  <span className="countdown-value">{countdown.days}</span>
                  <span className="countdown-unit">Days</span>
                </div>
                <div className="countdown-item">
                  <span className="countdown-value">{countdown.hours}</span>
                  <span className="countdown-unit">Hours</span>
                </div>
                <div className="countdown-item">
                  <span className="countdown-value">{countdown.minutes}</span>
                  <span className="countdown-unit">Minutes</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Featured Candidates */}
        {candidates.length > 0 && (
          <section className="section">
            <div className="section-header">
              <h2 className="section-title">
                <Building2 size={20} />
                Featured Candidates
              </h2>
              <Link to="/explore" className="section-link">
                View all <ChevronRight size={16} />
              </Link>
            </div>
            <div className="candidate-grid animate-fade-in-up animate-delay-2">
              {candidates.map(candidate => (
                <Link to={`/candidate/${candidate.id}`} key={candidate.id} className="card candidate-card">
                  <div className="candidate-card-top">
                    <div className="candidate-avatar">
                      {(candidate.display_name || candidate.first_name || 'C').charAt(0)}
                      {(candidate.last_name || '').charAt(0)}
                    </div>
                    <div className="candidate-info">
                      <h4 className="candidate-name">{candidate.display_name || `${candidate.first_name} ${candidate.last_name}`}</h4>
                      <div className="candidate-race">{candidate.race_name || candidate.official_title || 'Candidate'}</div>
                      <div className="candidate-badges">
                        {candidate.candidate_verified && (
                          <span className="badge badge-verified">
                            <CheckCircle size={12} /> Verified
                          </span>
                        )}
                        {candidate.is_incumbent && (
                          <span className="badge badge-incumbent">Incumbent</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="candidate-stats">
                    <div className="stat">
                      <div className="stat-value">{candidate.qa_response_rate || 0}%</div>
                      <div className="stat-label">Response Rate</div>
                    </div>
                    <div className="stat">
                      <div className="stat-value">{candidate.total_questions_answered || 0}</div>
                      <div className="stat-label">Q&A Answered</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Town Halls */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">
              <PlayCircle size={20} />
              Upcoming Town Halls
            </h2>
            <Link to="/town-halls" className="section-link">
              View all <ChevronRight size={16} />
            </Link>
          </div>
          <div className="feed-grid">
            {townHalls.length > 0 ? townHalls.map(th => (
              <div key={th.id} className="card feed-card" style={{ borderLeft: '3px solid var(--burgundy-500)' }}>
                <div className="feed-card-header">
                  <div className="feed-card-avatar">
                    {(th.candidate_name || 'TH').split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="feed-card-meta">
                    <div className="feed-card-name">{th.candidate_name || 'Candidate'}</div>
                    <div className="feed-card-info">{th.format === 'video' ? 'Virtual Town Hall' : 'Text-Based AMA'}</div>
                  </div>
                </div>
                <div className="feed-card-content">
                  <strong>{th.title}</strong>
                  {th.description && <><br />{th.description}</>}
                </div>
                <div className="feed-card-footer">
                  <span className="feed-card-action">
                    <Calendar size={14} /> {new Date(th.scheduled_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )) : (
              <div className="card feed-card">
                <div className="feed-card-content" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <PlayCircle size={32} style={{ color: 'var(--slate-400)', marginBottom: '0.5rem' }} />
                  <p style={{ color: 'var(--slate-500)', margin: 0 }}>No upcoming town halls yet. Check back soon!</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="section" style={{ textAlign: 'center', padding: '4rem 0' }}>
          <h2 style={{ marginBottom: '1rem' }}>Ready to make your voice heard?</h2>
          <p style={{ color: 'var(--slate-600)', maxWidth: '500px', margin: '0 auto 2rem' }}>
            Join thousands of voters who are demanding transparency and accountability
            from their elected officials.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-primary">
              Create Free Account
              <ArrowRight size={18} />
            </Link>
            <Link to="/run" className="btn btn-accent">
              Run For Office
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

export default HomePage
