import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthScreen from './pages/AuthScreen';
import CitizenMap from './pages/CitizenMap';
import AdminLayout from './pages/AdminLayout';
import Dashboard from './Dashboard';
import './index.css';
import 'leaflet/dist/leaflet.css';

import GlobalNav from './components/GlobalNav';

function App() {
  return (
    <BrowserRouter>
      <GlobalNav />
      <Routes>
        <Route path="/" element={<AuthScreen />} />
        <Route path="/map" element={<CitizenMap />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin/*" element={<AdminLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
