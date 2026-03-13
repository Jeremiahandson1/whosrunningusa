import { Link } from 'react-router-dom'
import {
  ArrowRight, CheckCircle, Users, MessageCircle, PlayCircle,
  Shield, DollarSign, BarChart3, Award
} from 'lucide-react'

const features = [
  { icon: DollarSign, title: 'Completely Free', description: 'No fees, no premium tiers. Every candidate gets the same tools regardless of campaign budget.' },
  { icon: Shield, title: 'Identity Verification', description: 'Earn voter trust with our verification badge. Verify your identity to stand out from unverified profiles.' },
  { icon: CheckCircle, title: 'Issue Positions', description: 'Clearly declare where you stand on the issues that matter. Structured questionnaires make comparison easy.' },
  { icon: MessageCircle, title: 'Voter Q&A', description: 'Answer questions from voters in your district. Your response rate is public, showing your commitment.' },
  { icon: PlayCircle, title: 'Town Halls', description: 'Host live video or text-based town halls. Engage directly with voters in real time.' },
  { icon: Users, title: 'Peer Endorsements', description: 'Receive endorsements from other verified candidates. No organizational or PAC endorsements.' },
  { icon: BarChart3, title: 'Engagement Analytics', description: 'See how voters interact with your profile. Track questions, followers, and town hall attendance.' },
  { icon: Award, title: 'Promise Tracker', description: 'Make campaign promises voters can track. Build trust by keeping your commitments visible.' },
]

const steps = [
  { num: '1', title: 'Create Your Account', text: 'Sign up and select "I\'m Running for Office" to get started.' },
  { num: '2', title: 'Complete Verification', text: 'Verify your identity to earn the trusted candidate badge.' },
  { num: '3', title: 'Build Your Profile', text: 'Add your bio, positions on issues, and campaign information.' },
  { num: '4', title: 'Start Engaging', text: 'Answer voter questions, schedule town halls, and build grassroots support.' },
]

function RunForOfficePage() {
  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, var(--navy-800) 0%, var(--navy-900) 100%)',
        color: 'white', padding: '4rem 0', textAlign: 'center'
      }}>
        <div className="container">
          <h1 style={{ color: 'white', marginBottom: '1rem' }}>Run For Office</h1>
          <p style={{ fontSize: '1.25rem', opacity: 0.9, maxWidth: '600px', margin: '0 auto 2rem' }}>
            Democracy works best when anyone can run, not just those with money. Get your message to voters for free.
          </p>
          <Link to="/register" className="btn btn-accent" style={{ padding: '1rem 2rem', fontSize: '1.0625rem' }}>
            Get Started Free <ArrowRight size={18} />
          </Link>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        {/* Features */}
        <section style={{ marginBottom: '4rem' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Platform Features</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {features.map((f, idx) => (
              <div key={idx} className="card" style={{ padding: '1.5rem' }}>
                <f.icon size={28} style={{ color: 'var(--burgundy-500)', marginBottom: '1rem' }} />
                <h4 style={{ marginBottom: '0.5rem' }}>{f.title}</h4>
                <p style={{ color: 'var(--slate-600)', margin: 0, fontSize: '0.9375rem' }}>{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How to get started */}
        <section style={{ marginBottom: '4rem' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>How to Get Started</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
            {steps.map((s, idx) => (
              <div key={idx} style={{ textAlign: 'center', padding: '1.5rem' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'var(--navy-700)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', fontWeight: 700, margin: '0 auto 1rem',
                  fontFamily: 'var(--font-display)'
                }}>
                  {s.num}
                </div>
                <h4 style={{ marginBottom: '0.5rem' }}>{s.title}</h4>
                <p style={{ color: 'var(--slate-600)', margin: 0, fontSize: '0.9375rem' }}>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ textAlign: 'center', padding: '3rem 0' }}>
          <h2 style={{ marginBottom: '1rem' }}>Ready to serve your community?</h2>
          <p style={{ color: 'var(--slate-600)', maxWidth: '500px', margin: '0 auto 2rem' }}>
            Join hundreds of candidates who are building grassroots campaigns on transparency and direct voter engagement.
          </p>
          <Link to="/register" className="btn btn-primary" style={{ padding: '1rem 2rem' }}>
            Create Candidate Account <ArrowRight size={18} />
          </Link>
        </section>
      </div>
    </div>
  )
}

export default RunForOfficePage
