import { Link } from 'react-router-dom'
import { ArrowRight, Shield, Eye, Users, Globe } from 'lucide-react'

const values = [
  { icon: Eye, title: 'Radical Transparency', text: 'All candidate engagement is public. Response rates, pending questions, and attendance metrics are visible to everyone.' },
  { icon: Shield, title: 'Independence', text: 'We don\'t accept political advertising or organizational endorsements. The platform remains independent and unbiased.' },
  { icon: Users, title: 'Accessibility', text: 'Running for office shouldn\'t require wealth. Every candidate gets the same free tools to reach voters.' },
  { icon: Globe, title: 'Every Race Matters', text: 'From President to School Board, we cover every race because local government shapes daily life.' },
]

function AboutPage() {
  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>About WhosRunningUSA</h1>
          <p className="page-subtitle">
            Democracy should be accessible to everyone.
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <section style={{ maxWidth: 720, margin: '0 auto', marginBottom: '4rem' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Our Mission</h2>
          <p style={{ fontSize: '1.125rem', lineHeight: 1.8, color: 'var(--slate-700)' }}>
            WhosRunningUSA is a civic engagement platform that empowers voters with transparency and enables anyone to run for office regardless of wealth.
          </p>
          <p style={{ fontSize: '1.125rem', lineHeight: 1.8, color: 'var(--slate-700)' }}>
            We believe that democracy works better when voters can easily find out who is running for every office on their ballot, see where candidates stand on the issues, ask them questions directly, and hold them accountable after they're elected.
          </p>
          <p style={{ fontSize: '1.125rem', lineHeight: 1.8, color: 'var(--slate-700)' }}>
            At the same time, we believe anyone with the desire to serve their community should be able to run for office without needing wealthy donors or expensive campaign infrastructure. Our platform gives every candidate the same free tools to reach voters and build grassroots support.
          </p>
        </section>

        <section style={{ marginBottom: '4rem' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Our Values</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
            {values.map((v, idx) => (
              <div key={idx} className="card" style={{ padding: '1.5rem' }}>
                <v.icon size={28} style={{ color: 'var(--navy-600)', marginBottom: '1rem' }} />
                <h4 style={{ marginBottom: '0.5rem' }}>{v.title}</h4>
                <p style={{ color: 'var(--slate-600)', margin: 0, fontSize: '0.9375rem' }}>{v.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ textAlign: 'center', padding: '2rem 0' }}>
          <h2 style={{ marginBottom: '1rem' }}>Join the movement</h2>
          <p style={{ color: 'var(--slate-600)', maxWidth: '500px', margin: '0 auto 2rem' }}>
            Whether you're a voter seeking transparency or a candidate ready to serve, WhosRunningUSA is for you.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-primary">Create Account <ArrowRight size={18} /></Link>
            <Link to="/how-it-works" className="btn btn-secondary">Learn More</Link>
          </div>
        </section>
      </div>
    </div>
  )
}

export default AboutPage
