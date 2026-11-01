import React, { useState } from 'react';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';

const SESSION_KEY = 'truthlens-entered-this-session';

export default function App() {
  const [hasEntered, setHasEntered] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === 'yes'
  );

  const enterDashboard = () => {
    sessionStorage.setItem(SESSION_KEY, 'yes');
    setHasEntered(true);
  };

  return hasEntered
    ? <Dashboard />
    : <Landing onEnter={enterDashboard} />;
}
