import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Save, ArrowLeft, Plus, Trash2, Upload, RotateCcw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import Breadcrumbs from '../components/Breadcrumbs'

function CandidateEditPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [criminalRecords, setCriminalRecords] = useState([])
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [recordForm, setRecordForm] = useState({ offense: '', year: '', jurisdiction: '', jurisdictionLevel: '', disposition: '', sentence: '', candidateStatement: '' })
  const [recordSaving, setRecordSaving] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [statementEdit, setStatementEdit] = useState(null)
  const [statementText, setStatementText] = useState('')
  const [profilePic, setProfilePic] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [showDraftBanner, setShowDraftBanner] = useState(false)
  const [draftData, setDraftData] = useState(null)
  const formRef = useRef(null)
  const serverFormRef = useRef(null)
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

  const draftKey = user ? `draft_candidate_edit_${user.id}` : null

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
        if (c.profile_pic_url) setProfilePic(c.profile_pic_url)
        const serverForm = {
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
        }
        serverFormRef.current = serverForm
        setForm(serverForm)

        // Check for saved draft
        if (draftKey) {
          try {
            const saved = localStorage.getItem(draftKey)
            if (saved) {
              const parsed = JSON.parse(saved)
              // Only show banner if draft differs from server data
              const isDifferent = Object.keys(serverForm).some(k => parsed[k] !== serverForm[k])
              if (isDifferent) {
                setDraftData(parsed)
                setShowDraftBanner(true)
              } else {
                localStorage.removeItem(draftKey)
              }
            }
          } catch {
            localStorage.removeItem(draftKey)
          }
        }
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
    api.get('/criminal-records/my-records', true)
      .then(data => setCriminalRecords(data.records || []))
      .catch(() => {})
  }, [user, draftKey])

  // Keep formRef in sync for the autosave interval
  useEffect(() => {
    formRef.current = form
  }, [form])

  // Autosave to localStorage every 5 seconds when there are changes
  useEffect(() => {
    if (!draftKey || !serverFormRef.current) return

    const interval = setInterval(() => {
      const current = formRef.current
      if (!current || !serverFormRef.current) return
      const hasChanges = Object.keys(current).some(k => current[k] !== serverFormRef.current[k])
      if (hasChanges) {
        try {
          localStorage.setItem(draftKey, JSON.stringify(current))
        } catch {
          // storage full or unavailable
        }
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [draftKey])

  const handleRestoreDraft = () => {
    if (draftData) {
      setForm(draftData)
    }
    setShowDraftBanner(false)
    setDraftData(null)
  }

  const handleDiscardDraft = () => {
    if (draftKey) localStorage.removeItem(draftKey)
    setShowDraftBanner(false)
    setDraftData(null)
  }

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setSuccess(false)
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
      const res = await fetch(`${apiBase}/uploads/profile-pic`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setProfilePic(data.url)
    } catch (err) {
      alert(err.message || 'Failed to upload photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await api.put('/candidates/profile', form, true)
      setSuccess(true)
      // Clear draft and update server reference on successful save
      if (draftKey) localStorage.removeItem(draftKey)
      serverFormRef.current = { ...form }
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
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard', path: '/dashboard' }, { label: 'Edit Profile' }]} />
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

        {showDraftBanner && (
          <div style={{ background: 'var(--navy-100, #e0e7ff)', border: '1px solid var(--navy-300, #93c5fd)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RotateCcw size={18} style={{ color: 'var(--navy-700)' }} />
              <span style={{ fontWeight: 600, color: 'var(--navy-700)' }}>Restore unsaved changes?</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }} onClick={handleRestoreDraft}>
                Restore
              </button>
              <button type="button" className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }} onClick={handleDiscardDraft}>
                Discard
              </button>
            </div>
          </div>
        )}

        {error && <div role="alert" aria-live="assertive" style={{ background: 'var(--error-bg, #fef2f2)', color: 'var(--error)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>{error}</div>}
        {success && <div role="status" aria-live="polite" style={{ background: '#f0fdf4', color: 'var(--success)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>Profile saved successfully!</div>}

        <form onSubmit={handleSave}>
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, var(--burgundy-500) 0%, var(--burgundy-700) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700, color: 'white' }}>
                {profilePic
                  ? <img src={profilePic} alt={`${form.displayName || 'Candidate'} profile photo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (form.displayName || user?.first_name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                }
              </div>
              <label style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: '50%', background: 'var(--navy-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploadingPhoto ? 'wait' : 'pointer', border: '2px solid white' }}>
                <Upload size={14} color="white" />
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handlePhotoUpload} disabled={uploadingPhoto} style={{ display: 'none' }} />
              </label>
            </div>
            <div>
              <h3 style={{ margin: 0, marginBottom: '0.25rem' }}>Profile Photo</h3>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                {uploadingPhoto ? 'Uploading...' : 'Click the icon to upload a new photo.'}
              </p>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Basic Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label htmlFor="edit-display-name" style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Display Name</label>
                <input id="edit-display-name" type="text" value={form.displayName} onChange={e => handleChange('displayName', e.target.value)} placeholder="Your public name" />
              </div>
              <div>
                <label htmlFor="edit-official-title" style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Official Title</label>
                <input id="edit-official-title" type="text" value={form.officialTitle} onChange={e => handleChange('officialTitle', e.target.value)} placeholder="e.g. City Council Member, District 4" />
              </div>
              <div>
                <label htmlFor="edit-party" style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Party Affiliation</label>
                <input id="edit-party" type="text" value={form.partyAffiliation} onChange={e => handleChange('partyAffiliation', e.target.value)} placeholder="e.g. Democratic, Republican, Independent" />
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>About You</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label htmlFor="edit-bio" style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Bio</label>
                <textarea id="edit-bio" value={form.fullBio} onChange={e => handleChange('fullBio', e.target.value)} rows={5} placeholder="Tell voters about yourself..." style={{ resize: 'vertical' }} />
              </div>
              <div>
                <label htmlFor="edit-education" style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Education</label>
                <textarea id="edit-education" value={form.education} onChange={e => handleChange('education', e.target.value)} rows={3} placeholder="Your educational background" style={{ resize: 'vertical' }} />
              </div>
              <div>
                <label htmlFor="edit-prof-bg" style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Professional Background</label>
                <textarea id="edit-prof-bg" value={form.professionalBackground} onChange={e => handleChange('professionalBackground', e.target.value)} rows={3} placeholder="Your work experience" style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Contact & Social</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label htmlFor="edit-campaign-email" style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Campaign Email</label>
                <input id="edit-campaign-email" type="email" value={form.campaignEmail} onChange={e => handleChange('campaignEmail', e.target.value)} placeholder="campaign@example.com" />
              </div>
              <div>
                <label htmlFor="edit-campaign-phone" style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Campaign Phone</label>
                <input id="edit-campaign-phone" type="tel" value={form.campaignPhone} onChange={e => handleChange('campaignPhone', e.target.value)} placeholder="(555) 123-4567" />
              </div>
              <div>
                <label htmlFor="edit-twitter" style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Twitter Handle</label>
                <input id="edit-twitter" type="text" value={form.twitterHandle} onChange={e => handleChange('twitterHandle', e.target.value)} placeholder="@handle" />
              </div>
              <div>
                <label htmlFor="edit-facebook" style={{ display: 'block', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Facebook Handle</label>
                <input id="edit-facebook" type="text" value={form.facebookHandle} onChange={e => handleChange('facebookHandle', e.target.value)} placeholder="facebook.com/yourpage" />
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
            <Save size={18} /> {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        {/* Criminal Records Self-Report */}
        <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Criminal Record Disclosure</h3>
            <button type="button" className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }} onClick={() => setShowRecordForm(!showRecordForm)}>
              <Plus size={16} /> Add Record
            </button>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '1rem' }}>
            Voluntarily disclose criminal records. Self-reported records appear on your profile immediately with a "Self-Reported" label.
          </p>

          {showRecordForm && (
            <div style={{ border: '1px solid var(--slate-200)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>Offense *</label>
                  <input type="text" value={recordForm.offense} onChange={e => setRecordForm(p => ({ ...p, offense: e.target.value }))} placeholder="Description of the offense" />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>Year</label>
                    <input type="number" value={recordForm.year} onChange={e => setRecordForm(p => ({ ...p, year: e.target.value }))} placeholder="e.g. 2019" />
                  </div>
                  <div style={{ flex: 2, minWidth: 180 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>Jurisdiction</label>
                    <input type="text" value={recordForm.jurisdiction} onChange={e => setRecordForm(p => ({ ...p, jurisdiction: e.target.value }))} placeholder="e.g. Cook County, IL" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>Jurisdiction Level</label>
                    <select value={recordForm.jurisdictionLevel} onChange={e => setRecordForm(p => ({ ...p, jurisdictionLevel: e.target.value }))}>
                      <option value="">Select...</option>
                      <option value="county">County</option>
                      <option value="state">State</option>
                      <option value="federal">Federal</option>
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>Disposition *</label>
                    <select value={recordForm.disposition} onChange={e => setRecordForm(p => ({ ...p, disposition: e.target.value }))}>
                      <option value="">Select...</option>
                      <option value="convicted">Convicted</option>
                      <option value="acquitted">Acquitted</option>
                      <option value="dismissed">Dismissed</option>
                      <option value="expunged">Expunged</option>
                      <option value="pending">Pending</option>
                      <option value="no_contest">No Contest</option>
                      <option value="deferred">Deferred</option>
                      <option value="pardoned">Pardoned</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>Sentence</label>
                  <input type="text" value={recordForm.sentence} onChange={e => setRecordForm(p => ({ ...p, sentence: e.target.value }))} placeholder="e.g. 6 months probation" />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>Your Statement</label>
                  <textarea value={recordForm.candidateStatement} onChange={e => setRecordForm(p => ({ ...p, candidateStatement: e.target.value }))} rows={3} placeholder="Your statement about this record (optional)" style={{ resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-primary" disabled={recordSaving || !recordForm.offense || !recordForm.disposition} onClick={async () => {
                    setRecordSaving(true)
                    try {
                      const data = await api.post('/criminal-records', recordForm, true)
                      setCriminalRecords(prev => [data, ...prev])
                      setRecordForm({ offense: '', year: '', jurisdiction: '', jurisdictionLevel: '', disposition: '', sentence: '', candidateStatement: '' })
                      setShowRecordForm(false)
                    } catch (err) {
                      alert(err.message || 'Failed to save record')
                    } finally {
                      setRecordSaving(false)
                    }
                  }}>
                    {recordSaving ? 'Saving...' : 'Save Record'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowRecordForm(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {criminalRecords.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {criminalRecords.map(record => (
                <div key={record.id} style={{ padding: '0.75rem', border: '1px solid var(--slate-200)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{record.offense}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                        {record.disposition.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}{record.year ? ` (${record.year})` : ''}{record.jurisdiction ? ` — ${record.jurisdiction}` : ''}
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: record.moderation_status === 'approved' ? 'var(--success)' : record.moderation_status === 'rejected' ? 'var(--error)' : 'var(--warning)' }}>
                          {record.moderation_status === 'approved' ? 'Public' : record.moderation_status === 'rejected' ? 'Rejected' : 'Pending Review'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                          {record.source === 'self_reported' ? 'Self-Reported' : 'Public Record'}
                        </span>
                      </div>
                      {record.candidate_statement && statementEdit !== record.id && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--slate-600)', fontStyle: 'italic' }}>
                          Statement: "{record.candidate_statement}"
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                      {record.source === 'self_reported' && (
                        <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--navy-600)', padding: '0.25rem', fontSize: '0.75rem' }} onClick={() => {
                          setEditingRecord(record.id)
                          setEditForm({ offense: record.offense, year: record.year || '', jurisdiction: record.jurisdiction || '', jurisdictionLevel: record.jurisdiction_level || '', disposition: record.disposition, sentence: record.sentence || '', candidateStatement: record.candidate_statement || '' })
                        }}>Edit</button>
                      )}
                      {record.source === 'system_pulled' && (
                        <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--navy-600)', padding: '0.25rem', fontSize: '0.75rem' }} onClick={() => {
                          setStatementEdit(record.id)
                          setStatementText(record.candidate_statement || '')
                        }}>{record.candidate_statement ? 'Edit Statement' : 'Add Statement'}</button>
                      )}
                      {record.source === 'self_reported' && (
                        <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: '0.25rem' }} onClick={async () => {
                          if (!confirm('Delete this record?')) return
                          try {
                            await api.delete(`/criminal-records/${record.id}`, true)
                            setCriminalRecords(prev => prev.filter(r => r.id !== record.id))
                          } catch (err) {
                            alert(err.message || 'Failed to delete')
                          }
                        }}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline edit form for self-reported */}
                  {editingRecord === record.id && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--slate-50)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <input type="text" value={editForm.offense} onChange={e => setEditForm(p => ({ ...p, offense: e.target.value }))} placeholder="Offense" />
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <input type="number" value={editForm.year} onChange={e => setEditForm(p => ({ ...p, year: e.target.value }))} placeholder="Year" style={{ flex: 1, minWidth: 80 }} />
                        <input type="text" value={editForm.jurisdiction} onChange={e => setEditForm(p => ({ ...p, jurisdiction: e.target.value }))} placeholder="Jurisdiction" style={{ flex: 2, minWidth: 140 }} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <select value={editForm.jurisdictionLevel} onChange={e => setEditForm(p => ({ ...p, jurisdictionLevel: e.target.value }))} style={{ flex: 1 }}>
                          <option value="">Level...</option>
                          <option value="county">County</option>
                          <option value="state">State</option>
                          <option value="federal">Federal</option>
                        </select>
                        <select value={editForm.disposition} onChange={e => setEditForm(p => ({ ...p, disposition: e.target.value }))} style={{ flex: 1 }}>
                          <option value="convicted">Convicted</option>
                          <option value="acquitted">Acquitted</option>
                          <option value="dismissed">Dismissed</option>
                          <option value="expunged">Expunged</option>
                          <option value="pending">Pending</option>
                          <option value="no_contest">No Contest</option>
                          <option value="deferred">Deferred</option>
                          <option value="pardoned">Pardoned</option>
                        </select>
                      </div>
                      <input type="text" value={editForm.sentence} onChange={e => setEditForm(p => ({ ...p, sentence: e.target.value }))} placeholder="Sentence" />
                      <textarea value={editForm.candidateStatement} onChange={e => setEditForm(p => ({ ...p, candidateStatement: e.target.value }))} rows={2} placeholder="Your statement" style={{ resize: 'vertical' }} />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" className="btn btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }} onClick={async () => {
                          try {
                            const updated = await api.put(`/criminal-records/${record.id}`, editForm, true)
                            setCriminalRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updated } : r))
                            setEditingRecord(null)
                          } catch (err) { alert(err.message || 'Failed to update') }
                        }}>Save</button>
                        <button type="button" className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }} onClick={() => setEditingRecord(null)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Statement edit for system-pulled */}
                  {statementEdit === record.id && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--slate-50)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <textarea value={statementText} onChange={e => setStatementText(e.target.value)} rows={3} placeholder="Your statement about this record" style={{ resize: 'vertical' }} />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" className="btn btn-primary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }} onClick={async () => {
                          try {
                            const updated = await api.put(`/criminal-records/${record.id}/statement`, { candidateStatement: statementText }, true)
                            setCriminalRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updated } : r))
                            setStatementEdit(null)
                          } catch (err) { alert(err.message || 'Failed to save statement') }
                        }}>Save Statement</button>
                        <button type="button" className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }} onClick={() => setStatementEdit(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {criminalRecords.length === 0 && !showRecordForm && (
            <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem', margin: 0 }}>No records disclosed.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default CandidateEditPage
