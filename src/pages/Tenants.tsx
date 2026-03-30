import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useAppContext } from '../hooks/useAppContext';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Calendar, 
  Printer, 
  History,
  MapPin,
  Download,
  Layers,
  AlertCircle,
  Clock,
  CheckCircle2,
  DollarSign,
  X
} from 'lucide-react';
import { Tenant, PaymentCycle, PaymentMethod, TenantWithStatus } from '../types';
import { format, parseISO, isValid } from 'date-fns';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { TenantFormModal } from '../components/TenantFormModal';
import { Button, Input, Card } from '../components/ui';
import { APP_CONFIG } from '../config/constants';
import { QuickBulkPayModal } from '../components/QuickBulkPayModal';
import { useTranslation } from '../i18n';

import { getCycleMonths } from '../store/AppLogic';

export const Tenants: React.FC = () => {
  const { t, isRTL } = useTranslation();
  const navigate = useNavigate();
  const { isReadOnly, isAdmin } = useAuth();
  const { 
    tenants, 
    properties, 
    addTenant, 
    updateTenant, 
    deleteTenant, 
    getTenantsWithStatus, 
    markAsPaid,
    bulkMarkAsPaid,
    getLatestUnpaidPayments,
    consolidatePayments,
    payCustomMonths,
    individualizeUpcomingMonths,
    privacyMode,
    updateLandlordActivity
  } = useAppContext();

  useEffect(() => {
    updateLandlordActivity('Tenant Directory');
  }, [updateLandlordActivity]);
  
  const tenantsWithStatus = useMemo(() => getTenantsWithStatus(), [getTenantsWithStatus]);
  const location = useLocation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<{ id: string; tenantName: string } | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<string | null>(null);

  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [tenantToReplace, setTenantToReplace] = useState<Tenant | null>(null);
  const [pendingFormData, setPendingFormData] = useState<any>(null);

  const [quickBulkModalOpen, setQuickBulkModalOpen] = useState(false);
  const [bulkTenant, setBulkTenant] = useState<Tenant | null>(null);
  const [pendingBulkPayments, setPendingBulkPayments] = useState<string[]>([]);
  const [pendingMonthCount, setPendingMonthCount] = useState<number>(0);




  useEffect(() => {
    if (location.state?.openAddModal) {
      handleOpenModal();
      // Clear state so it doesn't reopen on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, properties]);

  const handleOpenModal = (tenant?: Tenant) => {
    setEditingTenant(tenant || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTenant(null);
  };

  const handleSaveTenant = async (dataToSave: any) => {
    try {
      if (editingTenant) {
        await updateTenant(editingTenant.id, dataToSave);
        handleCloseModal();
      } else {
        // Check if property already has an active tenant
        const existingActiveTenant = tenants.find(
          t => t.propertyId === dataToSave.propertyId && t.tenantStatus !== 'archived'
        );
  
        if (existingActiveTenant) {
          setTenantToReplace(existingActiveTenant);
          setPendingFormData(dataToSave);
          setReplaceModalOpen(true);
        } else {
          await addTenant(dataToSave);
          handleCloseModal();
        }
      }
    } catch (err) {
      console.error("Failed to save occupant:", err);
    }
  };

  const handleConfirmReplace = async () => {
    if (tenantToReplace && pendingFormData) {
      updateTenant(tenantToReplace.id, {
        tenantStatus: 'archived',
        archiveDate: new Date().toISOString()
      });
      addTenant(pendingFormData);
    }
    setReplaceModalOpen(false);
    setTenantToReplace(null);
    setPendingFormData(null);
    handleCloseModal();
  };

  const handleDeleteClick = (id: string) => {
    setTenantToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (tenantToDelete) {
      await deleteTenant(tenantToDelete);
    }
    setDeleteModalOpen(false);
    setTenantToDelete(null);
  };

  const exportToCSV = () => {
    const headers = [t.tenants.tenant, t.tenants.phone, t.tenants.property, `${t.tenants.rentAmount} (${APP_CONFIG.CURRENCY})`, t.tenants.paymentCycle, t.tenants.nextPayment, t.tenants.status];
    const csvContent = [
      headers.join(','),
      ...filteredTenants.map(tData => [
        `"${tData.name}"`,
        `"${tData.phone}"`,
        `"${tData.property?.name || 'Unknown'}"`,
        tData.rentAmount,
        formatCycle(tData.paymentCycle),
        format(parseISO(tData.nextDueDate), APP_CONFIG.DATE_FORMAT),
        tData.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `tenants_export_${format(new Date(), APP_CONFIG.DATE_FORMAT)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTenants = useMemo(() => {
    return tenantsWithStatus.filter(tData => {
      const matchesSearch = tData.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (tData.property?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || tData.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tenantsWithStatus, searchTerm, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-success-500/10 text-success-500 border border-success-500/20">{t.dashboard.paid}</span>;
      case 'due':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-warning-500/10 text-warning-600 border border-warning-500/20">{t.dashboard.dueSoon}</span>;
      case 'late':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-danger-500/10 text-danger-500 border border-danger-500/20">{t.dashboard.late}</span>;
      default:
        return null;
    }
  };

  const formatCycle = (cycle: PaymentCycle) => {
    switch (cycle) {
      case 'monthly': return t.tenants.monthly;
      case '3_months': return t.tenants.quarterly;
      case '6_months': return t.tenants.semiannual;
      case 'yearly': return t.tenants.yearly;
    }
  };

  const handleMarkAsPaidClick = (paymentId: string, tenantName: string) => {
    setSelectedPayment({ id: paymentId, tenantName });
    setPaymentModalOpen(true);
  };

  const handleConfirmPayment = (datePaid: string, method: PaymentMethod, paidAmount: number, notes: string, photo?: string) => {
    if (pendingMonthCount > 0 && bulkTenant) {
      payCustomMonths(bulkTenant.id, pendingMonthCount, datePaid, method, notes);
      setPendingMonthCount(0);
    } else if (pendingBulkPayments.length > 0) {
      bulkMarkAsPaid(pendingBulkPayments, datePaid, method, notes, !!photo);
      navigate(`/receipt/${pendingBulkPayments.join(',')}`);
      setPendingBulkPayments([]);
    } else if (selectedPayment) {
      markAsPaid(selectedPayment.id, datePaid, method, paidAmount, notes, !!photo);
    }
    setPaymentModalOpen(false);
    setSelectedPayment(null);
  };

  const handleQuickBulkClick = (tenant: Tenant) => {
    setBulkTenant(tenant);
    setQuickBulkModalOpen(true);
  };

  const handleQuickBulkConfirm = async (count: number, unit: 'months' | 'cycles', selectedId?: string) => {
    const targetTenant = (selectedId ? tenants.find(tData => tData.id === selectedId) : bulkTenant) as Tenant;
    if (!targetTenant) return;
    
    setBulkTenant(targetTenant);
    setQuickBulkModalOpen(false);

    if (unit === 'months') {
      // For custom months, we need to collect payment info through the RecordPaymentModal
      setPendingMonthCount(count);
      setPaymentModalOpen(true);
    } else {
      // Standard cycle-based consolidation
      const nextPayments = await getLatestUnpaidPayments(targetTenant.id, count);
      if (nextPayments.length > 0) {
        const ids = nextPayments.map(p => p.id);
        await consolidatePayments(ids);
      }
    }
  };

  const handleIndividualizeConfirmed = async (count: number, tenantId?: string) => {
    const targetId = tenantId || bulkTenant?.id;
    if (!targetId) return;
    
    setQuickBulkModalOpen(false);
    await individualizeUpcomingMonths(targetId, count);
    navigate(`/tenants/${targetId}`); 
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-xl font-bold text-neutral-900 tracking-tight text-start">{t.tenants.title}</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="secondary" onClick={exportToCSV} size="sm" className="flex-1 sm:flex-none">
            <Download className="w-5 h-5 me-2" />
            <span className="hidden sm:inline">{t.tenants.exportCSV}</span>
          </Button>
          {!isReadOnly && (
            <>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => { setBulkTenant(null); setQuickBulkModalOpen(true); }}
                className="flex-1 sm:flex-none border-neutral-300 text-neutral-700 hover:bg-neutral-50"
              >
                <Layers className="w-5 h-5 me-2" />
                <span className="hidden sm:inline">{t.tenants.customReceipt}</span>
              </Button>
              <Button 
                onClick={() => handleOpenModal()} 
                size="sm"
                disabled={properties.length === 0}
                className="flex-1 sm:flex-none"
              >
                <Plus className="w-5 h-5 me-2" />
                <span>{t.tenants.addTenant}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Card className="flex flex-col sm:flex-row gap-4 bg-white shadow-sm border-neutral-200">
          <div className="relative flex-1">
            <Search className="absolute inset-s-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <Input
              placeholder={t.tenants.search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ps-9 h-10"
              dir="auto"
            />
          </div>
        </Card>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 px-1">
          {[
            { id: 'all', label: t.tenants.allActive, icon: Users },
            { id: 'late', label: t.dashboard.late, icon: AlertCircle },
            { id: 'due', label: t.dashboard.dueSoon, icon: Clock },
            { id: 'paid', label: t.dashboard.paid, icon: CheckCircle2 },
          ].map(filter => {
            const count = tenantsWithStatus.filter(tData => filter.id === 'all' ? true : tData.status === filter.id).length;
            const isActive = statusFilter === filter.id;
            
            return (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-[11px] font-bold transition-colors border ${
                  isActive 
                    ? `bg-primary-500 text-white border-primary-500` 
                    : 'bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50 hover:text-neutral-700'
                }`}
              >
                <filter.icon size={14} className="shrink-0" />
                <span className="uppercase tracking-wider">{filter.label}</span>
                <span className={`px-1.5 py-0.5 rounded-sm tabular-nums ${isActive ? 'bg-white/20' : 'bg-neutral-100'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Table View (Hidden on Mobile) */}
      <Card padding={false} className="hidden lg:block shadow-sm overflow-hidden border-neutral-200">
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y divide-neutral-200 ${isRTL ? 'text-right' : 'text-left'}`}>
            <thead className="bg-neutral-50/50">
              <tr>
                <th className={`px-6 py-3.5 text-[11px] font-bold text-neutral-500 uppercase tracking-widest ${isRTL ? 'text-right' : 'text-left'}`}>{t.tenants.tenant}</th>
                <th className={`px-8 py-3.5 text-[11px] font-bold text-neutral-500 uppercase tracking-widest ${isRTL ? 'text-right' : 'text-left'}`}>{t.tenants.actions}</th>
                <th className={`px-6 py-3.5 text-[11px] font-bold text-neutral-500 uppercase tracking-widest ${isRTL ? 'text-right' : 'text-left'}`}>{t.tenants.property}</th>
                <th className={`px-6 py-3.5 text-[11px] font-bold text-neutral-500 uppercase tracking-widest ${isRTL ? 'text-left' : 'text-right'}`}>{t.tenants.rentCycle}</th>
                <th className={`px-6 py-3.5 text-[11px] font-bold text-neutral-500 uppercase tracking-widest ${isRTL ? 'text-left' : 'text-right'}`}>{t.tenants.status}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-100">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2 text-neutral-400">
                      <div className="text-sm font-semibold">{t.tenants.noResultsCriteria}</div>
                      <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>
                        {t.tenants.clearFilters}
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-neutral-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-neutral-900">{tenant.name}</span>
                        <span className="text-xs text-neutral-500 font-medium tabular-nums">{tenant.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/receipt/${tenant.nextPaymentId}`)}
                          className="w-10 h-10 p-0 border-neutral-200 text-neutral-400 hover:text-neutral-900 hover:border-neutral-900 shadow-sm"
                          title={t.tenants.printReceipt}
                        >
                          <Printer size={24} />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/tenants/${tenant.id}`)}
                          className="w-10 h-10 p-0 border-neutral-200 text-neutral-400 hover:text-neutral-900 hover:border-neutral-900 shadow-sm"
                          title={t.tenants.history}
                        >
                          <Calendar size={24} />
                        </Button>
                        {!isReadOnly && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenModal(tenant)}
                              className="w-10 h-10 p-0 border-neutral-200 text-neutral-400 hover:text-neutral-900 hover:border-neutral-900 shadow-sm"
                              title={t.common.edit}
                            >
                              <Edit2 size={24} />
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleDeleteClick(tenant.id)}
                              className="w-10 h-10 p-0 border-neutral-200 text-danger-400 hover:text-danger-600 hover:border-danger-300 hover:bg-danger-50 shadow-sm ms-1"
                              title={t.tenants.deleteTenant}
                            >
                              <Trash2 size={24} />
                            </Button>
                            <Button 
                              variant="primary"
                              size="sm"
                              onClick={() => handleMarkAsPaidClick(tenant.nextPaymentId!, tenant.name)}
                              className="bg-neutral-900 hover:bg-black text-white px-6 h-10 font-black text-[10px] uppercase tracking-widest ms-1 shadow-sm"
                            >
                              {t.tenants.pay}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-neutral-700 font-medium">{tenant.property?.name || '---'}</span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isRTL ? 'text-left' : 'text-right'}`}>
                      <div className={`flex flex-col ${isRTL ? 'items-start' : 'items-end'}`}>
                        <span className="text-sm font-bold text-neutral-900 tabular-nums">
                          {privacyMode ? '*****' : `${tenant.rentAmount.toLocaleString()} ${APP_CONFIG.CURRENCY}`}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{formatCycle(tenant.paymentCycle)}</span>
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isRTL ? 'text-left' : 'text-right'}`}>
                      <div className={`flex flex-col ${isRTL ? 'items-start' : 'items-end'}`}>
                        {getStatusBadge(tenant.status)}
                        <span className={`text-[10px] font-bold mt-1.5 uppercase tracking-tighter tabular-nums ${
                          tenant.daysRemaining < 0 ? 'text-danger-600' : 
                          tenant.daysRemaining <= 7 ? 'text-warning-600' : 'text-neutral-400'
                        }`}>
                          {tenant.daysRemaining < 0 ? t.tenants.lateLabel.replace('{days}', Math.abs(tenant.daysRemaining).toString()) :
                           tenant.daysRemaining === 0 ? t.tenants.today : t.tenants.leftLabel.replace('{days}', tenant.daysRemaining.toString())}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile Card List View (Visible on Mobile) */}
      <div className="lg:hidden grid grid-cols-2 gap-3 sm:gap-4">
        {filteredTenants.length === 0 ? (
          <Card className="col-span-2 text-center py-12">
            <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest">{t.tenants.noResults}</p>
          </Card>
        ) : (
          filteredTenants.map((tenant) => (
            <Card 
              key={tenant.id} 
              className="border-neutral-100 shadow-sm bg-white overflow-hidden rounded-lg p-0 flex flex-col h-full cursor-pointer hover:border-neutral-900 transition-all relative group/card"
              onClick={() => navigate(`/tenants/${tenant.id}`)}
            >
              {!isReadOnly && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteClick(tenant.id); }}
                  className="absolute top-2 inset-e-2 z-10 w-6 h-6 flex items-center justify-center text-neutral-300 hover:text-danger-500 hover:bg-danger-50 rounded-full transition-all"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              )}

              <div className="p-3 flex-1 flex flex-col">
                <div className="mb-3 text-start pe-6">
                  <h3 className="text-xs font-bold text-neutral-900 tracking-tight leading-none mb-1 truncate">{tenant.name}</h3>
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest truncate flex items-center gap-1 mt-1 opacity-70">
                    <MapPin size={10} className="shrink-0" /> {tenant.property?.name || t.tenants.noAssetAttached}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 mb-2 mt-auto">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-neutral-900 tabular-nums">
                      {privacyMode ? '*****' : `${tenant.rentAmount.toLocaleString()}`}
                    </span>
                    <span className="text-[8px] font-bold text-neutral-400 uppercase opacity-60">{formatCycle(tenant.paymentCycle)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    {getStatusBadge(tenant.status)}
                    <span className={`text-[8px] font-bold uppercase tracking-widest ${
                      tenant.daysRemaining < 0 ? 'text-danger-600' : 
                      tenant.daysRemaining <= 7 ? 'text-warning-600' : 'text-neutral-400'
                    }`}>
                      {tenant.daysRemaining < 0 ? `${Math.abs(tenant.daysRemaining)}D` :
                       tenant.daysRemaining === 0 ? '0D' : `${tenant.daysRemaining}D`}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-50 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigate(`/receipt/${tenant.nextPaymentId}`); }}
                      className="w-9 h-9 p-0 rounded-lg border-neutral-100 text-neutral-400 hover:text-neutral-900 flex items-center justify-center shrink-0"
                    >
                      <Printer size={18} />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleOpenModal(tenant); }}
                      className="w-9 h-9 p-0 rounded-lg border-neutral-100 text-neutral-500 hover:text-neutral-900 flex items-center justify-center shrink-0"
                    >
                      <Edit2 size={18} />
                    </Button>
                  </div>
                  
                  {!isReadOnly && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMarkAsPaidClick(tenant.nextPaymentId!, tenant.name); }}
                      className="w-10 h-10 flex items-center justify-center bg-primary-600 border border-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm transition-all shrink-0"
                    >
                      <DollarSign size={20} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <TenantFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveTenant}
        properties={properties}
        editingTenant={editingTenant}
      />

      <RecordPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedPayment(null);
          setPendingBulkPayments([]);
        }}
        onConfirm={handleConfirmPayment}
        tenantName={pendingBulkPayments.length > 0 ? (bulkTenant?.name || '') : (selectedPayment?.tenantName || '')}
        totalAmount={pendingBulkPayments.length > 0 ? (pendingBulkPayments.length * (bulkTenant?.rentAmount || 0)) : undefined}
        monthCount={pendingMonthCount > 0 ? pendingMonthCount : (pendingBulkPayments.length > 0 ? (pendingBulkPayments.length * getCycleMonths(bulkTenant?.paymentCycle || 'monthly')) : undefined)}
        privacyMode={privacyMode}
      />

      <QuickBulkPayModal
        isOpen={quickBulkModalOpen}
        onClose={() => setQuickBulkModalOpen(false)}
        onConfirm={handleQuickBulkConfirm}
        onIndividualize={handleIndividualizeConfirmed}
        tenantName={bulkTenant?.name}
        tenants={tenantsWithStatus.filter(tData => tData.tenantStatus !== 'archived')}
        initialTenantId={bulkTenant?.id}
      />

      <ConfirmModal
        isOpen={deleteModalOpen}
        title={t.tenants.deleteTenantTitle}
        message={t.tenants.deleteTenantConfirm}
        confirmText={t.tenants.deleteTenantTitle}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setTenantToDelete(null);
        }}
        isDestructive={true}
      />

      <ConfirmModal
        isOpen={replaceModalOpen}
        title={t.tenants.replaceTenantTitle}
        message={t.tenants.replaceTenantMessage}
        confirmText={t.tenants.archiveAndContinue}
        onConfirm={handleConfirmReplace}
        onCancel={() => {
          setReplaceModalOpen(false);
          setTenantToReplace(null);
          setPendingFormData(null);
        }}
      />
    </div>
  );
};




