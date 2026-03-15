import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search, MapPin, ChevronRight, Building2,
  Calendar, CheckCircle, ArrowRight, PlayCircle, Globe,
  MessageCircle, FileText, Shield, Users, Eye, ThumbsUp,
  Target, DollarSign, Heart, Megaphone, Vote
} from 'lucide-react'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

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

function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [nextElection, setNextElection] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadError, setLoadError] = useState(false)
  const [stats, setStats] = useState({ candidates: 0, questions: 0 })

  useEffect(() => {
    api.get('/elections')
      .then(data => {
        const upcoming = (data.elections || []).find(e => new Date(e.election_date) > new Date())
        if (upcoming) setNextElection(upcoming)
      })
      .catch(() => {})

    api.get('/candidates?limit=1')
      .then(() => {})
      .catch(() => setLoadError(true))
  }, [])

  const countdown = useCountdown(nextElection?.election_date)

  return (
    <div>
      {/* Hero Section */}
      <section className="hero" style={{ paddingBottom: '3rem' }}>
        <div className="container">
          <div className="hero-content animate-fade-in-up" style={{ maxWidth: 700 }}>
            <h1>
              The best candidates don't<br />
              <span>have the most money</span>
            </h1>
            <p className="hero-tagline">
              "Every race. Every candidate. No hiding. No paywall."
            </p>
            <p style={{ fontSize: '1.125rem', lineHeight: 1.7, maxWidth: 600 }}>
              WhosRunningUSA is a free platform that levels the playing field. Whether you're a
              voter looking for real answers or a first-time candidate with zero budget —
              this is where democracy happens without the price tag.
            </p>
            <div className="hero-actions" style={{ marginTop: '2rem' }}>
              <Link to="/explore" className="btn btn-primary" style={{ padding: '0.875rem 1.75rem', fontSize: '1.0625rem' }}>
                I'm a Voter <ArrowRight size={18} />
              </Link>
              <Link to="/run" className="btn btn-secondary" style={{ padding: '0.875rem 1.75rem', fontSize: '1.0625rem', borderColor: 'white', color: 'white' }}>
                I'm Running for Office
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section style={{ background: 'var(--slate-50)', padding: '3.5rem 0' }}>
        <div className="container" style={{ maxWidth: 800, textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.75rem' }}>The system is broken</h2>
          <p style={{ fontSize: '1.0625rem', lineHeight: 1.8, color: 'var(--slate-700)', maxWidth: 650, margin: '0 auto' }}>
            Good people don't run because they think they need thousands of dollars just to get noticed.
            Career politicians stay in power because voters can't easily find out who else is on the ballot.
            We're changing that.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginTop: '2.5rem' }}>
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', border: 'none', background: 'white' }}>
              <DollarSign size={28} style={{ color: 'var(--burgundy-500)', marginBottom: '0.75rem' }} />
              <h4 style={{ marginBottom: '0.375rem', fontSize: '1rem' }}>$0 to get started</h4>
              <p style={{ color: 'var(--slate-600)', margin: 0, fontSize: '0.9375rem' }}>
                No ads to buy. No fundraising minimum. Create a full candidate profile for free.
              </p>
            </div>
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', border: 'none', background: 'white' }}>
              <Eye size={28} style={{ color: 'var(--burgundy-500)', marginBottom: '0.75rem' }} />
              <h4 style={{ marginBottom: '0.375rem', fontSize: '1rem' }}>Total transparency</h4>
              <p style={{ color: 'var(--slate-600)', margin: 0, fontSize: '0.9375rem' }}>
                Every question, every answer, every response rate — all public. No backroom deals.
              </p>
            </div>
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', border: 'none', background: 'white' }}>
              <Heart size={28} style={{ color: 'var(--burgundy-500)', marginBottom: '0.75rem' }} />
              <h4 style={{ marginBottom: '0.375rem', fontSize: '1rem' }}>Merit over money</h4>
              <p style={{ color: 'var(--slate-600)', margin: 0, fontSize: '0.9375rem' }}>
                Candidates rise by engaging with voters, not by outspending opponents.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Two Avenues */}
      <section style={{ padding: '4rem 0' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', marginBottom: '0.75rem', fontSize: '1.75rem' }}>Two sides. One mission.</h2>
          <p style={{ textAlign: 'center', color: 'var(--slate-600)', maxWidth: 550, margin: '0 auto 3rem', fontSize: '1.0625rem' }}>
            Whether you vote or you run, this platform works for you.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '2rem' }}>
            {/* For Voters */}
            <div className="card" style={{ padding: '2rem', borderTop: '4px solid var(--navy-700)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--navy-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Search size={24} style={{ color: 'var(--navy-700)' }} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.375rem' }}>For Voters</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--navy-700)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700, flexShrink: 0 }}>1</div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--navy-800)', marginBottom: '0.125rem' }}>Find who's on your ballot</div>
                    <div style={{ fontSize: '0.9375rem', color: 'var(--slate-600)' }}>Select your state and see every candidate — federal, state, and local.</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--navy-700)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700, flexShrink: 0 }}>2</div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--navy-800)', marginBottom: '0.125rem' }}>Ask real questions, get real answers</div>
                    <div style={{ fontSize: '0.9375rem', color: 'var(--slate-600)' }}>Submit questions directly. Upvote the ones that matter. All Q&A is public.</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--navy-700)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700, flexShrink: 0 }}>3</div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--navy-800)', marginBottom: '0.125rem' }}>Compare and build your voting guide</div>
                    <div style={{ fontSize: '0.9375rem', color: 'var(--slate-600)' }}>See candidates side-by-side on issues. Pick your choices and take your guide to the polls.</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--navy-700)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700, flexShrink: 0 }}>4</div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--navy-800)', marginBottom: '0.125rem' }}>Hold them accountable after they win</div>
                    <div style={{ fontSize: '0.9375rem', color: 'var(--slate-600)' }}>Track promises, voting records, and transparency scores. Democracy doesn't stop on election day.</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link to="/find-my-ballot" className="btn btn-primary" style={{ flex: 1 }}>
                  Find My Ballot <ArrowRight size={18} />
                </Link>
                <Link to="/issue-match" className="btn btn-secondary" style={{ flex: 1 }}>
                  <Target size={18} /> Match My Issues
                </Link>
              </div>
            </div>

            {/* For Candidates */}
            <div className="card" style={{ padding: '2rem', borderTop: '4px solid var(--burgundy-500)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(139,41,66,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Megaphone size={24} style={{ color: 'var(--burgundy-600)' }} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.375rem' }}>For Candidates</h3>
              </div>

              <div style={{ background: 'rgba(139,41,66,0.05)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', borderLeft: '3px solid var(--burgundy-500)' }}>
                <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--slate-700)', fontWeight: 500 }}>
                  You don't need a war chest to run for office. You need a platform where voters can find you, hear you, and judge you on your ideas — not your ad budget. That's what this is.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--burgundy-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700, flexShrink: 0 }}>1</div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--navy-800)', marginBottom: '0.125rem' }}>Create your profile — free, forever</div>
                    <div style={{ fontSize: '0.9375rem', color: 'var(--slate-600)' }}>Full candidate page with your positions, bio, social links, and contact info. No subscription, no fees.</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--burgundy-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700, flexShrink: 0 }}>2</div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--navy-800)', marginBottom: '0.125rem' }}>Declare where you stand</div>
                    <div style={{ fontSize: '0.9375rem', color: 'var(--slate-600)' }}>Fill out issue positions so voters who share your values can find you through our matching tools.</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--burgundy-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700, flexShrink: 0 }}>3</div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--navy-800)', marginBottom: '0.125rem' }}>Engage directly with your community</div>
                    <div style={{ fontSize: '0.9375rem', color: 'var(--slate-600)' }}>Answer voter questions, host town halls. Your responsiveness becomes your reputation.</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--burgundy-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700, flexShrink: 0 }}>4</div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--navy-800)', marginBottom: '0.125rem' }}>Get verified, earn trust</div>
                    <div style={{ fontSize: '0.9375rem', color: 'var(--slate-600)' }}>Verify your identity to stand out. Voters can see exactly who's real and who's engaged.</div>
                  </div>
                </div>
              </div>

              <Link to="/run" className="btn btn-accent" style={{ width: '100%' }}>
                Start Your Campaign — It's Free <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Search Section */}
      <section style={{ background: 'var(--navy-800)', padding: '3rem 0' }}>
        <div className="container" style={{ maxWidth: 650 }}>
          <h2 style={{ color: 'white', textAlign: 'center', marginBottom: '0.5rem' }}>Find your candidates right now</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: '1.5rem' }}>
            Search by name, office, or location.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
              <input
                type="text"
                placeholder="Search candidates, races, or issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    navigate(`/explore?q=${encodeURIComponent(searchQuery)}`)
                  }
                }}
                style={{ paddingLeft: '3rem', width: '100%' }}
              />
            </div>
            <Link to={`/explore${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`} className="btn btn-primary" style={{ flexShrink: 0 }}>
              Search
            </Link>
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
            <Link to="/find-my-ballot" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', textDecoration: 'none' }}>
              <MapPin size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
              Find My Ballot
            </Link>
            <Link to="/explore" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', textDecoration: 'none' }}>
              <Building2 size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
              Browse All Candidates
            </Link>
            <Link to="/issue-match" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', textDecoration: 'none' }}>
              <Target size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
              Match by Issues
            </Link>
          </div>
        </div>
      </section>

      {/* Election Countdown */}
      {nextElection && (
        <section style={{ padding: '2.5rem 0', background: 'var(--slate-50)' }}>
          <div className="container">
            <div className="election-countdown animate-fade-in-up">
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
          </div>
        </section>
      )}

      {/* Our Principles */}
      <section style={{ padding: '4rem 0' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', marginBottom: '0.75rem', fontSize: '1.75rem' }}>Built on principles, not politics</h2>
          <p style={{ textAlign: 'center', color: 'var(--slate-600)', maxWidth: 500, margin: '0 auto 2.5rem' }}>
            We don't pick sides. We pick transparency.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            <div className="card" style={{ padding: '1.5rem', background: 'var(--slate-50)', border: 'none' }}>
              <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Always Free for Candidates</h4>
              <p style={{ color: 'var(--slate-600)', margin: 0, fontSize: '0.9375rem' }}>
                We will never charge candidates to create profiles, reach voters, or participate. Period.
              </p>
            </div>
            <div className="card" style={{ padding: '1.5rem', background: 'var(--slate-50)', border: 'none' }}>
              <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>All Communication is Public</h4>
              <p style={{ color: 'var(--slate-600)', margin: 0, fontSize: '0.9375rem' }}>
                No private messaging. No backchannels. Every question and answer is visible to everyone.
              </p>
            </div>
            <div className="card" style={{ padding: '1.5rem', background: 'var(--slate-50)', border: 'none' }}>
              <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>No Organizational Endorsements</h4>
              <p style={{ color: 'var(--slate-600)', margin: 0, fontSize: '0.9375rem' }}>
                Only candidate-to-candidate endorsements. No PACs, no special interests, no pay-to-play.
              </p>
            </div>
            <div className="card" style={{ padding: '1.5rem', background: 'var(--slate-50)', border: 'none' }}>
              <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Radical Transparency</h4>
              <p style={{ color: 'var(--slate-600)', margin: 0, fontSize: '0.9375rem' }}>
                Response rates, engagement metrics, voting records — all visible. Silence is a data point.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Grassroots CTA */}
      <section style={{ background: 'linear-gradient(135deg, var(--navy-800) 0%, var(--navy-900) 100%)', padding: '4rem 0', textAlign: 'center', color: 'white' }}>
        <div className="container" style={{ maxWidth: 650 }}>
          <h2 style={{ color: 'white', marginBottom: '1rem', fontSize: '1.75rem' }}>
            The best person for the job shouldn't need the biggest bank account
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 550, margin: '0 auto 2rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
            If you've ever thought "I could do better than that politician" — you probably can.
            Create your candidate profile today, share it with your community, and let voters
            decide based on your ideas, not your fundraising.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/run" className="btn btn-primary" style={{ background: 'white', color: 'var(--navy-800)', padding: '0.875rem 2rem', fontSize: '1.0625rem' }}>
              Start Your Campaign — Free <ArrowRight size={18} />
            </Link>
            <Link to="/register" className="btn btn-secondary" style={{ borderColor: 'white', color: 'white', padding: '0.875rem 2rem', fontSize: '1.0625rem' }}>
              Create Voter Account
            </Link>
          </div>
        </div>
      </section>

      {loadError && (
        <div className="container" style={{ padding: '1rem 0' }}>
          <div style={{ background: '#fef3cd', color: '#856404', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.875rem' }}>
            Some data couldn't be loaded. The server may be starting up — try refreshing in a moment.
          </div>
        </div>
      )}
    </div>
  )
}

export default HomePage
