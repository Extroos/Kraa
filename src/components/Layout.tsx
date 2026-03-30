import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, LayoutDashboard, History, LogOut, User, Search, Loader2, ArrowLeft, Receipt, ShieldCheck, ChevronDown, ArrowRightLeft, X, WifiOff, Wifi, Settings, Cloud, CloudOff } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { useAuth } from '../store/AuthContext';
import { useAppContext } from '../hooks/useAppContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Button } from './ui';
import { ConfirmModal } from './ConfirmModal';
import { ContextBanner } from './ContextBanner';
import { MobileNav } from './MobileNav';
import { useTranslation } from '../i18n';

export const Layout: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout, role, accessAccounts, switchActiveAccount, effectiveOwnerId, ownerEmail, restrictedTenantName, restrictedTenantId } = useAuth();
  const { tenants, properties } = useAppContext();
  const { isOnline, wasOffline } = useNetworkStatus();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const isGuestMode = role === 'landlord' && effectiveOwnerId !== user?.uid;

  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const matches: { id: string; name: string; type: 'tenant' | 'property'; link: string }[] = [];
    
    tenants.forEach(t => {
      if (t.name.toLowerCase().includes(q)) {
        matches.push({ id: t.id, name: t.name, type: 'tenant', link: `/tenants/${t.id}` });
      }
    });
    
    properties.forEach(p => {
      if (p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)) {
        matches.push({ id: p.id, name: p.name, type: 'property', link: '/properties' });
      }
    });
    
    return matches.slice(0, 5);
  }, [searchQuery, tenants, properties]);

  const navigate = useNavigate();
  const location = useLocation();
  const isReceiptPage = location.pathname.includes('/receipt/');

  // Handle Hierarchical Back Button (Native Android)
  React.useEffect(() => {
    const handleBackButton = async () => {
      if (isMobileMenuOpen) {
        // Step 1: Close the side menu if it's open
        setIsMobileMenuOpen(false);
      } else if (location.pathname !== '/' && location.pathname !== '/tenant-portal') {
        // Step 2: Navigate back to Dashboard if we're on a sub-page
        navigate('/');
      } else {
        // Step 3: Exit the app if we're at the Dashboard
        await CapacitorApp.exitApp();
      }
    };

    const listener = CapacitorApp.addListener('backButton', handleBackButton);

    return () => {
      listener.then(l => l.remove());
    };
  }, [isMobileMenuOpen, location.pathname, navigate]);

  return (
    <div className={`flex flex-col min-h-screen bg-neutral-50 print:bg-white font-sans ${isGuestMode ? 'mode-guest' : ''}`}>
      {/* Mobile Floating Top Controls (Hidden on Receipt) */}
      {!isMobileMenuOpen && !isReceiptPage && (
        <div 
          className="lg:hidden fixed top-0 left-0 right-0 z-60 pointer-events-none p-4 flex items-start justify-between gap-4"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
        >
          {/* Home on Left, Profile on Right, Banner in center */}
          <div className="pointer-events-auto">
            <NavLink 
              to="/" 
              className="w-12 h-12 bg-white/80 backdrop-blur-md border border-neutral-200/50 rounded-2xl flex items-center justify-center shadow-lg shadow-neutral-900/5 active:scale-95 transition-all text-neutral-900"
            >
              <Home size={24} />
            </NavLink>
          </div>

          {/* Centered Network Alerts */}
          <div className="flex-1 flex flex-col items-center gap-1.5 pointer-events-none">
            {!isOnline && (
              <div className="px-3 py-1.5 bg-amber-500/90 backdrop-blur-md text-white rounded-full shadow-lg flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                <CloudOff size={12} className="shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-tighter whitespace-nowrap">{t.settings.offlineMessage}</span>
              </div>
            )}
            {isOnline && wasOffline && (
              <div className="px-3 py-1.5 bg-emerald-500/90 backdrop-blur-md text-white rounded-full shadow-lg flex items-center gap-2 animate-pulse transition-all">
                <Wifi size={12} className="shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-tighter whitespace-nowrap">{t.settings.syncing}</span>
              </div>
            )}
          </div>

          {/* Right Island: Account & Session */}
          <div className="flex items-center gap-2 pointer-events-auto bg-white/80 backdrop-blur-md border border-neutral-200/50 p-1.5 rounded-2xl shadow-lg shadow-neutral-900/5">
            <div className="h-9 px-2 bg-neutral-100 rounded-xl flex items-center gap-2 border border-neutral-200/50">
               {isOnline ? (
                 <Cloud size={14} className="text-emerald-500" />
               ) : (
                 <CloudOff size={14} className="text-amber-500 animate-pulse" />
               )}
               <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 truncate max-w-[80px]">
                 {effectiveOwnerId ? (accessAccounts.find(a => a.ownerId === effectiveOwnerId)?.ownerEmail?.split('@')[0] || 'Personal') : 'Personal'}
               </span>
            </div>
            <button 
              onClick={() => logout()}
              className="w-9 h-9 bg-danger-50 text-danger-600 rounded-xl flex items-center justify-center hover:bg-danger-100 active:scale-95 transition-all"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      )}

      {!isReceiptPage && (
        <header className="hidden lg:block bg-white border-b border-neutral-200 sticky top-0 z-50 print:hidden shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-16 flex items-center justify-between gap-4 pt-safe sm:pt-0">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center shadow-sm">
               <Home size={24} className="shrink-0 text-white" />
            </div>
            <span className="font-bold text-lg text-neutral-900 tracking-tight hidden md:inline">{t.nav.rentManager}</span>
          </div>

          {!isOnline && (
            <div className="hidden lg:flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200 text-[10px] font-black uppercase tracking-widest animate-pulse">
              <CloudOff size={14} />
              <span>{t.settings.offlineMessage}</span>
            </div>
          )}

          {/* Global Search Bar (Hidden in Restricted Mode) */}
          {!restrictedTenantId && (
            <div className="relative flex-1 max-w-md hidden sm:block">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 shrink-0 text-neutral-400" />
                <input
                  type="text"
                  placeholder={t.common.search}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  className="w-full pl-9 pr-4 py-2 bg-neutral-50 border-neutral-200 border rounded-lg text-sm outline-none focus:bg-white focus:border-neutral-400 transition-all placeholder:text-neutral-400 font-medium"
                />
              </div>

              {isSearchOpen && searchResults.length > 0 && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsSearchOpen(false)}
                  />
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-neutral-200 overflow-hidden z-50">
                    {searchResults.map((result) => (
                      <NavLink
                        key={`${result.type}-${result.id}`}
                        to={result.link}
                        onClick={() => {
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors border-b last:border-0 border-neutral-100"
                      >
                        <div>
                          <div className="text-sm font-semibold text-neutral-900">{result.name}</div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{result.type === 'tenant' ? t.nav.renters : t.nav.asset}</div>
                        </div>
                        <ArrowLeft className="w-4 h-4 text-neutral-300 rtl:rotate-0 ltr:rotate-180" />
                      </NavLink>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Pending Invitation Notification */}
            {!isGuestMode && useAuth().unseenInvitations.length > 0 && (
              <button 
                onClick={() => switchActiveAccount(useAuth().unseenInvitations[0].ownerId)}
                className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm animate-pulse"
              >
                <ShieldCheck size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">{t.nav.switchPortfolio}</span>
              </button>
            )}

            {/* User Identity Section (Classic Style) */}
            <div className="hidden sm:flex flex-col text-right">
                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">{t.nav.signOut}</span>
                <span className="text-[11px] font-bold text-neutral-700 leading-none">{user?.email}</span>
            </div>

            <div className="h-6 w-px bg-neutral-200 hidden sm:block" />

            {/* Session Switcher Pill */}
            <div className="relative">
              <button
                onClick={() => setIsSessionMenuOpen(!isSessionMenuOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all shadow-sm ${
                  isGuestMode 
                    ? 'bg-amber-50 border-amber-200 text-amber-700' 
                    : 'bg-neutral-50 border-neutral-200 text-neutral-700'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${isGuestMode ? 'bg-amber-500' : 'bg-success-500'}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider hidden xs:inline">
                  {isGuestMode ? t.dashboard.sharedDashboard : 'Admin'}
                </span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isSessionMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isSessionMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsSessionMenuOpen(false)} />
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-neutral-200 overflow-hidden z-50">
                    <div className="p-3 bg-neutral-50 border-b border-neutral-200">
                       <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1">{t.nav.historyRecords}</div>
                       <div className="text-xs font-bold text-neutral-800 truncate">
                         {isGuestMode ? `${t.dashboard.sharedDashboard}: ${ownerEmail || 'Shared Properties'}` : 'Owner Account'}
                       </div>
                    </div>
                    
                    <div className="p-2 space-y-1">
                      {!isGuestMode && accessAccounts.length > 0 && (
                        <div className="pt-2">
                           <div className="px-3 py-1 text-[9px] font-bold text-neutral-400 uppercase tracking-widest">{t.nav.switchPortfolio}</div>
                           {accessAccounts.map(acc => (
                             <button
                                key={acc.id}
                                onClick={() => {
                                  switchActiveAccount(acc.ownerId);
                                  setIsSessionMenuOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded text-neutral-700 hover:bg-neutral-50 transition-colors text-left rtl:text-right"
                             >
                               <ShieldCheck size={16} className="text-neutral-400" />
                               <span className="text-xs font-semibold truncate">{acc.ownerEmail || 'Shared Properties'}</span>
                             </button>
                           ))}
                        </div>
                      )}

                      {isGuestMode && (
                        <button
                          onClick={() => {
                            setIsSessionMenuOpen(false);
                            setShowQuitConfirm(true);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-danger-600 hover:bg-danger-50 transition-colors text-left rtl:text-right"
                        >
                          <LogOut size={16} />
                          <span className="text-xs font-bold uppercase tracking-wider">{t.common.quitGuestSession}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <Button 
               variant="secondary" 
               size="sm" 
               onClick={logout}
               className="border-neutral-200 text-neutral-500 hover:text-danger-600 h-10 w-10 p-0 flex items-center justify-center rounded-xl shadow-sm"
               title={t.nav.signOut}
            >
              <LogOut size={24} className="shrink-0" />
            </Button>
          </div>
        </div>
        </header>
      )}

      {/* Quit Confirmation Modal */}
      <ConfirmModal 
        isOpen={showQuitConfirm}
        title={t.common.quitGuestSession}
        message={t.common.quitGuestMessage}
        confirmText={t.common.yesQuit}
        cancelText={t.common.stayGuest}
        isDestructive={true}
        onConfirm={async () => {
          if (user) switchActiveAccount(user.uid);
          setShowQuitConfirm(false);
        }}
        onCancel={() => setShowQuitConfirm(false)}
      />

      <main className={`flex-1 w-full mx-auto print:p-0 print:pb-0 p-4 sm:p-6 ${
        isReceiptPage 
          ? 'max-w-full pb-0 pt-0' 
          : 'max-w-7xl pb-24 pt-[calc(5rem+env(safe-area-inset-top))] lg:pt-8'
      }`}>
        {isGuestMode && <ContextBanner />}
        <div className={isGuestMode && !isReceiptPage ? 'p-4 sm:p-6 lg:p-8' : ''}>
          <Outlet />
        </div>
      </main>

      {/* Desktop Sidebar (Hidden in Restricted Mode or Receipt) */}
      {!restrictedTenantId && !isReceiptPage && (
        <nav className="hidden lg:flex fixed top-16 left-0 w-64 h-[calc(100vh-4rem)] bg-white border-r border-neutral-200 flex-col py-6 print:hidden rtl:left-auto rtl:right-0 rtl:border-l rtl:border-r-0">
          <div className="px-4 space-y-1">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded transition-colors group ${
                  isActive 
                    ? 'bg-neutral-100 text-neutral-900 font-bold shadow-sm' 
                    : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                }`
              }
            >
              <LayoutDashboard size={20} className="shrink-0" />
              <span className="text-sm font-semibold">{t.nav.dashboard}</span>
            </NavLink>
            <NavLink
              to="/properties"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded transition-colors group ${
                  isActive 
                    ? 'bg-neutral-100 text-neutral-900 font-bold shadow-sm' 
                    : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                }`
              }
            >
              <Home size={20} className="shrink-0" />
              <span className="text-sm font-semibold">{t.nav.properties}</span>
            </NavLink>
            <NavLink
              to="/tenants"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded transition-colors group ${
                  isActive 
                    ? 'bg-neutral-100 text-neutral-900 font-bold shadow-sm' 
                    : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                }`
              }
            >
              <Users size={20} className="shrink-0" />
              <span className="text-sm font-semibold">{t.nav.tenants}</span>
            </NavLink>
            <NavLink
              to="/expenses"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded transition-colors group ${
                  isActive 
                    ? 'bg-neutral-100 text-neutral-900 font-bold shadow-sm' 
                    : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                }`
              }
            >
              <Receipt size={20} className="shrink-0" />
              <span className="text-sm font-semibold">{t.nav.expenses}</span>
            </NavLink>
            
            <NavLink
              to="/archived-tenants"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded transition-colors group ${
                  isActive 
                    ? 'bg-neutral-100 text-neutral-900 font-bold shadow-sm' 
                    : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                }`
              }
            >
              <History size={20} className="shrink-0" />
              <span className="text-sm font-semibold">{t.nav.archive}</span>
            </NavLink>

            {role === 'owner' && (
              <NavLink
                to="/landlords"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded transition-colors group ${
                    isActive 
                      ? 'bg-neutral-100 text-neutral-900 font-bold shadow-sm' 
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                  }`
                }
              >
                <ShieldCheck size={20} className="shrink-0" />
                <span className="text-sm font-semibold">{t.nav.landlords}</span>
              </NavLink>
            )}

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded transition-colors group ${
                  isActive 
                    ? 'bg-neutral-100 text-neutral-900 font-bold shadow-sm' 
                    : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                }`
              }
            >
              <Settings size={20} className="shrink-0" />
              <span className="text-sm font-semibold">{t.nav.settings}</span>
            </NavLink>

            {/* Account Switcher for Guests */}
            {(accessAccounts.length > 1 || (role === 'owner' && accessAccounts.length > 0)) && (
              <div className="pt-6 mt-6 border-t border-neutral-100">
                <h3 className="px-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ArrowRightLeft size={12} />
                  {t.nav.switchAccounts}
                </h3>
                <div className="px-2 space-y-1">
                  {/* Option to switch back to own account if an owner is acting as guest */}
                  {user && (
                    <button
                      onClick={() => switchActiveAccount(user.uid)}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded text-sm font-semibold transition-all ${
                        effectiveOwnerId === user.uid 
                          ? 'bg-neutral-50 text-neutral-800 border border-neutral-200' 
                          : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${effectiveOwnerId === user.uid ? 'bg-success-500' : 'bg-neutral-300'}`} />
                      <span className="truncate">{t.nav.personalPortfolio}</span>
                    </button>
                  )}
                  
                  {accessAccounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => switchActiveAccount(acc.ownerId)}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded text-sm font-semibold transition-all ${
                        effectiveOwnerId === acc.ownerId 
                          ? 'bg-amber-50 text-amber-800 border border-amber-100' 
                          : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${effectiveOwnerId === acc.ownerId ? 'bg-amber-500' : 'bg-neutral-300'}`} />
                      <span className="truncate">{acc.ownerEmail || 'Shared Properties'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>
      )}
      {/* Mobile Navigation Bar (hidden on Receipt) */}
      {!restrictedTenantId && !isReceiptPage && (
        <MobileNav 
          onMenuOpen={() => setIsMobileMenuOpen(true)} 
          unseenInvitationsCount={useAuth().unseenInvitations.length} 
        />
      )}

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-neutral-900/40" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute top-0 bottom-0 left-0 w-80 bg-white shadow-xl overflow-hidden flex flex-col rtl:left-auto rtl:right-0">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between pt-safe">
              <div className="pt-2">
                <h3 className="font-black text-xs uppercase tracking-widest text-neutral-400">{t.nav.managementControls}</h3>
                <p className="text-xs font-bold text-neutral-900 mt-1">{t.nav.rentManager}</p>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-900 mt-2"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-safe">
              <NavLink
                to="/archived-tenants"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-4 p-4 rounded-2xl bg-neutral-50 border border-neutral-100 group active:scale-[0.98] transition-all rtl:flex-row-reverse"
              >
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-neutral-400 group-hover:text-primary-600 shrink-0">
                  <History size={20} />
                </div>
                <div className="flex-1 min-w-0 rtl:text-right">
                  <span className="block text-sm font-bold text-neutral-800">{t.nav.archive}</span>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{t.nav.historyRecords}</span>
                </div>
              </NavLink>

              {role === 'owner' && (
                <NavLink
                  to="/landlords"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-neutral-50 border border-neutral-100 group active:scale-[0.98] transition-all rtl:flex-row-reverse"
                >
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-neutral-500 group-hover:text-amber-600 shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="flex-1 min-w-0 rtl:text-right">
                    <span className="block text-sm font-bold text-neutral-800">{t.nav.landlords}</span>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{t.nav.teamSecurity}</span>
                  </div>
                </NavLink>
              )}

              <NavLink
                to="/settings"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-4 p-4 rounded-2xl bg-neutral-50 border border-neutral-100 group active:scale-[0.98] transition-all rtl:flex-row-reverse"
              >
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-neutral-400 group-hover:text-primary-600 shrink-0">
                  <Settings size={20} />
                </div>
                <div className="flex-1 min-w-0 rtl:text-right">
                  <span className="block text-sm font-bold text-neutral-800">{t.nav.settings}</span>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{t.nav.syncConfig}</span>
                </div>
              </NavLink>

              {/* Mobile Account Switcher */}
              {(accessAccounts.length > 0 || isGuestMode) && (
                <div className="pt-4 mt-2 border-t border-neutral-100">
                  <h3 className="px-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4 rtl:text-right">{t.nav.switchPortfolio}</h3>
                  <div className="space-y-2 font-rtl">
                    <button
                      onClick={() => {
                        switchActiveAccount(user?.uid || '');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all rtl:flex-row-reverse ${
                        !isGuestMode ? 'bg-primary-50 border-2 border-primary-200 text-primary-900' : 'bg-neutral-50 border border-neutral-100 text-neutral-600'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full shrink-0 ${!isGuestMode ? 'bg-primary-500' : 'bg-neutral-300'}`} />
                      <span className="text-sm font-bold flex-1 rtl:text-right">{t.nav.personalPortfolio}</span>
                    </button>

                    {accessAccounts.map(acc => (
                      <button
                        key={acc.id}
                        onClick={() => {
                          switchActiveAccount(acc.ownerId);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all rtl:flex-row-reverse ${
                          effectiveOwnerId === acc.ownerId ? 'bg-amber-50 border-2 border-amber-200 text-amber-900' : 'bg-neutral-50 border border-neutral-100 text-neutral-600'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full shrink-0 ${effectiveOwnerId === acc.ownerId ? 'bg-amber-500' : 'bg-neutral-300'}`} />
                        <span className="text-sm font-bold flex-1 truncate rtl:text-right">{acc.ownerEmail || 'Shared Properties'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-6 mb-4">
                <button
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-danger-50 text-danger-600 transition-all font-black text-xs uppercase tracking-widest"
                >
                  <LogOut size={20} />
                  {t.nav.signOut}
                </button>
              </div>
            </div>

            <div className="p-6 bg-neutral-50 border-t border-neutral-100 text-center text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em]">
              {t.nav.rentManager}
            </div>
          </div>
        </div>
      )}

      {/* Adjust main content margin for desktop sidebar */}
      <style>{`
        @media (min-width: 1024px) {
          main {
            margin-left: ${restrictedTenantId || isReceiptPage ? '0' : '16rem'};
            max-width: ${restrictedTenantId || isReceiptPage ? '100%' : 'calc(100% - 16rem)'};
          }
          [dir="rtl"] main {
            margin-left: 0;
            margin-right: ${restrictedTenantId || isReceiptPage ? '0' : '16rem'};
          }
        }
        @media print {
          main {
            margin-left: 0 !important;
            margin-right: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};
