import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { RoleGuard } from './components/RoleGuard';
import AppLayout from './components/layout/AppLayout';

// Pages
import Login from './pages/Login';
import Forbidden from './pages/Forbidden';
import ChangePassword from './pages/ChangePassword';

// Mentor Pages
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import History from './pages/History';
import Materials from './pages/Materials';
import Upload from './pages/Upload';

// Student Pages
import StudentAttendance from './pages/StudentAttendance';
import StudentUpcoming from './pages/StudentUpcoming';
import StudentMaterials from './pages/StudentMaterials';

// Dev Page
function DevTokens() {
  return (
    <div className="p-12 space-y-12 max-w-4xl mx-auto text-fg-primary">
      <div className="space-y-4">
        <h1 className="text-display-lg">ForgeTrack Design Tokens</h1>
        <p className="text-body-lg text-fg-secondary">Verify that these match the design system.</p>
      </div>
      
      <div className="card space-y-6">
        <h3 className="text-h3">Buttons & Inputs</h3>
        <div className="flex items-center gap-4">
          <button className="btn-primary">Primary Button</button>
          <button className="btn-secondary">Secondary Button</button>
        </div>
        <div>
          <input type="text" className="input" placeholder="Type something..." />
        </div>
      </div>

      <div className="card space-y-6">
        <h3 className="text-h3">Status Pills</h3>
        <div className="flex gap-4">
          <span className="pill pill-success">Present</span>
          <span className="pill pill-danger">Absent</span>
        </div>
      </div>
    </div>
  );
}

// Root redirect based on role
function RootRedirect() {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role === 'mentor') return <Navigate to="/dashboard" replace />;
  if (role === 'student') return <Navigate to="/me/attendance" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/403" element={<Forbidden />} />
        <Route path="/dev-tokens" element={<div className="app-main"><DevTokens /></div>} />
        
        {/* Protected Routes - First time login for students */}
        <Route 
          path="/change-password" 
          element={
            <RoleGuard allowedRoles={['student']}>
              <ChangePassword />
            </RoleGuard>
          } 
        />

        {/* Root Redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* App Shell Routes */}
        <Route element={<AppLayout />}>
          
          {/* Mentor Routes */}
          <Route 
            path="/dashboard" 
            element={
              <RoleGuard allowedRoles={['mentor']}>
                <Dashboard />
              </RoleGuard>
            } 
          />
          <Route 
            path="/attendance" 
            element={
              <RoleGuard allowedRoles={['mentor']}>
                <Attendance />
              </RoleGuard>
            } 
          />
          <Route 
            path="/history" 
            element={
              <RoleGuard allowedRoles={['mentor']}>
                <History />
              </RoleGuard>
            } 
          />
          <Route 
            path="/materials" 
            element={
              <RoleGuard allowedRoles={['mentor']}>
                <Materials />
              </RoleGuard>
            } 
          />
          <Route 
            path="/upload" 
            element={
              <RoleGuard allowedRoles={['mentor']}>
                <Upload />
              </RoleGuard>
            } 
          />

          {/* Student Routes */}
          <Route 
            path="/me/attendance" 
            element={
              <RoleGuard allowedRoles={['student']}>
                <StudentAttendance />
              </RoleGuard>
            } 
          />
          <Route 
            path="/me/upcoming" 
            element={
              <RoleGuard allowedRoles={['student']}>
                <StudentUpcoming />
              </RoleGuard>
            } 
          />
          <Route 
            path="/me/materials" 
            element={
              <RoleGuard allowedRoles={['student']}>
                <StudentMaterials />
              </RoleGuard>
            } 
          />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
