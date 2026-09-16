import React from 'react';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider } from './contexts/AuthContext';
import { AppRoutes } from './routes/AppRoutes';

export function App() {
  // Use HashRouter when running inside Electron (detected via preload) OR
  // when loaded via file:// protocol (failsafe if preload fails to inject window.electronAPI)
  const isElectron =
    typeof window !== 'undefined' &&
    (!!window.electronAPI?.isElectron || window.location.protocol === 'file:');
  const RouterComponent = isElectron ? HashRouter : BrowserRouter;

  return (
    <RouterComponent>
      <NotificationProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </NotificationProvider>
    </RouterComponent>
  );
}

export default App;
