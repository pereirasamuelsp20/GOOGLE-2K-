import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AuthScreen from './pages/AuthScreen';
import CitizenMap from './pages/CitizenMap';
import AdminLayout from './pages/AdminLayout';
import ReportIssue from './pages/ReportIssue';
import SOSHome from './pages/SOSHome';
import Dashboard from './Dashboard';
import './index.css';
import './pages/ReportIssue.css';
import './pages/SOSHome.css';
import 'leaflet/dist/leaflet.css';

import GlobalNav from './components/GlobalNav';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 2 },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <GlobalNav />
        <Routes>
          <Route path="/" element={<AuthScreen />} />
          <Route path="/map" element={<CitizenMap />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin/*" element={<AdminLayout />} />
          <Route path="/report-issue" element={<ReportIssue />} />
          <Route path="/sos" element={<SOSHome />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
