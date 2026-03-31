import React, { useState, useEffect } from 'react';
import { Tenant, Property, PaymentCycle } from '../types';
import { Modal, Button, Input, TextArea } from './ui';
import { format, parseISO, isValid, startOfDay } from 'date-fns';
import { APP_CONFIG } from '../config/constants';
import { numberToArabicWords } from '../utils/arabic';
import { getCycleMonths } from '../store/AppLogic';
import { useTranslation } from '../i18n';

interface TenantFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  properties: Property[];
  editingTenant: Tenant | null;
}

export const TenantFormModal: React.FC<TenantFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  properties,
  editingTenant,
}) => {
  const { t, isRTL } = useTranslation();
  
  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    phone: '',
    propertyId: '',
    rentAmount: 0,
    rentAmountArText: '',
    paymentCycle: 'monthly' as PaymentCycle,
    startDate: format(new Date(), APP_CONFIG.DATE_FORMAT),
    notes: '',
    paymentDay: 'first' as 'first' | 'end',
  });

  useEffect(() => {
    if (editingTenant) {
      setFormData({
        name: editingTenant.name,
        nameAr: editingTenant.nameAr || '',
        phone: editingTenant.phone,
        propertyId: editingTenant.propertyId,
        rentAmount: editingTenant.rentAmount,
        rentAmountArText: editingTenant.rentAmountArText || '',
        paymentCycle: editingTenant.paymentCycle,
        startDate: (() => {
          const d = parseISO(editingTenant.startDate);
          return isValid(d) ? format(d, APP_CONFIG.DATE_FORMAT) : format(new Date(), APP_CONFIG.DATE_FORMAT);
        })(),
        notes: editingTenant.notes || '',
        paymentDay: editingTenant.paymentDay || 'first',
      });
    } else {
      setFormData({
        name: '',
        nameAr: '',
        phone: '',
        propertyId: properties.length > 0 ? properties[0].id : '',
        rentAmount: 0,
        rentAmountArText: '',
        paymentCycle: 'monthly',
        startDate: format(new Date(), APP_CONFIG.DATE_FORMAT),
        notes: '',
        paymentDay: 'first',
      });
    }
  }, [editingTenant, properties, isOpen]);

  const handleRentAmountChange = (val: string) => {
    const numVal = val === '' ? 0 : Number(val);
    setFormData(prev => ({
      ...prev,
      rentAmount: val as any, // Store as string for input flexibility
      rentAmountArText: numVal > 0 ? (prev.rentAmountArText === numberToArabicWords(Number(prev.rentAmount)) || !prev.rentAmountArText ? numberToArabicWords(numVal) : prev.rentAmountArText) : ''
    }));
  };

  const handleTriggerSubmit = () => {
    const form = document.getElementById('tenant-form') as HTMLFormElement;
    if (form && !form.checkValidity()) {
      form.reportValidity();
      return;
    }
    
    // Fallback manual validation just in case
    if (!formData.name || !formData.phone || !formData.propertyId || !formData.startDate) return;

    onSave({
      ...formData,
      rentAmount: Number(formData.rentAmount) || 0,
      startDate: startOfDay(parseISO(formData.startDate)).toISOString(),
    });
  };

  const footer = (
    <div className={`flex gap-3 w-full ${isRTL ? 'flex-row-reverse' : ''}`}>
      <Button variant="secondary" className="flex-1 h-11 uppercase tracking-widest text-[10px] font-bold" onClick={onClose}>
        {t.common.cancel}
      </Button>
      <Button type="button" onClick={handleTriggerSubmit} className="flex-1 h-11 uppercase tracking-widest text-[10px] font-bold">
        {editingTenant ? t.tenants.saveTenant : t.tenants.enrollTenant}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingTenant ? t.tenants.modifyTenant : t.tenants.enrollTenant}
      footer={footer}
      maxWidth="max-w-xl"
    >
      <form id="tenant-form" className={`space-y-5 ${isRTL ? 'text-right' : 'text-left'}`} onSubmit={(e) => { e.preventDefault(); handleTriggerSubmit(); }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t.tenants.nameLabel}
            placeholder={t.tenants.namePlaceholder}
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <Input
            label={t.tenants.nameArLabel}
            placeholder={t.tenants.nameArPlaceholder}
            value={formData.nameAr}
            onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
            dir="rtl"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t.tenants.phoneLabel}
            placeholder={t.tenants.phonePlaceholder}
            required
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">{t.tenants.propertyLabel}</label>
            <select
              required
              value={formData.propertyId}
              onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
              className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded text-sm font-medium focus:border-primary-500 outline-none transition-colors cursor-pointer appearance-none"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4 bg-neutral-50 rounded border border-neutral-100">
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input
                label={`${t.tenants.rentAmountLabel} (${APP_CONFIG.CURRENCY})`}
                required
                type="number"
                min="0"
                value={formData.rentAmount === 0 ? '' : formData.rentAmount}
                onChange={(e) => handleRentAmountChange(e.target.value)}
              />
              {getCycleMonths(formData.paymentCycle) > 1 && formData.rentAmount > 0 && (
                <p className={`text-[10px] font-bold text-primary-600 uppercase tracking-widest mt-1.5 ${isRTL ? 'mr-1' : 'ml-1'}`}>
                  {t.tenants.totalPerCycle}: {(formData.rentAmount * getCycleMonths(formData.paymentCycle)).toLocaleString()} {APP_CONFIG.CURRENCY}
                </p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">{t.tenants.paymentCycleLabel}</label>
              <select
                required
                value={formData.paymentCycle}
                onChange={(e) => setFormData({ ...formData, paymentCycle: e.target.value as PaymentCycle })}
                className="w-full h-10 px-3 bg-white border border-neutral-200 rounded text-xs font-bold uppercase tracking-wider focus:border-primary-500 outline-none transition-colors cursor-pointer"
              >
                <option value="monthly">{t.tenants.monthly}</option>
                <option value="3_months">{t.tenants.quarterly}</option>
                <option value="6_months">{t.tenants.semiannual}</option>
                <option value="yearly">{t.tenants.yearly}</option>
              </select>
            </div>
          </div>
          <Input
            label={t.tenants.rentAmountArLabel}
            placeholder={t.tenants.nameArPlaceholder}
            value={formData.rentAmountArText}
            onChange={(e) => setFormData({ ...formData, rentAmountArText: e.target.value })}
            dir="rtl"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t.tenants.startDateLabel}
            required
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
          />
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Payment Schedule</label>
            <select
              required
              value={formData.paymentDay}
              onChange={(e) => setFormData({ ...formData, paymentDay: e.target.value as any })}
              className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded text-xs font-bold uppercase tracking-wider focus:border-primary-500 outline-none transition-colors cursor-pointer"
            >
              <option value="first">First of the Month</option>
              <option value="end">End of the Month</option>
            </select>
          </div>
        </div>

        <TextArea
          label={t.tenants.operationalNotesLabel}
          placeholder={t.tenants.operationalNotesPlaceholder}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
        />
      </form>
    </Modal>
  );
};

