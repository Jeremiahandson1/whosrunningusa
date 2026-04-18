import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'

const faqs = [
  {
    q: 'Does it really cost nothing to create a candidate profile?',
    a: 'Yes. There is no fee to create a profile, no fee to answer questions, no fee to appear in search results, and no fee to claim a verified badge. We do not sell boosted placements. Ranking is based on response rate and voter engagement, not money.',
  },
  {
    q: 'Who can create a profile?',
    a: 'Anyone who has officially filed to run for an elected office in the United States — federal, state, county, municipal, or school board. You\'ll be asked to confirm your filing and identity as part of the verification step.',
  },
  {
    q: 'How do I claim a profile that already exists?',
    a: (
      <>
        If WhosRunningUSA has already created a profile for you from public election filings, visit the{' '}
        <Link to="/claim-profile">Claim Profile</Link> page, find your record, and submit a claim. Our team reviews each claim before transferring control to you.
      </>
    ),
  },
  {
    q: 'What does the verification badge mean?',
    a: 'A verified badge means we\'ve confirmed that the person managing the profile is the actual candidate (or their authorized staff). Verification uses Stripe Identity and usually takes under 48 hours after you submit.',
  },
  {
    q: 'Who sees the questions voters ask me?',
    a: 'Every question and every answer is public by default. That\'s the core of the platform — voters can see not just your answers, but how quickly you respond and how many questions you leave unanswered.',
  },
  {
    q: 'Can I decline to answer a question?',
    a: 'Yes. You can mark a question as "declined to answer" with an optional short explanation. Declining is public, but it\'s still more transparent than silence — and it counts differently in your response rate than an unanswered question.',
  },
  {
    q: 'What about harassment or bad-faith questions?',
    a: 'You can flag any question for moderation. Our team reviews flagged questions against public community guidelines. We remove genuine harassment, doxxing, and off-topic spam, but we do not remove questions simply because they are tough or unflattering.',
  },
  {
    q: 'Can I edit my answers later?',
    a: 'You can update an answer, but the edit history is preserved and publicly visible. This protects voters from "stealth edits" and protects you from misquotation — there\'s always a clean record of what was said and when.',
  },
  {
    q: 'Does WhosRunningUSA endorse candidates?',
    a: 'No. We are nonpartisan and independent. We do not endorse candidates, accept political advertising, or take organizational endorsements. Our job is to make information findable, not to tell voters what to do with it.',
  },
  {
    q: 'What happens to my profile after the election?',
    a: 'Your profile stays live. If you win, it becomes the starting point for your accountability record — promises, votes, and attendance are tracked automatically. If you lose, your profile becomes a historical record you can reactivate if you run again.',
  },
]

function FAQItem({ q, a, open, onToggle }) {
  return (
    <div className="card" style={{ padding: 0, marginBottom: '0.75rem' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontWeight: 600,
          fontSize: '1.0625rem',
          color: 'var(--navy-800)',
        }}
      >
        <span>{q}</span>
        {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {open && (
        <div style={{ padding: '0 1.5rem 1.25rem', color: 'var(--slate-700)', lineHeight: 1.7 }}>
          {a}
        </div>
      )}
    </div>
  )
}

function CandidateFAQPage() {
  const [openIdx, setOpenIdx] = useState(0)

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Candidate FAQ</h1>
          <p className="page-subtitle">
            Everything you need to know about running your campaign on WhosRunningUSA.
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '3rem', paddingBottom: '3rem', maxWidth: 820 }}>
        {faqs.map((f, i) => (
          <FAQItem
            key={i}
            q={f.q}
            a={f.a}
            open={openIdx === i}
            onToggle={() => setOpenIdx(openIdx === i ? -1 : i)}
          />
        ))}

        <section style={{ textAlign: 'center', padding: '2.5rem 1rem', marginTop: '2rem', background: 'var(--slate-50)', borderRadius: 12 }}>
          <h2 style={{ marginBottom: '0.75rem' }}>Still have questions?</h2>
          <p style={{ color: 'var(--slate-600)', marginBottom: '1.5rem' }}>
            Reach out — we respond to every candidate inquiry within one business day.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/run" className="btn btn-primary">Run for Office <ArrowRight size={18} /></Link>
            <Link to="/contact" className="btn btn-secondary">Contact Us</Link>
          </div>
        </section>
      </div>
    </div>
  )
}

export default CandidateFAQPage
