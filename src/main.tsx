import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { defineCustomElements } from '@ionic/pwa-elements/loader';

// Register Capacitor PWA elements (for camera in browser)
defineCustomElements(window);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
