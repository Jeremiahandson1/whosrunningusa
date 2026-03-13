import React, { useState, useEffect } from 'react'
import { UserPlus, UserCheck, X, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'

function ConnectButton({ userId }) {
  const { user } = useAuth()
  const [status, setStatus] = useState(null) // 'connected', 'pending_sent', 'pending_received', 'none'
  const [requestId, setRequestId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!user || !userId || userId === user.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    api.get(`/connections/status/${userId}`, true)
      .then(data => {
        setStatus(data.status)
        setRequestId(data.requestId || null)
      })
      .catch(() => setStatus('none'))
      .finally(() => setLoading(false))
  }, [user, userId])

  if (!user || !userId || userId === user.id || loading) return null

  const handleConnect = async () => {
    setActionLoading(true)
    try {
      await api.post(`/connections/request/${userId}`, {}, true)
      setStatus('pending_sent')
    } catch (err) {
      alert(err.message || 'Failed to send connection request')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!requestId) return
    setActionLoading(true)
    try {
      await api.put(`/connections/request/${requestId}/accept`, {}, true)
      setStatus('connected')
    } catch (err) {
      alert(err.message || 'Failed to accept request')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDecline = async () => {
    if (!requestId) return
    setActionLoading(true)
    try {
      await api.put(`/connections/request/${requestId}/reject`, {}, true)
      setStatus('none')
      setRequestId(null)
    } catch (err) {
      alert(err.message || 'Failed to decline request')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemove = async () => {
    if (!confirm('Remove this connection?')) return
    setActionLoading(true)
    try {
      await api.delete(`/connections/${userId}`, true)
      setStatus('none')
    } catch (err) {
      alert(err.message || 'Failed to remove connection')
    } finally {
      setActionLoading(false)
    }
  }

  if (status === 'connected') {
    return (
      <button
        className="btn btn-secondary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        onClick={handleRemove}
        disabled={actionLoading}
      >
        <UserCheck size={18} /> Connected
      </button>
    )
  }

  if (status === 'pending_sent') {
    return (
      <button
        className="btn btn-secondary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', opacity: 0.7, cursor: 'default' }}
        disabled
      >
        <Clock size={18} /> Request Sent
      </button>
    )
  }

  if (status === 'pending_received') {
    return (
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={handleAccept}
          disabled={actionLoading}
        >
          <UserCheck size={18} /> Accept
        </button>
        <button
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={handleDecline}
          disabled={actionLoading}
        >
          <X size={18} /> Decline
        </button>
      </div>
    )
  }

  // status === 'none'
  return (
    <button
      className="btn btn-secondary"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
      onClick={handleConnect}
      disabled={actionLoading}
    >
      <UserPlus size={18} /> Connect
    </button>
  )
}

export default ConnectButton
