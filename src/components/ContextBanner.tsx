import React from 'react';
import { useAuth } from '../store/AuthContext';
import { ShieldCheck, User, LayoutDashboard, ArrowRight } from 'lucide-react';

export const ContextBanner: React.FC = () => {
  const { user, role, effectiveOwnerId, ownerEmail, restrictedTenantName, restrictedTenantId } = useAuth();
  
  if (!user || !effectiveOwnerId) return null;
  
  const isOwnerMode = effectiveOwnerId === user.uid;
  
  if (isOwnerMode) {
    return (
      <div className="bg-primary-50 border-b border-primary-100 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
          <span className="text-[10px] font-bold text-primary-700 uppercase tracking-widest truncate">
            My Properties
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[9px] font-bold text-primary-400 uppercase tracking-normal">
          <ShieldCheck size={14} />
          Full Access
        </div>
      </div>
    );
  }

  // Guest Mode
  return (
    <div className={`border-b px-4 py-2.5 flex items-center justify-between shadow-sm ${
      restrictedTenantId ? 'bg-slate-900 border-slate-800 text-white' : 'bg-indigo-600 border-indigo-700 text-white'
    }`}>
      <div className="flex items-center gap-3 overflow-hidden">
        <div className={`p-1 rounded ${restrictedTenantId ? 'bg-slate-800' : 'bg-white/20'}`}>
          {restrictedTenantId ? <User size={20} /> : <LayoutDashboard size={20} />}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
              {restrictedTenantId ? 'Tenant Portal' : 'Shared Management'}
            </span>
            <ArrowRight size={20} className="opacity-50" />
          </div>
          <span className="text-xs font-bold truncate">
            {restrictedTenantId 
              ? `Viewing: ${restrictedTenantName || 'Your Details'}`
              : `Managing: ${ownerEmail || 'Shared Portfolio'}`
            }
          </span>
        </div>
      </div>
      
      <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
        restrictedTenantId ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white/10 border-white/20 text-white'
      }`}>
        {restrictedTenantId ? 'Read Only' : 'Shared Access'}
      </div>
    </div>
  );
};
