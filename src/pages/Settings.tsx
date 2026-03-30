import React, { useState } from 'react';
import { RefreshCw, WifiOff, Wifi, Globe, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Button } from '../components/ui';
import { useAuth } from '../store/AuthContext';
import { useTranslation, Language } from '../i18n';

export const Settings: React.FC = () => {
  const { t, language, setLanguage, isRTL } = useTranslation();
  const { recalculateAllStats, triggerDataSync } = useAppContext();
  const { isOnline } = useNetworkStatus();
  const { isReadOnly } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      if (recalculateAllStats) await recalculateAllStats();
      if (triggerDataSync) triggerDataSync();
      await new Promise(resolve => setTimeout(resolve, 1500));
      setLastSyncTime(new Date().toLocaleTimeString());
    } finally {
      setIsSyncing(false);
    }
  };

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'ar', label: 'العربية', flag: '🇲🇦' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
  ];

  return (
    <div className={`max-w-2xl mx-auto space-y-8 py-4 ${isRTL ? 'text-right' : 'text-left'}`}>
      <div>
        <h1 className="text-2xl font-black text-neutral-900 tracking-tight uppercase">{t.settings.title}</h1>
        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-1">{t.nav.syncConfig}</p>
      </div>

      {/* Language Selection */}
      <section className="space-y-4">
        <div className={`flex items-center gap-2 border-b border-neutral-100 pb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Globe size={14} className="text-neutral-400" />
          <h2 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t.settings.language}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`flex items-center justify-between px-4 py-3.5 rounded border transition-all ${
                language === lang.code
                  ? 'bg-neutral-900 border-neutral-900 text-white shadow-md scale-[1.02]'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400 active:scale-98'
              } ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-xl">{lang.flag}</span>
                <span className="text-xs font-bold uppercase tracking-wider">{lang.label}</span>
              </div>
              {language === lang.code && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />}
            </button>
          ))}
        </div>
      </section>

      {/* Connectivity & System */}
      <section className="space-y-4">
        <div className={`flex items-center gap-2 border-b border-neutral-100 pb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <ShieldCheck size={14} className="text-neutral-400" />
          <h2 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{t.nav.managementControls}</h2>
        </div>
        
        <div className="bg-white border border-neutral-200 rounded divide-y divide-neutral-100 overflow-hidden">
          {/* Network Status */}
          <div className={`flex items-center justify-between p-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
              </div>
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <p className="text-sm font-bold text-neutral-900 uppercase tracking-tight">
                  {isOnline ? t.settings.connected : t.settings.offline}
                </p>
                <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mt-0.5">
                  {isOnline ? 'System Live & Synchronized' : t.settings.offlineMessage}
                </p>
              </div>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          </div>

          {/* Data Management */}
          {!isReadOnly && (
            <div className={`flex items-center justify-between p-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="w-10 h-10 rounded-lg bg-neutral-50 text-neutral-600 flex items-center justify-center">
                  <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                </div>
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <p className="text-sm font-bold text-neutral-900 uppercase tracking-tight">{t.settings.syncData}</p>
                  <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mt-0.5">
                    {lastSyncTime ? `${t.settings.lastSynced} ${lastSyncTime}` : 'Manual Overwrite Synchronization'}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleSync}
                variant="primary"
                className="h-9 px-5 uppercase tracking-[0.15em] text-[9px] font-black shadow-sm"
                disabled={isSyncing}
              >
                {isSyncing ? t.settings.syncing : t.settings.syncNow}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Footer Branding - Clean & Minimal */}
      <div className="pt-8 border-t border-neutral-100 flex flex-col items-center gap-2">
        <div className="w-8 h-px bg-neutral-200" />
        <p className="text-[9px] font-black text-neutral-300 uppercase tracking-[0.4em]">KRA ASSET MANAGEMENT</p>
      </div>
    </div>
  );
};

