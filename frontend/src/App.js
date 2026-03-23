import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import BuyerDashboard from './pages/BuyerDashboard';
import AuctionDetails from './pages/AuctionDetails';
import CarrierDashboard from './pages/CarrierDashboard';
import CarrierAuctionDetail from './pages/CarrierAuctionDetail';
import Layout from './components/Layout';
import './index.css';

const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh' }}><div className="spinner" /></div>;
  if (!user) return <Navigate to="/signin" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'buyer' ? '/buyer' : '/carrier'} replace />;
  return children;
};

const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh' }}><div className="spinner" /></div>;
  if (!user) return <Navigate to="/signin" replace />;
  return <Navigate to={user.role === 'buyer' ? '/buyer' : '/carrier'} replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/buyer" element={<ProtectedRoute role="buyer"><Layout><BuyerDashboard /></Layout></ProtectedRoute>} />
      <Route path="/buyer/auction/:id" element={<ProtectedRoute role="buyer"><Layout><AuctionDetails /></Layout></ProtectedRoute>} />
      <Route path="/carrier" element={<ProtectedRoute role="carrier"><Layout><CarrierDashboard /></Layout></ProtectedRoute>} />
      <Route path="/carrier/auction/:id" element={<ProtectedRoute role="carrier"><Layout><CarrierAuctionDetail /></Layout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
