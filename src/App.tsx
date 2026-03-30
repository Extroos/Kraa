import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AppProvider } from './store/AppProvider';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Properties } from './pages/Properties';
import { Tenants } from './pages/Tenants';
import { ArchivedTenants } from './pages/ArchivedTenants';
import { TenantProfile } from './pages/TenantProfile';
import { ReceiptPreview } from './pages/ReceiptPreview';
import { useNotifications } from './hooks/useNotifications';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './store/AuthContext';
import { Expenses } from './pages/Expenses';
import { LandlordManager } from './pages/LandlordManager';
import { TenantPortal } from './pages/TenantPortal';
import { Settings } from './pages/Settings';
import { LanguageProvider, useTranslation } from './i18n';

const NativeAppHooks = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Background status bar configuration
    StatusBar.setStyle({ style: Style.Light }).catch(err => console.warn("StatusBar style failed:", err));
    StatusBar.setOverlaysWebView({ overlay: true }).catch(err => console.warn("StatusBar overlay failed:", err));
    StatusBar.setBackgroundColor({ color: '#ffffff00' }).catch(err => console.warn("StatusBar color failed:", err));
  }, []);

  return null;
};

const AppContent = () => {
  useNotifications();
  const { restrictedTenantId } = useAuth();
  const { dir } = useTranslation();
  
  return (
    <div dir={dir} className="min-h-screen bg-[#fbfcfd]">
      <BrowserRouter>
        <NativeAppHooks />
        <Routes>
          <Route path="/" element={<Layout />}>
            {/* Total Lockdown Mode: If restricted, only show Tenant Portal */}
            {restrictedTenantId ? (
              <>
                <Route index element={<Navigate to="/tenant-portal" replace />} />
                <Route path="tenant-portal" element={<TenantPortal />} />
                <Route path="*" element={<Navigate to="/tenant-portal" replace />} />
              </>
            ) : (
              <>
                <Route index element={<Dashboard />} />
                <Route path="properties" element={<Properties />} />
                <Route path="tenants" element={<Tenants />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="archived-tenants" element={<ArchivedTenants />} />
                <Route path="tenants/:id" element={<TenantProfile />} />
                <Route path="receipt/:paymentId" element={<ReceiptPreview />} />
                <Route path="landlords" element={<LandlordManager />} />
                <Route path="settings" element={<Settings />} />
                <Route path="tenant-portal" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}




