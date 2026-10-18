import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('AgriEdge offline worker registration failed:', error);
    });
  });
  window.addEventListener('online', () => {
    navigator.serviceWorker.controller?.postMessage({ type: 'SYNC_OUTBOX' });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
