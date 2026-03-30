import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, Receipt, Menu, ShieldCheck, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useTranslation } from '../i18n';

interface MobileNavProps {
  onMenuOpen: () => void;
  unseenInvitationsCount: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({ onMenuOpen, unseenInvitationsCount }) => {
  const { role } = useAuth();
  const { t } = useTranslation();

  return (
    <nav className="lg:hidden fixed left-4 right-4 z-50 px-safe" style={{ bottom: 'max(calc(env(safe-area-inset-bottom) + 0.5rem), 2rem)' }}>
      <div className="bg-neutral-900 border-t border-neutral-800 px-4 py-3 flex items-center justify-between rounded-xl shadow-2xl">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 transition-all ${
              isActive ? 'text-white scale-110' : 'text-neutral-500 hover:text-neutral-300'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <LayoutDashboard size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-tight mt-0.5">{t.nav.stats}</span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/properties"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 transition-all ${
              isActive ? 'text-white scale-110' : 'text-neutral-500 hover:text-neutral-300'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Home size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-tight mt-0.5">{t.nav.asset}</span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/tenants"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 transition-all ${
              isActive ? 'text-white scale-110' : 'text-neutral-500 hover:text-neutral-300'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Users size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-tight mt-0.5">{t.nav.renters}</span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/expenses"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 transition-all ${
              isActive ? 'text-white scale-110' : 'text-neutral-500 hover:text-neutral-300'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Receipt size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-tight mt-0.5">{t.nav.cash}</span>
            </>
          )}
        </NavLink>

        <button
          onClick={onMenuOpen}
          className="flex flex-col items-center gap-1 text-neutral-500 hover:text-neutral-300 transition-all relative"
        >
          <div className="relative">
            <Menu size={22} />
            {unseenInvitationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tight mt-0.5">{t.nav.menu}</span>
        </button>
      </div>
    </nav>
  );
};

