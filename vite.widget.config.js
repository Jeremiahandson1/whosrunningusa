import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const widgetName = process.env.WIDGET_NAME
if (!widgetName) throw new Error('WIDGET_NAME env var required')

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'https://whosrunningusa-api.onrender.com/api'),
  },
  build: {
    lib: {
      entry: `widgets/${widgetName}/index.jsx`,
      name: `WhosRunning_${widgetName.replace(/-/g, '_')}`,
      formats: ['iife'],
      fileName: () => `${widgetName}.js`,
    },
    outDir: 'dist/widgets',
    emptyOutDir: false,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
    cssCodeSplit: false,
    minify: 'esbuild',
  },
})
