import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import '@fontsource/material-symbols-outlined/400.css';
import '@fontsource/material-symbols-rounded/400.css';
import '@fontsource/material-symbols-sharp/400.css';
import '@fontsource/poppins/latin-300.css';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import App from './App';
import './App.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
const AppRouter = window.electronAPI ? HashRouter : BrowserRouter;

root.render(
  <React.StrictMode>
    <AppRouter>
      <App />
    </AppRouter>
  </React.StrictMode>
);
