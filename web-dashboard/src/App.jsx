import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CitizenMap from './pages/CitizenMap';
import AdminLayout from './pages/AdminLayout';
import ReportIssue from './pages/ReportIssue';
import SOSHome from './pages/SOSHome';
import Dashboard from './Dashboard';
import MessagesScreen from './pages/MessagesScreen';
import CommunityScreen from './pages/CommunityScreen';
import ProfilePage from './pages/ProfilePage';
import AdminRoute from './components/AdminRoute';
import { MeshProvider } from './components/MeshProvider';
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
      <MeshProvider>
        <BrowserRouter>
          <GlobalNav />
          <Routes>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/map" element={<CitizenMap />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/messages" element={<MessagesScreen />} />
            <Route path="/community" element={<CommunityScreen />} />
            <Route path="/admin/*" element={<AdminRoute><AdminLayout /></AdminRoute>} />
            <Route path="/report-issue" element={<ReportIssue />} />
            <Route path="/sos" element={<SOSHome />} />
            <Route path="/profile" element={<AdminRoute><ProfilePage /></AdminRoute>} />
          </Routes>
        </BrowserRouter>
      </MeshProvider>
    </QueryClientProvider>
  );
}

export default App;

