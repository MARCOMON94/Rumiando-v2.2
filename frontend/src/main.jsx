import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { CatalogsProvider } from './context/CatalogsContext';
import { OperationSessionProvider } from './context/OperationSessionContext';
import App from './App';

import './styles/variables.css';
import './styles/layout.css';
import './styles/forms.css';
import './styles/cards.css';
import './styles/chat.css';
import './styles/reader.css';
import './styles/operations.css';
import './styles/login.css';
import './styles/mobile-shell.css';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <AuthProvider>
          <CatalogsProvider>
            <OperationSessionProvider>
              <App />
            </OperationSessionProvider>
          </CatalogsProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>
);