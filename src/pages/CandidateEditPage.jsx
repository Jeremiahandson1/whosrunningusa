import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Save, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'

function CandidateEditPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    displayName: '',
    officialTitle: '',
    partyAffiliation: '',
    campaignEmail: '',
    campaignPhone: '',
    fullBio: '',
    education: '',
    professionalBackground: '',
    twitterHandle: '',
    facebookHandle: '',
  })

  useEffect(() => {
    if (!user) return
    const profileId = user.candidate_profile_id
    if (!profileId) {
      setLoading(false)
      return
    }
    api.get(`/candidates/${profileId}`, true)
      .then(data => {
        const c = data.candidate || data
        setForm({
          displayName: c.display_name || '',
          officialTitle: c.official_title || '',
          partyAffiliation: c.party_affiliation || '',
          campaignEmail: c.campaign_email || '',
          campaignPhone: c.campaign_phone || '',
          fullBio: c.full_bio || '',
          education: c.education || '',
          professionalBackground: c.professional_background || '',
          twitterHandle: c.twitter_handle || '',
          facebookHandle: c.facebook_handle || '',
        })
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [user])

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setSuccess(false)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await api.put('/candidates/profile', form, true)
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  if (!user || user.user_type !== 'candidate') {
    return (
      <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
        <div className="empty-state">
          <h3>Candidate access required</h3>
          <p>You need a candidate account to edit a profile.</p>
          <Link to="/run" className="btn btn-primary" style={{ marginTop: '1rem' }}>Learn About Running</Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}><div className="loading-state">Loading profile...</div></div>
  }

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Edit Your Profile</h1>
          <p className="page-subtitle">Keep your information up to date for voters.</p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem', maxWidth: 700 }}>
        {user.candidate_profile_id && (
          <Link to={`/candidate/${user.candidate_profile_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1.5rem', color: 'var(--navy-600)' }}>
            <ArrowLeft size={16} /> Back to profile
          </Link>
        )}

        {error && <div style={{ background: 'var(--error-bg, #fef2f2)', color: 'var(--error)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>{error}</div>}
        {success && <div style={{ background: '#f0fdf4', color: 'var(--success)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>Profile saved successfully!</div>}

        <form onSubmit={handleSave}>
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Basic Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Display Name</label>
                <input type="text" value={form.displayName} onChange={e => handleChange('displayName', e.target.value)} placeholder="Your public name" />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Official Title</label>
                <input type="text" value={form.officialTitle} onChange={e => handleChange('officialTitle', e.target.value)} placeholder="e.g. City Council Member, District 4" />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Party Affiliation</label>
                <input type="text" value={form.partyAffiliation} onChange={e => handleChange('partyAffiliation', e.target.value)} placeholder="e.g. Democratic, Republican, Independent" />
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>About You</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Bio</label>
                <textarea value={form.fullBio} onChange={e => handleChange('fullBio', e.target.value)} rows={5} placeholder="Tell voters about yourself..." style={{ resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Education</label>
                <textarea value={form.education} onChange={e => handleChange('education', e.target.value)} rows={3} placeholder="Your educational background" style={{ resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Professional Background</label>
                <textarea value={form.professionalBackground} onChange={e => handleChange('professionalBackground', e.target.value)} rows={3} placeholder="Your work experience" style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Contact & Social</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Campaign Email</label>
                <input type="email" value={form.campaignEmail} onChange={e => handleChange('campaignEmail', e.target.value)} placeholder="campaign@example.com" />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Campaign Phone</label>
                <input type="tel" value={form.campaignPhone} onChange={e => handleChange('campaignPhone', e.target.value)} placeholder="(555) 123-4567" />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Twitter Handle</label>
                <input type="text" value={form.twitterHandle} onChange={e => handleChange('twitterHandle', e.target.value)} placeholder="@handle" />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Facebook Handle</label>
                <input type="text" value={form.facebookHandle} onChange={e => handleChange('facebookHandle', e.target.value)} placeholder="facebook.com/yourpage" />
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
            <Save size={18} /> {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default CandidateEditPage
