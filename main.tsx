import React from 'react';
import { Capacitor } from '@capacitor/core';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
if (Capacitor.isNativePlatform()) document.documentElement.classList.add('native-app');
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
