import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { OceanState } from './ocean/OceanState';

if (typeof window !== 'undefined') {
  (window as unknown as { OceanState: typeof OceanState }).OceanState = OceanState;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
