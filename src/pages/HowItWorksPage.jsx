import { Link } from 'react-router-dom'
import {
  Search, MessageCircle, ThumbsUp, PlayCircle, FileText,
  CheckCircle, Shield, Users, ArrowRight, Eye
} from 'lucide-react'

const voterSteps = [
  {
    icon: Search,
    title: 'Find Your Races',
    description: 'Enter your location and see every race on your ballot, from President down to School Board. No race is too small.',
  },
  {
    icon: Eye,
    title: 'Research Candidates',
    description: 'View verified candidate profiles with clear issue positions, voting records, and engagement metrics. Compare candidates side-by-side.',
  },
  {
    icon: MessageCircle,
    title: 'Ask Questions',
    description: 'Submit questions directly to candidates. Upvote important ones so they rise to the top. All Q&A is public.',
  },
  {
    icon: PlayCircle,
    title: 'Attend Town Halls',
    description: 'Join live video or text-based town halls. Ask follow-up questions in real time and hear candidates respond.',
  },
  {
    icon: FileText,
    title: 'Build Your Voting Guide',
    description: 'Create a personalized ballot with your picks for each race. Take it to the polls or share it with friends.',
  },
  {
    icon: ThumbsUp,
    title: 'Hold Them Accountable',
    description: 'After elections, track whether officials keep their campaign promises. Transparency doesn\'t stop on election day.',
  },
]

const candidateSteps = [
  {
    icon: Users,
    title: 'Create Your Profile',
    description: 'Sign up for free and fill out your candidate profile. No money required to reach voters.',
  },
  {
    icon: Shield,
    title: 'Get Verified',
    description: 'Complete identity verification to earn the verified badge. Voters trust verified candidates more.',
  },
  {
    icon: CheckCircle,
    title: 'Declare Your Positions',
    description: 'Fill out structured issue questionnaires so voters can clearly see where you stand.',
  },
  {
    icon: MessageCircle,
    title: 'Engage With Voters',
    description: 'Answer voter questions, host town halls, and post updates. Your response rate is public.',
  },
]

const principles = [
  { title: 'No External Links', text: 'All content stays on verified profiles. No driving traffic to campaign sites.' },
  { title: 'No Private Messaging', text: 'All candidate communication is public. Transparency is non-negotiable.' },
  { title: 'No Organizational Endorsements', text: 'Only candidate-to-candidate endorsements. No PACs, no special interests.' },
  { title: 'Radical Transparency', text: 'Engagement metrics, response rates, and pending questions are visible to everyone.' },
]

function HowItWorksPage() {
  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>How It Works</h1>
          <p className="page-subtitle">
            WhosRunningUSA makes democracy accessible and transparent for everyone.
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        {/* For Voters */}
        <section style={{ marginBottom: '4rem' }}>
          <h2 style={{ marginBottom: '2rem', textAlign: 'center' }}>For Voters</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {voterSteps.map((step, idx) => (
              <div key={idx} className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'var(--slate-100)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: 'var(--navy-700)'
                  }}>
                    <step.icon size={24} />
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Step {idx + 1}
                  </div>
                </div>
                <h4 style={{ marginBottom: '0.5rem' }}>{step.title}</h4>
                <p style={{ color: 'var(--slate-600)', margin: 0, fontSize: '0.9375rem' }}>{step.description}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link to="/register" className="btn btn-primary">
              Create Free Account <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        {/* For Candidates */}
        <section style={{ marginBottom: '4rem' }}>
          <h2 style={{ marginBottom: '2rem', textAlign: 'center' }}>For Candidates</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {candidateSteps.map((step, idx) => (
              <div key={idx} className="card" style={{ padding: '1.5rem', borderTop: '3px solid var(--burgundy-500)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'rgba(139,41,66,0.1)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: 'var(--burgundy-600)'
                  }}>
                    <step.icon size={24} />
                  </div>
                </div>
                <h4 style={{ marginBottom: '0.5rem' }}>{step.title}</h4>
                <p style={{ color: 'var(--slate-600)', margin: 0, fontSize: '0.9375rem' }}>{step.description}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link to="/run" className="btn btn-accent">
              Run For Office <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        {/* Principles */}
        <section>
          <h2 style={{ marginBottom: '2rem', textAlign: 'center' }}>Our Principles</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
            {principles.map((p, idx) => (
              <div key={idx} className="card" style={{ padding: '1.5rem', background: 'var(--slate-50)' }}>
                <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>{p.title}</h4>
                <p style={{ color: 'var(--slate-600)', margin: 0, fontSize: '0.9375rem' }}>{p.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default HowItWorksPage
