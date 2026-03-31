import React from 'react'
import { createRoot } from 'react-dom/client'
import { WIDGET_CSS } from '../shared/widget-styles'
import { trackEvent } from '../shared/api'
import DarkMoneyMeter from './DarkMoneyMeter'

;(function () {
  const script = document.currentScript || document.querySelector('script[src*="dark-money-meter"]')
  if (!script) return
  const config = {
    candidate: script.getAttribute('data-candidate'),
    race: script.getAttribute('data-race'),
    theme: script.getAttribute('data-theme') || 'light',
    whiteLabel: script.getAttribute('data-white-label') === 'true',
    apiKey: script.getAttribute('data-api-key'),
    attributionPosition: script.getAttribute('data-attribution-position') || 'bottom',
  }
  const container = document.createElement('div')
  container.style.width = '100%'
  container.style.minWidth = '350px'
  script.parentNode.insertBefore(container, script.nextSibling)
  const shadow = container.attachShadow({ mode: 'open' })
  const styleEl = document.createElement('style')
  styleEl.textContent = WIDGET_CSS
  shadow.appendChild(styleEl)
  const root = document.createElement('div')
  shadow.appendChild(root)
  createRoot(root).render(<DarkMoneyMeter config={config} />)
  trackEvent('dark-money-meter', 'embed', { candidate: config.candidate, race: config.race }, config.apiKey)
})()
