import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from './ui';
import { Layers, Search, User } from 'lucide-react';
import { Tenant } from '../types';
import { useTranslation } from '../i18n';

interface QuickBulkPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (count: number, unit: 'months' | 'cycles', tenantId?: string) => void;
  onIndividualize?: (count: number, tenantId?: string) => void;
  tenantName?: string;
  tenants?: (Tenant & { property?: { name: string } | null })[];
  initialTenantId?: string;
}

export const QuickBulkPayModal: React.FC<QuickBulkPayModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onIndividualize,
  tenantName,
  tenants = [],
  initialTenantId
}) => {
  const { t, isRTL } = useTranslation();
  const [count, setCount] = useState<number>(1);
  const [unit, setUnit] = useState<'months' | 'cycles'>('cycles');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    if (initialTenantId) {
      setSelectedTenantId(initialTenantId);
    } else if (tenants.length > 0 && !selectedTenantId) {
      setSelectedTenantId(tenants[0].id);
    }
  }, [initialTenantId, tenants, isOpen]);

  const selectedTenant = tenants.find(t => t.id === (selectedTenantId || initialTenantId));
  
  const cycleMultiplier = selectedTenant ? (
    selectedTenant.paymentCycle === '3_months' ? 3 :
    selectedTenant.paymentCycle === '6_months' ? 6 :
    selectedTenant.paymentCycle === 'yearly' ? 12 : 1
  ) : 1;

  const cycleLabel = selectedTenant ? (
    selectedTenant.paymentCycle === 'yearly' ? t.tenants.yearly :
    selectedTenant.paymentCycle === 'monthly' ? t.tenants.monthly : 'Cycles'
  ) : 'Months';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (count < 1) return;
    onConfirm(count, unit, tenantName ? undefined : selectedTenantId);
    setCount(1);
    setUnit('cycles');
    setSearchTerm('');
  };

  const handleIndividualize = () => {
    if (count < 1 || !onIndividualize) return;
    onIndividualize(count, tenantName ? undefined : selectedTenantId);
    setCount(1);
    setUnit('cycles');
    setSearchTerm('');
  };

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (t.property?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const footer = (
    <div className={`flex flex-row gap-1.5 w-full ${isRTL ? 'flex-row-reverse' : ''}`}>
      <Button 
        variant="secondary" 
        className="flex-1 h-10 uppercase tracking-tighter text-[8px] font-black px-1 border-neutral-200" 
        onClick={onClose}
      >
        {t.common.cancel}
      </Button>
      {unit === 'months' && onIndividualize && (
        <Button 
          variant="outline"
          className="flex-[1.5] h-10 uppercase tracking-tighter text-[8px] font-black px-1 border-warning-200 text-warning-600 hover:bg-warning-50"
          onClick={handleIndividualize}
          disabled={!tenantName && !selectedTenantId}
        >
          {t.payments.splitMonths}
        </Button>
      )}
      <Button 
        type="submit" 
        form="quick-bulk-form" 
        className="flex-[1.5] h-10 uppercase tracking-tighter text-[8px] font-black px-1 shadow-sm"
        disabled={!tenantName && !selectedTenantId}
      >
        {unit === 'months' ? t.payments.recordPayment : t.payments.consolidate}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.payments.customReceiptConfig || "Custom Receipt Configuration"}
      footer={footer}
      maxWidth="max-w-md"
    >
      <form id="quick-bulk-form" onSubmit={handleSubmit} className={`space-y-4 ${isRTL ? 'rtl' : ''}`}>
        {tenantName ? (
          <div className={`flex items-center gap-3 p-3 bg-primary-50 rounded-xl border border-primary-100/50 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
            <div className="w-10 h-10 bg-white rounded-lg border border-primary-200 flex items-center justify-center shadow-sm shrink-0">
              <Layers size={20} className="shrink-0 text-primary-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-primary-600 uppercase tracking-widest leading-none mb-1 opacity-70">Selected Occupant</p>
              <p className="text-sm font-black text-neutral-900 tracking-tight truncate">{tenantName}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={isRTL ? 'text-right' : ''}>
              <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 px-1">Select Occupant</label>
              <div className="relative mb-2">
                <Search size={18} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 shrink-0 text-neutral-400`} />
                <Input
                  placeholder="Filter records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`h-10 text-xs font-bold uppercase tracking-wider border-neutral-200 focus:border-primary-500 bg-neutral-50/30 ${isRTL ? 'pr-9' : 'pl-9'}`}
                />
              </div>
              <div className="max-h-32 overflow-y-auto border border-neutral-200 rounded-xl divide-y divide-neutral-100 bg-white/50 custom-scrollbar shadow-inner">
                {filteredTenants.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-[9px] font-black text-neutral-300 uppercase tracking-widest">No matching records</p>
                  </div>
                ) : (
                  filteredTenants.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTenantId(t.id)}
                      className={`w-full flex items-center gap-2.5 p-2.5 transition-all ${isRTL ? 'flex-row-reverse text-right' : 'text-left'} ${
                        selectedTenantId === t.id ? 'bg-primary-50 text-primary-900' : 'hover:bg-neutral-50/50 text-neutral-600'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border transition-all ${
                        selectedTenantId === t.id ? 'bg-primary-600 text-white border-primary-700 shadow-sm scale-105' : 'bg-white text-neutral-400 border-neutral-200'
                      }`}>
                        <User size={16} className="shrink-0" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[11px] font-black truncate uppercase tracking-tight ${selectedTenantId === t.id ? 'text-primary-900' : 'text-neutral-800'}`}>{t.name}</p>
                        <p className="text-[8px] font-bold text-neutral-400 truncate uppercase tracking-widest mt-0.5">{t.property?.name || 'Unassigned Asset'}</p>
                      </div>
                      {selectedTenantId === t.id && (
                        <div className={`w-1.5 h-1.5 rounded-full bg-primary-600 shadow-[0_0_8px_primary-600] ${isRTL ? 'mr-auto ml-1' : 'ml-auto mr-0'}`} />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <div className="p-4 bg-neutral-50/50 border border-neutral-200 rounded-2xl">
          <label className="block text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-3 text-center">
            Duration Management
          </label>
          
          <div className="flex bg-white rounded-lg border border-neutral-200 p-1 mb-4 max-w-[220px] mx-auto shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setUnit('cycles')}
              className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all rounded-md ${
                unit === 'cycles' ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              Cycles
            </button>
            <button
              type="button"
              onClick={() => setUnit('months')}
              className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all rounded-md ${
                unit === 'months' ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              Months
            </button>
          </div>

          <div className="flex flex-col items-center gap-1.5 max-w-[150px] mx-auto">
             <div className="relative w-full">
               <Input
                 type="number"
                 min={1}
                 max={48}
                 required
                 value={count}
                 onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
                 className="text-center text-3xl font-black h-14 border-2 border-neutral-200 focus:border-primary-500 transition-all rounded-xl shadow-sm"
               />
             </div>
             <p className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.2em] mt-0.5">
               {unit === 'cycles' ? cycleLabel : 'INSTANT MONTHS'}
             </p>
          </div>
          
          <div className="mt-4 pt-4 border-t border-neutral-200/50 flex flex-col items-center gap-2">
            <p className="text-[8px] font-black text-neutral-400 uppercase tracking-[0.3em] opacity-60">System Summary</p>
            <div className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest tabular-nums border shadow-sm transition-all ${
               unit === 'months' ? 'border-warning-200 text-warning-700 bg-warning-50/50' : 'border-neutral-900 text-white bg-neutral-900'
            }`}>
              {count} × {unit === 'months' ? 'Individual' : 'Standard'} {unit === 'months' ? 'Months' : 'Cycles'}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
