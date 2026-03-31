#!/usr/bin/env node

import { execSync } from 'child_process'
import { readdirSync, statSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WIDGETS_DIR = join(__dirname, '..', 'widgets')
const OUT_DIR = join(__dirname, '..', 'dist', 'widgets')

// Ensure output dir exists
mkdirSync(OUT_DIR, { recursive: true })

// Get all widget directories (skip 'shared')
const widgets = readdirSync(WIDGETS_DIR).filter(d =>
  d !== 'shared' && statSync(join(WIDGETS_DIR, d)).isDirectory()
)

console.log(`Building ${widgets.length} widgets...`)

let built = 0, failed = 0
for (const widget of widgets) {
  console.log(`\n[${built + failed + 1}/${widgets.length}] Building: ${widget}`)
  try {
    execSync(`npx vite build --config vite.widget.config.js`, {
      cwd: join(__dirname, '..'),
      env: { ...process.env, WIDGET_NAME: widget },
      stdio: 'inherit',
    })
    built++
    console.log(`  Done: dist/widgets/${widget}.js`)
  } catch (err) {
    failed++
    console.error(`  FAILED: ${err.message}`)
  }
}

console.log(`\nWidget build complete: ${built} built, ${failed} failed`)
if (failed > 0) process.exit(1)
