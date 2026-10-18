import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@tensorflow/tfjs-tflite': path.resolve(process.cwd(), 'node_modules/@tensorflow/tfjs-tflite/dist/tf-tflite.fesm.js'),
    },
  },
})


