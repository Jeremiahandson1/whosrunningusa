import { Link } from 'react-router-dom'
import {
  ArrowRight, Search, MessageSquare, Scale, FileText, DollarSign, Eye,
  CheckCircle, Users, Target, Shield, Calculator, AlertTriangle, Vote
} from 'lucide-react'

const voterFeatures = [
  { icon: Search, title: 'Find My Ballot', text: 'See every race and every candidate on your ballot by entering your state and county.', to: '/find-my-ballot' },
  { icon: Scale, title: 'Compare Candidates', text: 'Side-by-side comparison on issues, endorsements, donors, and voting record.', to: '/compare' },
  { icon: MessageSquare, title: 'Ask Questions', text: 'Submit questions directly to candidates. All Q&A is public and upvotable.', to: '/explore' },
  { icon: FileText, title: 'Voting Guide Builder', text: 'Build a personal guide for your ballot and take it with you to the polls.', to: '/voting-guide' },
]

const accountabilityFeatures = [
  { icon: CheckCircle, title: 'Promise Tracker', text: 'Every campaign promise is logged and tracked after the election.', to: '/promises' },
  { icon: DollarSign, title: 'Follow the Money', text: 'Donor-to-vote connections that show exactly who benefits from which bill.', to: '/follow-the-money' },
  { icon: Eye, title: 'Accountability Mirror', text: 'Side-by-side: what they said on the campaign trail vs. how they actually voted.', to: '/accountability-mirror' },
  { icon: Calculator, title: 'Cost to You', text: 'Put a dollar figure on how much any bill, war, or bailout costs your household.', to: '/cost-calculator' },
  { icon: AlertTriangle, title: 'Conflict Scanner', text: 'Flags financial and personal conflicts of interest on every sitting official.', to: '/conflicts' },
  { icon: Vote, title: 'Rubber Stamp Score', text: 'How often a legislator votes with their own party — the loyalty index.', to: '/rubber-stamp' },
]

const candidateFeatures = [
  { icon: Users, title: 'Free Profile', text: 'A complete profile with photo, bio, issue positions, and Q&A — zero cost, zero gating.' },
  { icon: Target, title: 'Issue Positions', text: 'Publish structured positions on issues voters actually care about in your district.' },
  { icon: Shield, title: 'Verified Badge', text: 'Confirm your identity once and get a verified checkmark across the platform.' },
  { icon: MessageSquare, title: 'Direct Voter Q&A', text: 'Answer voter questions in your own words. Public, permanent, and searchable.' },
]

function Section({ title, subtitle, items, linked }) {
  return (
    <section style={{ marginBottom: '3rem' }}>
      <h2 style={{ marginBottom: '0.5rem' }}>{title}</h2>
      {subtitle && <p style={{ color: 'var(--slate-600)', marginBottom: '1.5rem' }}>{subtitle}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
        {items.map(({ icon: Icon, title: t, text, to }) => {
          const inner = (
            <>
              <Icon size={28} style={{ color: 'var(--burgundy-500)', marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1.0625rem', marginBottom: '0.5rem' }}>{t}</h3>
              <p style={{ color: 'var(--slate-600)', margin: 0, fontSize: '0.9375rem', lineHeight: 1.6 }}>{text}</p>
            </>
          )
          return linked && to ? (
            <Link key={t} to={to} className="card" style={{ padding: '1.5rem', textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {inner}
            </Link>
          ) : (
            <div key={t} className="card" style={{ padding: '1.5rem' }}>{inner}</div>
          )
        })}
      </div>
    </section>
  )
}

function PlatformFeaturesPage() {
  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Platform Features</h1>
          <p className="page-subtitle">
            Every tool WhosRunningUSA offers — for voters, for candidates, for accountability.
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <Section
          title="For Voters"
          subtitle="Find candidates, compare positions, and build your ballot."
          items={voterFeatures}
          linked
        />
        <Section
          title="Accountability Tools"
          subtitle="Track what happens after the vote is counted."
          items={accountabilityFeatures}
          linked
        />
        <Section
          title="For Candidates"
          subtitle="Everything you need to run — free, forever."
          items={candidateFeatures}
        />

        <section style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--slate-50)', borderRadius: 12 }}>
          <h2 style={{ marginBottom: '1rem' }}>Ready to get started?</h2>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/run" className="btn btn-primary">Run for Office <ArrowRight size={18} /></Link>
            <Link to="/explore" className="btn btn-secondary">Browse Candidates</Link>
          </div>
        </section>
      </div>
    </div>
  )
}

export default PlatformFeaturesPage
