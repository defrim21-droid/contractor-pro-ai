import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Toaster } from 'sonner';

// Import your pages
import Landing from './Landing';
import Dashboard from './Dashboard';
import Settings from './Settings';
import Billing from './Billing';
import UpdatePassword from './UpdatePassword';
import EmailVerification from './components/EmailVerification';

function AppRoutes({ session }) {
  const location = useLocation();
  return (
    <Routes location={location} key={location.pathname}>
        {/* Home Route */}
        <Route 
          path="/" 
          element={!session ? <Landing /> : <Navigate to="/dashboard" replace />} 
        />

        {/* Protected Routes */}
        <Route 
          path="/dashboard" 
          element={session ? <Dashboard session={session} /> : <Navigate to="/" replace />} 
        />
        
        <Route 
          path="/settings" 
          element={session ? <Settings session={session} /> : <Navigate to="/" replace />} 
        />

        {/* Billing Route */}
        <Route 
          path="/billing" 
          element={session ? <Billing session={session} /> : <Navigate to="/" replace />} 
        />

        {/* Password Reset Route */}
        <Route path="/update-password" element={<UpdatePassword />} />

        {/* Email Verification Route */}
        <Route path="/verify-email" element={<EmailVerification />} />

        {/* Catch-all: Redirect any unknown URL to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <AppRoutes session={session} />
    </BrowserRouter>
  );
}