import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CatalogsProvider>
          <OperationSessionProvider>
            <App />
          </OperationSessionProvider>
        </CatalogsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
