import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless'
    }
  },
  optimizeDeps: {
    exclude: ['runonweb', '@huggingface/transformers', 'onnxruntime-web']
  },
  build: {
    target: 'esnext'
  }
})
