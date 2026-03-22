import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BuyerDashboard from './pages/BuyerDashboard';
import CarrierDashboard from './pages/CarrierDashboard';
import RFQDetailPage from './pages/RFQDetailPage';

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ textAlign: 'center', padding: '80px', color: 'var(--muted)' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'buyer' ? '/buyer' : '/carrier'} replace />;
  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'buyer' ? '/buyer' : '/carrier'} replace />;
}

function Layout({ children }) {
  const { user } = useAuth();
  return (
    <>
      {user && <Navbar />}
      {children}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/buyer" element={
              <ProtectedRoute role="buyer"><BuyerDashboard /></ProtectedRoute>
            } />
            <Route path="/carrier" element={
              <ProtectedRoute role="carrier"><CarrierDashboard /></ProtectedRoute>
            } />
            <Route path="/rfq/:id" element={
              <ProtectedRoute><RFQDetailPage /></ProtectedRoute>
            } />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
