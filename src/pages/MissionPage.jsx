import { Link } from 'react-router-dom'
import { ArrowRight, Target, Scale, Users, Eye } from 'lucide-react'

const pillars = [
  { icon: Scale, title: 'Level the playing field', text: 'A first-time candidate with no donors should be just as findable as a ten-term incumbent. We build tools that make merit visible, not money.' },
  { icon: Eye, title: 'Make the record public', text: 'Votes, promises, donors, conflicts of interest — every piece of data we collect is free, searchable, and linked back to primary sources.' },
  { icon: Users, title: 'Give voters real leverage', text: 'Questions, comparisons, voting guides, accountability tracking. Democracy shouldn\'t end on election day, and neither should the conversation.' },
  { icon: Target, title: 'Cover every race', text: 'From President to School Board. Local races decide most of what touches your daily life, and they\'re where transparency matters most.' },
]

function MissionPage() {
  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Our Mission</h1>
          <p className="page-subtitle">
            Rebuild the connection between voters and the people who represent them.
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <section style={{ maxWidth: 720, margin: '0 auto 3rem' }}>
          <p style={{ fontSize: '1.25rem', lineHeight: 1.7, color: 'var(--slate-700)' }}>
            American elections are drowning in money, and voters are drowning in noise. Most people can't name the candidates on their own ballot a week before the election — not because they don't care, but because the information is scattered, paywalled, or buried behind ad-buys.
          </p>
          <p style={{ fontSize: '1.125rem', lineHeight: 1.8, color: 'var(--slate-700)', marginTop: '1.5rem' }}>
            WhosRunningUSA exists to change that. We're building the single place where any voter, in any state, can find every candidate for every race — and where any citizen with the conviction to run can get on the map without a fundraiser.
          </p>
        </section>

        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>What we stand for</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {pillars.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card" style={{ padding: '2rem' }}>
                <Icon size={32} style={{ color: 'var(--burgundy-500)', marginBottom: '1rem' }} />
                <h3 style={{ marginBottom: '0.75rem', fontSize: '1.25rem' }}>{title}</h3>
                <p style={{ color: 'var(--slate-600)', margin: 0, lineHeight: 1.6 }}>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--slate-50)', borderRadius: 12 }}>
          <h2 style={{ marginBottom: '1rem' }}>Join the work</h2>
          <p style={{ color: 'var(--slate-700)', maxWidth: 560, margin: '0 auto 2rem' }}>
            Whether you're a voter, a candidate, or a journalist — the platform only works if people use it, test it, and push back when we get something wrong.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/about" className="btn btn-primary">About the project <ArrowRight size={18} /></Link>
            <Link to="/contact" className="btn btn-secondary">Contact us</Link>
          </div>
        </section>
      </div>
    </div>
  )
}

export default MissionPage
