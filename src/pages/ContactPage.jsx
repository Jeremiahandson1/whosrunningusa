import React, { useState } from 'react'
import { Mail, MessageCircle, Send } from 'lucide-react'
import api from '../utils/api'

function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/contact', form)
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Failed to send message. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Contact Us</h1>
          <p className="page-subtitle">Have a question or feedback? We'd love to hear from you.</p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', maxWidth: 900, margin: '0 auto' }}>
          <div>
            <h3 style={{ marginBottom: '1.5rem' }}>Get in Touch</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <Mail size={20} style={{ color: 'var(--navy-600)', marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Email</div>
                  <div style={{ color: 'var(--slate-600)' }}>support@whosrunningusa.com</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <MessageCircle size={20} style={{ color: 'var(--navy-600)', marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Community</div>
                  <div style={{ color: 'var(--slate-600)' }}>Join our community forum to discuss features and civic engagement.</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            {submitted ? (
              <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <Send size={32} style={{ color: 'var(--success)', marginBottom: '1rem' }} />
                <h3 style={{ marginBottom: '0.5rem' }}>Message Sent</h3>
                <p style={{ color: 'var(--slate-600)', margin: 0 }}>Thank you for reaching out. We'll get back to you within 48 hours.</p>
              </div>
            ) : (
              <div className="card" style={{ padding: '2rem' }}>
                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="contact-name" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Name</label>
                    <input id="contact-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="contact-email" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Email</label>
                    <input id="contact-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="contact-subject" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Subject</label>
                    <input id="contact-subject" type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label htmlFor="contact-message" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem' }}>Message</label>
                    <textarea id="contact-message" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required style={{ resize: 'vertical' }} />
                  </div>
                  {error && <p role="alert" aria-live="assertive" style={{ color: 'var(--error)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
                    {submitting ? 'Sending...' : 'Send Message'} <Send size={18} />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContactPage
