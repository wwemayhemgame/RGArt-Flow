import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

// Intercept uncaught errors and promise rejections gracefully
window.addEventListener('error', (event) => {
  console.warn('Global intercepted error:', event.message || event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.warn('Global intercepted unhandled promise rejection:', event.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

