import React, { useState, useEffect } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { Building2, Users, AlertCircle, CheckCircle2, Clock, Printer, RefreshCw } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { PaymentMethod, TenantWithStatus } from '../types';
import { Button, Card, CardHeader } from '../components/ui';
import { APP_CONFIG } from '../config/constants';
import { TrendingUp, TrendingDown, DollarSign, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { useTranslation } from '../i18n';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isReadOnly, ownerEmail, restrictedTenantId, restrictedTenantName, effectiveOwnerId } = useAuth();
  const { properties, tenants, payments, expenses, getTenantsWithStatus, markAsPaid, globalStats, recalculateAllStats, triggerDataSync, getPropertyFinancials, profitFocusMode, privacyMode, togglePrivacyMode, updateLandlordActivity } = useAppContext();
  
  const isGuestMode = user && effectiveOwnerId !== user.uid;
  const tenantsWithStatus = getTenantsWithStatus();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    updateLandlordActivity('Management Dashboard');
  }, [updateLandlordActivity]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      if (recalculateAllStats) await recalculateAllStats();
      if (triggerDataSync) triggerDataSync();
      // Visual feedback delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setIsSyncing(false);
    }
  };
  // Use aggregated stats if available, fall back to calculation
  // Use aggregated stats if available. If missing, show null to trigger loading states
  // instead of calculating from partial "current year" state which would be incorrect.
  const totalCollected = globalStats?.totalCollected ?? null;
  const totalDue = globalStats?.totalDue ?? null;
  const totalExpenses = globalStats?.totalExpenses ?? null;
  const netProfit = totalCollected !== null ? (totalCollected - (totalExpenses || 0)) : null;

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<{ id: string; tenantName: string } | null>(null);

  const totalProperties = properties.length;
  const totalTenants = tenantsWithStatus.length;
  
  const latePayments = tenantsWithStatus.filter(t => t.status === 'late');
  const dueSoonPayments = tenantsWithStatus.filter(t => t.status === 'due');

  const rentDueThisMonth = tenantsWithStatus
    .filter(t => t.status === 'due' || t.status === 'late')
    .reduce((sum, t) => sum + t.rentAmount, 0);

  const handleMarkAsPaidClick = (paymentId: string, tenantName: string) => {
    setSelectedPayment({ id: paymentId, tenantName });
    setPaymentModalOpen(true);
  };

  const handleConfirmPayment = (datePaid: string, method: PaymentMethod, paidAmount: number, notes: string, photo?: string) => {
    if (selectedPayment) {
      markAsPaid(selectedPayment.id, datePaid, method, paidAmount, notes, !!photo);
    }
    setPaymentModalOpen(false);
    setSelectedPayment(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight leading-none mb-1">
            {isGuestMode ? (ownerEmail ? `${ownerEmail}'s ${t.nav.dashboard}` : t.dashboard.sharedDashboard) : t.dashboard.portfolioOverview}
          </h1>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            {t.dashboard.propertyManagement}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={togglePrivacyMode} 
            variant="secondary" 
            className={`bg-white border-neutral-200 text-neutral-500 hover:text-primary-500 h-10 w-10 p-0 shadow-none transition-colors ${privacyMode ? 'text-primary-500 bg-primary-50 border-primary-200' : ''}`}
            title={privacyMode ? t.dashboard.disablePrivacy : t.dashboard.enablePrivacy}
          >
            {privacyMode ? <Lock size={20} className="shrink-0" /> : <Unlock size={20} className="shrink-0" />}
          </Button>
          {!isReadOnly && (
            <Button 
              onClick={handleSync} 
              variant="secondary" 
              disabled={isSyncing}
              className="bg-white border-neutral-200 text-neutral-600 hover:text-primary-500 h-10 px-5"
            >
              <RefreshCw className={`w-5 h-5 me-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? t.dashboard.syncing : t.dashboard.syncData}
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card className="flex flex-col border-neutral-100 shadow-sm bg-white active:scale-[0.98] transition-all rounded-lg p-3 sm:p-5">
          <div className="flex items-center gap-2 text-danger-500 mb-1.5">
            <AlertCircle size={18} strokeWidth={2.5} />
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest opacity-60">{t.dashboard.overdue}</span>
          </div>
          <span className="text-xl sm:text-3xl font-bold text-neutral-900 tabular-nums leading-none tracking-tight">
            {latePayments.length}
          </span>
        </Card>
 
        <Card className={`flex flex-col border-neutral-900 shadow-sm transition-colors rounded-lg p-3 sm:p-5 ${netProfit === null ? 'bg-neutral-50' : 'bg-neutral-900'} text-white`}>
          <div className="flex items-center gap-2 text-white/30 mb-1.5">
            <DollarSign size={18} strokeWidth={2.5} />
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">{t.dashboard.netCapital}</span>
          </div>
          <div className="flex items-baseline gap-1 leading-none">
            <span className="text-xl sm:text-3xl font-bold tabular-nums tracking-tighter">
              {netProfit === null ? '...' : (privacyMode ? '*****' : netProfit.toLocaleString())}
            </span>
            {netProfit !== null && !privacyMode && <span className="text-[9px] font-bold text-white/20">{APP_CONFIG.CURRENCY}</span>}
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-4">
        <div className="w-full">
          <Card padding={false} className="shadow-sm border-neutral-100 overflow-hidden rounded-lg bg-white">
            <div className="px-4 pr-5 py-4 border-b border-neutral-50 bg-neutral-50/20 flex justify-between items-center">
              <div>
                <h2 className="text-[11px] font-bold text-neutral-900 uppercase tracking-widest">{t.dashboard.rentActivity}</h2>
                <p className="text-[9px] text-neutral-400 font-medium uppercase tracking-widest mt-0.5">{t.dashboard.pendingCollection}</p>
              </div>
              <span className="text-[9px] font-bold text-primary-600 uppercase tracking-widest bg-primary-50 px-2.5 py-1 rounded border border-primary-100">
                {privacyMode ? '*****' : (rentDueThisMonth || 0).toLocaleString()} {APP_CONFIG.CURRENCY}
              </span>
            </div>
            
                <div className="divide-y divide-neutral-50">
                  {latePayments.length === 0 && dueSoonPayments.length === 0 ? (
                    <div className="p-8 text-center text-neutral-400">
                      <p className="text-sm font-bold uppercase tracking-widest leading-relaxed">{t.dashboard.noPaymentsDue}</p>
                      <p className="text-[10px] font-medium mt-1">{t.dashboard.allCaughtUp}</p>
                    </div>
                  ) : (
                    [...latePayments, ...dueSoonPayments]
                      .sort((a, b) => a.daysRemaining - b.daysRemaining)
                      .map((tenant) => (
                        <div key={tenant.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/30 transition-colors group">
                          <div className="flex items-start gap-3">
                            <div className={`mt-1.5 w-2 h-2 rounded-full ring-4 ring-neutral-50 shrink-0 ${tenant.status === 'late' ? 'bg-danger-500' : 'bg-warning-400'}`} />
                            <div className="text-start">
                              <h3 className="font-bold text-neutral-900 text-xs tracking-tight leading-none mb-1 group-hover:text-primary-600 transition-colors uppercase">{tenant.name}</h3>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-[9px] text-neutral-400 font-medium uppercase tracking-wider truncate max-w-[100px]">{tenant.property?.name}</p>
                                <span className="text-[9px] text-neutral-200">•</span>
                                <span className={`text-[9px] font-bold uppercase tracking-wide ${tenant.status === 'late' ? 'text-danger-500' : 'text-neutral-500'}`}>
                                  {tenant.daysRemaining < 0 ? `${Math.abs(tenant.daysRemaining)} ${t.tenants.daysLate}` : `${t.tenants.dueIn} ${tenant.daysRemaining} ${t.tenants.days}`}
                                </span>
                              </div>
                            </div>
                          </div>
                          {tenant.nextPaymentId && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => navigate(`/receipt/${tenant.nextPaymentId}`)}
                                className="bg-white border-neutral-200 text-[9px] font-bold uppercase tracking-wider h-8 px-3 rounded shadow-sm"
                              >
                                {t.tenantProfile.generateReceipt}
                              </Button>
                              {!isReadOnly && (
                                <Button
                                  size="sm"
                                  onClick={() => handleMarkAsPaidClick(tenant.nextPaymentId!, tenant.name)}
                                  className="bg-primary-600 text-white text-[9px] font-bold uppercase tracking-wider h-8 px-4 rounded shadow-md border-none hover:bg-primary-700 transition-colors"
                                >
                                  {t.dashboard.payNow}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                  )}
                </div>
              </Card>
            </div>
          </div>

      {selectedPayment && (
        <RecordPaymentModal
          isOpen={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedPayment(null);
          }}
          onConfirm={handleConfirmPayment}
          tenantName={selectedPayment.tenantName}
          privacyMode={privacyMode}
        />
      )}
    </div>
  );
};


