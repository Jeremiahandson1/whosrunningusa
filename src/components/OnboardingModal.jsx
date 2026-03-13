import React, { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'

function OnboardingModal({ pageKey, steps, onClose }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [visible, setVisible] = useState(false)

  const storageKey = `onboarding_seen_${pageKey}`

  useEffect(() => {
    const seen = localStorage.getItem(storageKey)
    if (!seen) {
      setVisible(true)
    }
  }, [storageKey])

  const handleClose = () => {
    setVisible(false)
    if (onClose) onClose()
  }

  const handleDontShowAgain = () => {
    localStorage.setItem(storageKey, 'true')
    handleClose()
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      localStorage.setItem(storageKey, 'true')
      handleClose()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = () => {
    localStorage.setItem(storageKey, 'true')
    handleClose()
  }

  if (!visible || !steps || steps.length === 0) return null

  const step = steps[currentStep]
  const isLast = currentStep === steps.length - 1

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }} onClick={handleClose}>
      <div
        className="card"
        style={{
          maxWidth: 480, width: '100%', padding: 0,
          overflow: 'hidden', position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute', top: '0.75rem', right: '0.75rem',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--slate-400)', padding: '0.25rem', zIndex: 1,
          }}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div style={{ padding: '2.5rem 2rem 1.5rem', textAlign: 'center' }}>
          {step.icon && (
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--navy-600) 0%, var(--navy-800) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem', color: 'white',
            }}>
              {step.icon}
            </div>
          )}
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1.375rem' }}>{step.title}</h3>
          <p style={{ color: 'var(--slate-600)', lineHeight: 1.7, margin: 0, fontSize: '0.9375rem' }}>
            {step.description}
          </p>
        </div>

        {/* Step indicators (dots) */}
        {steps.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0 2rem 1rem' }}>
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                style={{
                  width: idx === currentStep ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  border: 'none',
                  background: idx === currentStep ? 'var(--navy-600)' : 'var(--slate-300)',
                  cursor: 'pointer',
                  transition: 'all 250ms ease',
                  padding: 0,
                }}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{
          padding: '1rem 2rem 1.5rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '0.75rem',
        }}>
          <button
            onClick={handleSkip}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--slate-500)', fontSize: '0.875rem',
              fontFamily: 'var(--font-body)', padding: '0.5rem 0',
            }}
          >
            Skip
          </button>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {currentStep > 0 && (
              <button
                className="btn btn-secondary"
                onClick={handleBack}
                style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={handleNext}
              style={{ padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              {isLast ? 'Get Started' : 'Next'} {!isLast && <ChevronRight size={16} />}
            </button>
          </div>
        </div>

        {/* Don't show again */}
        <div style={{
          borderTop: '1px solid var(--slate-200)',
          padding: '0.75rem 2rem', textAlign: 'center',
        }}>
          <button
            onClick={handleDontShowAgain}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--slate-400)', fontSize: '0.8125rem',
              fontFamily: 'var(--font-body)',
            }}
          >
            Don't show this again
          </button>
        </div>
      </div>
    </div>
  )
}

export default OnboardingModal
