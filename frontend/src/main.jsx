import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CatalogsProvider } from './context/CatalogsContext';
import App from './App';

import './styles/variables.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/forms.css';
import './styles/cards.css';
import './styles/chat.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CatalogsProvider>
          <App />
        </CatalogsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
