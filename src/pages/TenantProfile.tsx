import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useAppContext } from '../hooks/useAppContext';
import { getPaymentStatus } from '../store/AppLogic';
import { ArrowLeft, CheckCircle2, Clock, AlertCircle, Archive, Printer, RotateCcw, X, Layers, Split, Scissors, Plus, DollarSign, FileText, Calendar } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay, isValid, differenceInMonths, addMonths, subDays, differenceInDays } from 'date-fns';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { PaymentMethod, Payment } from '../types';
import { Button, Card, CardHeader } from '../components/ui';
import { APP_CONFIG } from '../config/constants';
import { useTranslation } from '../i18n';
import { isNativeMobile, getLocalChequeImage, storeLocalChequeImage } from '../utils/localImage';
import { Camera as CameraIcon, Trash2, Database } from 'lucide-react';
import { exportPaymentsToPDF } from '../utils/pdfExport';

export const TenantProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isReadOnly } = useAuth();
  const { t, isRTL, language } = useTranslation();
  const { 
    tenants, 
    properties, 
    fetchTenantPayments, 
    fetchAllTenantPayments,
    ensureYearlyPayments, 
    markAsPaid, 
    updatePaymentNotes, 
    updatePaymentAmount, 
    unmarkAsPaid, 
    bulkMarkAsPaid, 
    bulkUnmarkAsPaid, 
    updateLandlordActivity,
    splitPayment,
    groupPayments,
    loadArchivalYear,
    clearArchivalCache,
    syncCounter
  } = useAppContext();

  const [loading, setLoading] = useState(false);
  const { payments: globalPayments } = useAppContext();
  
  const tenant = tenants.find(t => t.id === id);
  const property = properties.find(p => p.id === tenant?.propertyId);
  const { getTenantsWithStatus } = useAppContext();
  const tenantWithStatus = getTenantsWithStatus(true).find(t => t.id === id);

  useEffect(() => {
    if (tenant) {
      updateLandlordActivity(`${t.tenants.tenant}: ${tenant.name}`);
    }
  }, [tenant, updateLandlordActivity, t.tenants.tenant]);
  
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [extraYearsCount, setExtraYearsCount] = useState(2); 

  const [viewingChequeId, setViewingChequeId] = useState<string | null>(null);
  const [chequeImageBase64, setChequeImageBase64] = useState<string | null>(null);

  // Filter payments from global state for real-time updates
  const tenantPayments = useMemo(() => {
    if (!tenant) return [];
    return globalPayments.filter(p => p.tenantId === tenant.id);
  }, [globalPayments, tenant]);

  // Discover all years with data from the real-time stream
  const yearsWithData = useMemo(() => {
    return Array.from(new Set(tenantPayments.map(p => p.year)));
  }, [tenantPayments]);

  const parsedStart = tenant ? parseISO(tenant.startDate) : null;
  const startYear = (parsedStart && isValid(parsedStart)) ? parsedStart.getFullYear() : currentYear;
  
  const years = useMemo(() => {
    const yearsSet = new Set<number>();
    
    // Always include years from start to current
    for (let y = startYear; y <= currentYear; y++) {
      yearsSet.add(y);
    }
    
    // Auto-discover years that have actual data
    yearsWithData.forEach(y => yearsSet.add(y));
    
    // Add padded years
    for (let i = 1; i <= extraYearsCount; i++) {
      yearsSet.add(currentYear + i);
    }
    
    // Ensure selected year is in there
    yearsSet.add(selectedYear);

    return Array.from(yearsSet).sort((a,b) => a - b);
  }, [yearsWithData, currentYear, extraYearsCount, startYear, selectedYear]);

  // Smart reveal: if the user selects the last year, automatically show the next one
  useEffect(() => {
    if (years.length > 0 && selectedYear === years[years.length - 1]) {
      setExtraYearsCount(prev => prev + 1);
    }
  }, [selectedYear, years]);

  const yearPayments = useMemo(() => {
    if (!tenant) return [];
    return tenantPayments
      .filter(p => p.year === selectedYear)
      .sort((a, b) => {
        const dateA = new Date(a.periodStart).getTime();
        const dateB = new Date(b.periodStart).getTime();
        return (isNaN(dateA) ? 0 : dateA) - (isNaN(dateB) ? 0 : dateB);
      });
  }, [tenantPayments, tenant, selectedYear]);

  const groupedPayments = useMemo(() => {
    const groups: any[] = [];
    let currentGroup: Payment[] = [];
    let lastSeq: number | undefined = undefined;

    yearPayments.forEach((p) => {
      // Group by sequence if it exists, regardless of paid status
      if (p.receiptSequence !== undefined) {
        if (lastSeq === p.receiptSequence) {
          currentGroup.push(p);
        } else {
          if (currentGroup.length > 0) {
            groups.push(currentGroup.length > 1 ? { isGroup: true, payments: [...currentGroup], id: `group_${lastSeq}` } : currentGroup[0]);
          }
          currentGroup = [p];
          lastSeq = p.receiptSequence;
        }
      } else {
        if (currentGroup.length > 0) {
          groups.push(currentGroup.length > 1 ? { isGroup: true, payments: [...currentGroup], id: `group_${lastSeq}` } : currentGroup[0]);
          currentGroup = [];
          lastSeq = undefined;
        }
        groups.push(p);
      }
    });
    if (currentGroup.length > 0) {
      groups.push(currentGroup.length > 1 ? { isGroup: true, payments: [...currentGroup], id: `group_${lastSeq}` } : currentGroup[0]);
    }
    return groups;
  }, [yearPayments]);

  if (!tenant || !property || !tenantWithStatus) {
    return (
      <div className="text-center py-20 bg-neutral-50/50 rounded-classic border border-neutral-100 border-dashed">
        <h2 className="text-xl font-bold text-neutral-900 mb-4 tracking-tight">{t.tenantProfile.tenantNotFound}</h2>
        <Button as={Link} to="/tenants" variant="secondary">
          {t.tenantProfile.returnToTenants}
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3"/> {t.dashboard.paid}</span>;
      case 'due':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"><Clock className="w-3 h-3"/> {t.dashboard.dueSoon}</span>;
      case 'unpaid':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500 border border-neutral-200"><Calendar className="w-3 h-3"/> {t.dashboard.unpaid}</span>;
      case 'late':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertCircle className="w-3 h-3"/> {t.dashboard.late}</span>;
      default:
        return null;
    }
  };

  const formatPeriod = (start: string, end: string) => {
    const s = parseISO(start);
    const e = parseISO(end);
    if (!isValid(s) || !isValid(e)) return t.tenantProfile.invalidPeriod;
    
    // Duration-based 1-month record detection
    const diffInDays = Math.abs(differenceInDays(e, s));
    const isSingleMonthRecord = diffInDays >= 27 && diffInDays <= 32;

    // IF it's exactly one month, show only the month name
    if (isSingleMonthRecord) {
      return format(s, 'MMMM yyyy');
    }
    
    // Otherwise, it's a multi-month block (Quarterly, Consolidated, etc.)
    // Show range regardless of tenant.paymentCycle setting
    
    // For multi-month cycles, show range
    // If end is the 1st of a month, show the previous month as the end of the duration
    const displayEnd = (e.getDate() === 1 && s.getDate() === 1) ? subDays(e, 1) : e;
    return `${format(s, 'MMM yyyy')} - ${format(displayEnd, 'MMM yyyy')}`;
  };

  const formatPaymentMethod = (method?: PaymentMethod) => {
    switch (method) {
      case 'cash': return t.tenantProfile.cash;
      case 'bank_transfer': return t.tenantProfile.bank;
      case 'cheque': return t.tenantProfile.check;
      default: return '-';
    }
  };

  const formatReceiptNumber = (num?: number): string => {
    if (num === undefined || num === null) return '----';
    return num.toString().padStart(4, '0');
  };

  const isHistorical = selectedYear < currentYear;
  const isArchived = tenant.tenantStatus === 'archived';

  const handleMarkAsPaidClick = (paymentId: string) => {
    if (isArchived) return;
    setSelectedPaymentId(paymentId);
    setPaymentModalOpen(true);
  };

  const handleConfirmPayment = async (datePaid: string, method: PaymentMethod, paidAmount: number, notes: string, photo?: string) => {
    if (selectedPayments.length > 0) {
      await bulkMarkAsPaid(selectedPayments, datePaid, method, notes, !!photo);
      if (photo) {
        for (const pid of selectedPayments) {
          await storeLocalChequeImage(pid, photo);
        }
      }
      setSelectedPayments([]);
    } else if (selectedPaymentId) {
      await markAsPaid(selectedPaymentId, datePaid, method, paidAmount, notes, !!photo);
      if (photo) {
        await storeLocalChequeImage(selectedPaymentId, photo);
      }
    }
    setPaymentModalOpen(false);
    setSelectedPaymentId(null);
  };


  const handleViewCheque = async (paymentId: string) => {
    const img = await getLocalChequeImage(paymentId);
    if (img) {
      setChequeImageBase64(img);
      setViewingChequeId(paymentId);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedPayments(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const unpaidIds = yearPayments.filter(p => !p.datePaid).map(p => p.id);
    if (selectedPayments.length === unpaidIds.length) {
      setSelectedPayments([]);
    } else {
      setSelectedPayments(unpaidIds);
    }
  };

  const bulkTotal = yearPayments
    .filter(p => selectedPayments.includes(p.id))
    .reduce((sum, p) => sum + p.amount, 0);

  const handleBulkRevert = async (paymentIds: string[]) => {
    if (window.confirm(`${t.common.confirm}: ${paymentIds.length} ${t.tenantProfile.revertPayment}?`)) {
      await bulkUnmarkAsPaid(paymentIds);
    }
  };

  const cycleLabel = tenant.paymentCycle === 'monthly' ? t.tenants.monthly : 
                     tenant.paymentCycle === '3_months' ? t.tenants.quarterly : 
                     tenant.paymentCycle === '6_months' ? t.tenants.semiannual : t.tenants.yearly;

  return (
    <div className="space-y-4 sm:space-y-6 text-start">
      <div className="grid grid-cols-2 gap-3 md:flex md:items-center md:justify-between sm:gap-6">
        <div className="col-span-2 md:col-span-1 flex items-center gap-3 sm:gap-4">
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => navigate(isArchived ? "/archived-tenants" : "/tenants")}
            className="p-1.5 h-8 w-8 sm:h-10 sm:w-10 rounded-md border-neutral-100"
          >
            <ArrowLeft size={16} className="shrink-0 text-neutral-400 rtl:rotate-180" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-start">
              <h1 className="text-sm sm:text-xl font-bold text-neutral-900 tracking-tight leading-tight">{tenant.name}</h1>
              {isArchived && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-500 border border-neutral-200">
                  <Archive size={10} className="shrink-0" />
                  {t.tenantProfile.archived}
                </span>
              )}
            </div>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5 truncate max-w-[200px] sm:max-w-full">
              {property.name} • <span className="text-primary-600 tabular-nums">{tenant.rentAmount.toLocaleString()} {APP_CONFIG.CURRENCY}</span>
            </p>
          </div>
        </div>

        {/* Leased Progress Card - Miniaturized for mobile grid */}
        {!isArchived && (
          <div className="col-span-2 md:col-span-1 bg-white px-3 py-2 sm:px-5 sm:py-3 rounded-lg border border-neutral-100 shadow-sm flex items-center justify-between gap-4 text-start">
            <div className="flex flex-col items-start">
              <span className="text-[8px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-widest opacity-60 leading-none">{t.tenantProfile.leaseProgress}</span>
              <div className="flex items-center gap-1.5 mt-1 sm:mt-0.5">
                {tenantWithStatus.daysRemaining > 0 ? (
                  <>
                    <Clock size={12} className={`shrink-0 ${tenantWithStatus.daysRemaining <= 3 ? 'text-warning-500' : 'text-success-500'}`} />
                    <span className="text-[10px] sm:text-sm font-bold text-neutral-800 tabular-nums">
                      {t.tenantProfile.daysLeft.replace('{days}', tenantWithStatus.daysRemaining.toString())}
                    </span>
                  </>
                ) : tenantWithStatus.daysRemaining < 0 ? (
                  <>
                    <AlertCircle size={12} className="shrink-0 text-danger-500" />
                    <span className="text-[10px] sm:text-sm font-bold text-danger-600 tabular-nums">
                      {t.tenantProfile.daysOverdue.replace('{days}', Math.abs(tenantWithStatus.daysRemaining).toString())}
                    </span>
                  </>
                ) : (
                  <>
                    <Clock size={12} className="shrink-0 text-warning-600" />
                    <span className="text-[10px] sm:text-sm font-bold text-warning-600">{t.tenantProfile.dueToday}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 max-w-[100px] h-1 bg-neutral-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-700 ${
                  tenantWithStatus.daysRemaining < 0 ? 'bg-danger-500' : 
                  tenantWithStatus.daysRemaining <= 3 ? 'bg-warning-500' : 'bg-success-500'
                }`}
                style={{ 
                  width: tenantWithStatus.daysRemaining < 0 ? '100%' : 
                         tenantWithStatus.daysRemaining > 30 ? '100%' : 
                         `${Math.max(0, (tenantWithStatus.daysRemaining / 30) * 100)}%` 
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Year Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-2 scrollbar-hide">
        {years.map(y => (
          <button 
            key={y} 
            onClick={() => setSelectedYear(y)}
            className={`px-4 py-1.5 rounded text-xs font-bold transition-colors border ${
              selectedYear === y 
                ? 'bg-primary-500 text-white border-primary-500 shadow-sm' 
                : 'bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50 hover:text-neutral-700 hover:border-neutral-300'
            }`}
          >
            {y}
          </button>
        ))}
        <button
          onClick={() => setExtraYearsCount(prev => Math.min(prev + 1, 20))}
          title={t.tenantProfile.addYear}
          disabled={years[years.length - 1] >= currentYear + 20}
          className="flex items-center justify-center w-8 h-8 shrink-0 rounded border border-neutral-200 bg-white text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm ms-2"
        >
          <Plus size={16} />
        </button>
        
        <div className={`flex items-center gap-2 ${isRTL ? 'mr-auto pl-2' : 'ml-auto pr-2'}`}>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => exportPaymentsToPDF(tenantPayments, tenant!, property, t, isRTL)}
            className="h-8 px-2 border-neutral-200 text-neutral-600 hover:text-primary-600"
            title={t.tenantProfile.exportCSV}
          >
            <FileText size={14} className={isRTL ? 'ml-1' : 'mr-1'} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{t.common.export || 'Export'}</span>
          </Button>

          {yearsWithData.length > 1 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                if (window.confirm(t.tenantProfile.clearCache)) {
                  clearArchivalCache();
                  setSelectedYear(currentYear);
                }
              }}
              className="h-8 px-2 border-neutral-200 text-danger-600 hover:bg-danger-50"
              title={t.tenantProfile.clearCache}
            >
              <Database size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Spreadsheet View */}
      <Card padding={false} className="shadow-sm overflow-hidden border-neutral-200">
        <CardHeader className="flex justify-between items-center bg-neutral-50/50">
          <h2 className="text-base font-bold text-neutral-900 uppercase tracking-tight">{t.tenantProfile.paymentsPortfolio} {selectedYear}</h2>
          {isHistorical && <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest bg-neutral-100 px-2 py-0.5 rounded">{t.tenantProfile.historicalArchive}</span>}
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-start">
            <thead className="bg-neutral-50/50">
              <tr>
                <th scope="col" className="px-2 sm:px-6 py-3.5 text-start w-10 sm:w-12">
                  {!isReadOnly && (
                    <input 
                      type="checkbox" 
                      checked={selectedPayments.length > 0 && selectedPayments.length === yearPayments.filter(p => !p.datePaid).length}
                      onChange={toggleSelectAll}
                      disabled={isArchived}
                      className={`w-4 h-4 sm:w-5 sm:h-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 ${isArchived ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    />
                  )}
                </th>
                <th scope="col" className="px-2 sm:px-6 py-3.5 text-start text-[9px] sm:text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{t.tenantProfile.period}</th>
                <th scope="col" className="px-2 sm:px-6 py-3.5 text-start text-[9px] sm:text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{t.tenantProfile.rentAmount}</th>
                <th scope="col" className="px-2 sm:px-6 py-3.5 text-start text-[9px] sm:text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{t.tenants.status}</th>
                <th scope="col" className="px-2 sm:px-6 py-3.5 text-start text-[9px] sm:text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{t.tenantProfile.paymentActions}</th>
                <th scope="col" className="hidden md:table-cell px-6 py-3.5 text-end text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{t.tenantProfile.method}</th>
                <th scope="col" className="hidden lg:table-cell px-6 py-3.5 text-start text-[11px] font-bold text-neutral-500 uppercase tracking-widest">{t.tenantProfile.notes}</th>
                <th scope="col" className="hidden sm:table-cell px-4 py-3.5 text-start text-[9px] sm:text-[11px] font-bold text-neutral-500 uppercase tracking-widest">#</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-neutral-400">
                    <div className="flex items-center justify-center gap-2">
                       <Clock size={20} className="shrink-0 animate-spin opacity-20" />
                       <span className="text-sm font-semibold">{t.tenantProfile.synchronizing}</span>
                    </div>
                  </td>
                </tr>
              ) : groupedPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <p className="text-sm font-medium text-neutral-400">{t.tenantProfile.noPayments}</p>
                      {selectedYear < currentYear - 1 ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={async () => {
                            setLoading(true);
                            await loadArchivalYear(tenant.id, selectedYear);
                            setLoading(false);
                          }}
                          className="border-primary-200 text-primary-600 hover:bg-primary-50"
                        >
                          <RotateCcw size={14} className="mr-2" />
                          {t.tenantProfile.loadHistorical || "Load Records from Cloud"}
                        </Button>
                      ) : selectedYear > currentYear && !isReadOnly && (
                        <Button 
                          variant="primary" 
                          size="sm"
                          onClick={() => ensureYearlyPayments(tenant.id, selectedYear)}
                          className="bg-primary-600 hover:bg-primary-700 shadow-md transform active:scale-95 transition-all"
                        >
                          <Plus size={14} className={isRTL ? 'ml-2' : 'mr-2'} />
                          {t.tenantProfile.generateSchedule || `Generate ${selectedYear} Schedule`}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                groupedPayments.map((item) => {
                  const isGroup = item.isGroup;
                  const payment = isGroup ? item.payments[0] : item;
                  const status = isGroup 
                    ? (payment.datePaid ? 'paid' : getPaymentStatus(payment))
                    : getPaymentStatus(payment);
                  const periodText = isGroup 
                    ? (() => {
                        const start = parseISO(item.payments[0].periodStart);
                        const lastPayment = item.payments[item.payments.length - 1];
                        const end = parseISO(lastPayment.periodEnd);
                        if (!isValid(start) || !isValid(end)) return t.tenantProfile.invalidPeriod;
                        
                        // Use consistent range-end logic (if 1st of month, show previous month)
                        const displayEnd = (end.getDate() === 1) ? subDays(end, 1) : end;
                        
                        if (format(start, 'yyyy-MM') === format(displayEnd, 'yyyy-MM')) {
                          return format(start, 'MMMM yyyy');
                        }
                        return `${format(start, 'MMM yyyy')} - ${format(displayEnd, 'MMM yyyy')}`;
                      })()
                    : formatPeriod(payment.periodStart, payment.periodEnd);
                  
                  const totalRent = isGroup ? item.payments.reduce((s: number, p: Payment) => s + p.amount, 0) : payment.amount;
                  
                  // Calculate actual month count for splitting
                  const mStart = parseISO(payment.periodStart);
                  const mEnd = parseISO(payment.periodEnd);
                  
                  // Use robust duration calculation for splitting
                  const diffDays = Math.abs(differenceInDays(mEnd, mStart));
                  const isSingleMonthRow = diffDays >= 27 && diffDays <= 32;
                  
                  const actualMonths = isGroup ? item.payments.length : (isSingleMonthRow ? 1 : 2); // 2 is enough to trigger split button
                  
                  const isSplittable = !payment.datePaid && actualMonths > 1 && !isArchived && !isReadOnly;

                  return (
                    <tr key={item.id} className={`hover:bg-neutral-50/50 transition-colors ${selectedPayments.includes(payment.id) ? 'bg-primary-50' : ''} ${isGroup ? 'bg-primary-50/30' : ''}`}>
                      <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                        {!isGroup && !payment.datePaid && !isArchived && !isReadOnly ? (
                          <input 
                            type="checkbox" 
                            checked={selectedPayments.includes(payment.id)}
                            onChange={() => toggleSelection(payment.id)}
                            className="w-4 h-4 sm:w-5 sm:h-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                          />
                        ) : (
                          <div className="w-4" />
                        )}
                      </td>
                      <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-sm font-bold text-neutral-900">
                          {isGroup && <Layers size={14} className="shrink-0 text-primary-500" />}
                          <span className="truncate max-w-[80px] sm:max-w-full">{periodText}</span>
                          {isSplittable && (
                            <button
                              onClick={() => {
                                if (window.confirm(t.tenantProfile.splitPrompt || "Split this block into monthly records?")) {
                                  if (isGroup) {
                                    handleBulkRevert(item.payments.map((p: Payment) => p.id));
                                  } else {
                                    splitPayment(payment.id);
                                  }
                                }
                              }}
                              className="p-1 text-primary-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors shrink-0"
                              title={t.tenantProfile.splitMonths || "Split Months"}
                            >
                              <Scissors size={12} className="shrink-0" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                         <div className="flex items-center gap-1">
                          <span className="text-[10px] sm:text-sm font-bold text-neutral-900 tabular-nums">{totalRent.toLocaleString()}</span>
                          <span className="text-[8px] sm:text-[10px] font-bold text-neutral-400 uppercase opacity-60">{APP_CONFIG.CURRENCY}</span>
                          {isGroup && <span className="text-[8px] text-primary-600 font-bold ms-1 bg-primary-100/50 px-1 rounded">x{item.payments.length}</span>}
                        </div>
                      </td>
                      <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          {status === 'paid' ? (
                            <CheckCircle2 size={16} className="text-success-500" />
                          ) : status === 'due' ? (
                            <Clock size={16} className="text-warning-500" />
                          ) : status === 'unpaid' ? (
                            <Calendar size={16} className="text-neutral-400" />
                          ) : (
                            <AlertCircle size={16} className="text-danger-500" />
                          )}
                          {payment.paymentMethod === 'cheque' && (
                            <span className="text-[8px] font-black bg-primary-100 text-primary-700 px-1 rounded tracking-tighter uppercase leading-none mt-1">
                              {t.payments.cheque}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {payment.datePaid ? (
                            <>
                              <button
                                onClick={() => {
                                  const ids = isGroup ? item.payments.map((p: Payment) => p.id).join(',') : payment.id;
                                  navigate(`/receipt/${ids}`);
                                }}
                                className="h-7 w-7 rounded border border-neutral-100 bg-white text-neutral-400 hover:text-neutral-900 shadow-sm flex items-center justify-center transition-all shrink-0"
                                title={t.tenants.printReceipt}
                              >
                                <Printer size={14} className="shrink-0" />
                              </button>

                              {payment.hasChequePhoto && (
                                <button
                                  onClick={() => handleViewCheque(payment.id)}
                                  className="h-7 w-7 rounded border border-primary-200 bg-primary-50 text-primary-600 shadow-sm flex items-center justify-center transition-all shrink-0 hover:bg-primary-100"
                                  title="View Cheque Evidence"
                                >
                                  <CameraIcon size={14} className="shrink-0" />
                                </button>
                              )}
                              
                              {!isReadOnly && !isArchived && (
                                <button
                                  onClick={() => {
                                    if (isGroup) {
                                      handleBulkRevert(item.payments.map((p: Payment) => p.id));
                                    } else {
                                      if (window.confirm(`${t.common.confirm}: ${t.tenantProfile.revokePayment}?`)) {
                                        unmarkAsPaid(payment.id);
                                      }
                                    }
                                  }}
                                  className="h-7 w-7 rounded border border-neutral-100 bg-white text-neutral-400 hover:text-danger-600 shadow-sm flex items-center justify-center transition-all shrink-0"
                                  title={isGroup ? t.tenantProfile.revokeConsolidated : t.tenantProfile.revokePayment}
                                >
                                  <RotateCcw size={14} className="shrink-0" />
                                </button>
                              )}
                            </>
                          ) : (
                            !isArchived ? (
                              <>
                                <button
                                  onClick={() => {
                                    const ids = isGroup ? item.payments.map((p: Payment) => p.id).join(',') : payment.id;
                                    navigate(`/receipt/${ids}`);
                                  }}
                                  className="h-7 w-7 rounded border border-neutral-100 bg-white text-neutral-400 hover:text-neutral-900 shadow-sm flex items-center justify-center transition-all shrink-0"
                                  title={t.tenantProfile.printUnpaid}
                                >
                                  <Printer size={14} className="shrink-0" />
                                </button>
                                {!isReadOnly && (
                                  <button
                                    onClick={() => {
                                      if (isGroup) {
                                        const ids = item.payments.map((p: Payment) => p.id);
                                        setSelectedPayments(ids);
                                        setPaymentModalOpen(true);
                                      } else {
                                        handleMarkAsPaidClick(payment.id);
                                      }
                                    }}
                                    className="h-7 w-7 flex items-center justify-center bg-primary-600 border border-primary-600 text-white rounded hover:bg-primary-700 transition-all shrink-0"
                                    title={t.tenants.pay}
                                  >
                                    <DollarSign size={14} />
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest bg-neutral-50 px-1.5 py-0.5 rounded border border-neutral-100">
                                {isArchived ? 'LOCK' : 'DUE'}
                              </span>
                            )
                          )}
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-end">
                        <span className="text-xs font-bold text-neutral-600 uppercase tracking-tighter tabular-nums">{formatPaymentMethod(payment.paymentMethod)}</span>
                      </td>
                      <td className="hidden lg:table-cell px-6 py-4 w-1/4">
                        {isGroup ? (
                           <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-300">{t.tenantProfile.consolidatedGroup}</span>
                        ) : (
                          <input 
                            type="text" 
                            defaultValue={payment.notes} 
                            placeholder={isArchived || isReadOnly ? "" : t.tenantProfile.addNotes}
                            onBlur={(e) => !isArchived && !isReadOnly && updatePaymentNotes(payment.id, e.target.value)}
                            readOnly={isArchived || isReadOnly}
                            className={`bg-transparent border-b border-transparent text-start ${!isArchived && !isReadOnly ? 'hover:border-neutral-200 focus:border-primary-500' : ''} outline-none w-full py-1 transition-colors text-[11px] font-medium text-neutral-600 placeholder:text-neutral-300`}
                          />
                        )}
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-xs font-bold text-neutral-400 tabular-nums">
                        {payment.receiptSequence ? formatReceiptNumber(payment.receiptSequence) : '----'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <RecordPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedPaymentId(null);
        }}
        onConfirm={handleConfirmPayment}
        tenantName={tenant.name}
        totalAmount={selectedPayments.length > 0 ? bulkTotal : (yearPayments.find(p => p.id === selectedPaymentId)?.amount || tenant.rentAmount)}
        monthCount={selectedPayments.length > 0 ? selectedPayments.length : 1}
      />

      {/* Cheque Viewer Modal */}
      {viewingChequeId && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setViewingChequeId(null)}>
          <div className="bg-white rounded-2xl overflow-hidden w-full max-w-lg shadow-2xl border border-neutral-200" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-100 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-900">{t.payments.chequePhoto}</h3>
              <button onClick={() => setViewingChequeId(null)} className="text-neutral-400 hover:text-neutral-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-2 bg-neutral-100">
              <div className="relative aspect-video w-full overflow-hidden rounded bg-neutral-200">
                <img 
                  src={chequeImageBase64 || ''} 
                  alt="Cheque Evidence" 
                  className="w-full h-full object-contain" 
                />
              </div>
            </div>
            <div className="p-4 bg-neutral-50 text-center">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-relaxed">
                {t.payments.localOnlyNote}
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedPayments.length > 0 && (
        <div className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 z-40 w-[95vw] sm:w-auto">
          <div className="bg-neutral-900 text-white px-3 py-2.5 sm:px-7 sm:py-4 rounded-xl shadow-2xl flex items-center justify-between sm:justify-start gap-4 sm:gap-10 border border-neutral-800">
            <div className="flex flex-col text-start">
              <span className="text-[8px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none mb-1 opacity-60">{t.tenantProfile.totalSelected}</span>
              <span className="text-sm sm:text-xl font-bold leading-none tabular-nums text-white">
                {bulkTotal.toLocaleString()} <span className="text-[10px] sm:text-xs text-neutral-400">{APP_CONFIG.CURRENCY}</span>
              </span>
            </div>
            <div className="hidden sm:block h-8 w-px bg-neutral-800" />
            <div className="flex items-center gap-2 sm:gap-5">
              <span className="hidden sm:inline text-xs font-bold text-neutral-300 uppercase tracking-wider">{selectedPayments.length} {t.tenants.rentCycle}</span>
              <Button 
                onClick={() => setPaymentModalOpen(true)}
                className="bg-primary-500 hover:bg-primary-400 border-none shadow-sm h-8 sm:h-10 px-3 sm:px-6 font-bold uppercase tracking-widest text-[10px] sm:text-xs"
              >
                {t.tenants.pay}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  groupPayments(selectedPayments);
                  setSelectedPayments([]);
                }}
                className="bg-transparent border-neutral-700 text-neutral-300 hover:bg-neutral-800 h-8 sm:h-10 px-2 sm:px-4 font-bold uppercase tracking-widest text-[10px]"
                title={t.tenantProfile.groupSelected || "Group"}
              >
                <Layers size={14} className="sm:mr-2" />
                <span className="hidden sm:inline">{t.tenantProfile.groupSelected || "Group"}</span>
              </Button>
              <button 
                onClick={() => setSelectedPayments([])}
                className="text-neutral-500 hover:text-white transition-colors p-1"
                title={t.tenantProfile.deselectAll}
              >
                <X size={16} className="shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

