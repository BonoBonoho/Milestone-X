import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// [수정] 개발 환경에서는 SW 정리, 프로덕션에서는 알림용 SW 등록
if ('serviceWorker' in navigator) {
  const cleanupSW = async () => {
    try {
      if (document.readyState === 'complete') {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.debug('ServiceWorker cleaned up to prevent fetch errors.');
        }
      }
    } catch (err) {
      console.debug('SW cleanup handled safely:', err);
    }
  };

  const registerSW = async () => {
    try {
      await navigator.serviceWorker.register('/sw.js');
      console.debug('ServiceWorker registered for notifications.');
    } catch (err) {
      console.debug('ServiceWorker registration failed:', err);
    }
  };

  window.addEventListener('load', () => {
    if (import.meta.env.DEV) cleanupSW();
    else registerSW();
  });
}

// [New] Robustly suppress harmless "message channel closed" error from extensions
window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    const errorMessage = error?.message || String(error);
    
    // Chrome Extension related errors (harmless)
    if (errorMessage.includes('message channel closed') || 
        errorMessage.includes('asynchronous response') ||
        errorMessage.includes('Extension context invalidated')) {
        event.preventDefault();
        console.debug('Suppressed benign extension error:', errorMessage);
    }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
