import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { ImpersonationProvider } from './components/Impersonation';
import './index.css';
import { AuthProvider } from './lib/auth';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ImpersonationProvider>
          <App />
        </ImpersonationProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
