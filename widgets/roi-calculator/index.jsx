import React from 'react'
import { createRoot } from 'react-dom/client'
import { WIDGET_CSS } from '../shared/widget-styles'
import { trackEvent } from '../shared/api'
import ROICalculator from './ROICalculator'

;(function () {
  const script = document.currentScript || document.querySelector('script[src*="roi-calculator"]')
  if (!script) return

  const config = {
    theme: script.getAttribute('data-theme') || 'light',
    whiteLabel: script.getAttribute('data-white-label') === 'true',
    apiKey: script.getAttribute('data-api-key'),
    attributionPosition: script.getAttribute('data-attribution-position') || 'bottom',
    entity: script.getAttribute('data-entity'),
    cycle: script.getAttribute('data-cycle'),
  }

  const container = document.createElement('div')
  container.style.width = '100%'
  script.parentNode.insertBefore(container, script.nextSibling)

  const shadow = container.attachShadow({ mode: 'open' })
  const styleEl = document.createElement('style')
  styleEl.textContent = WIDGET_CSS
  shadow.appendChild(styleEl)

  const root = document.createElement('div')
  shadow.appendChild(root)

  createRoot(root).render(<ROICalculator config={config} />)
  trackEvent('roi-calculator', 'embed', {}, config.apiKey)
})()
