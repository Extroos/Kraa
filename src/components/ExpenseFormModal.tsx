import React, { useState, useEffect } from 'react';
import { Expense, Property, ExpenseCategory } from '../types';
import { Modal, Button, Input, TextArea } from './ui';
import { format, parseISO, isValid, startOfDay } from 'date-fns';
import { APP_CONFIG } from '../config/constants';
import { useTranslation } from '../i18n';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  properties: Property[];
  editingExpense: Expense | null;
  prefillPropertyId?: string;
}

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  properties,
  editingExpense,
  prefillPropertyId = '',
}) => {
  const { t, isRTL } = useTranslation();

  const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
    { value: 'maintenance', label: t.expenses.maintenance },
    { value: 'tax', label: t.expenses.tax },
    { value: 'insurance', label: t.expenses.insurance },
    { value: 'utilities', label: t.expenses.utilities },
    { value: 'other', label: t.expenses.other },
  ];

  const [formData, setFormData] = useState({
    description: '',
    amount: 0,
    date: format(new Date(), APP_CONFIG.DATE_FORMAT),
    category: 'maintenance' as ExpenseCategory,
    propertyId: '',
  });

  useEffect(() => {
    if (editingExpense) {
      setFormData({
        description: editingExpense.description,
        amount: editingExpense.amount,
        date: (() => {
          const d = parseISO(editingExpense.date);
          return isValid(d) ? format(d, APP_CONFIG.DATE_FORMAT) : format(new Date(), APP_CONFIG.DATE_FORMAT);
        })(),
        category: editingExpense.category,
        propertyId: editingExpense.propertyId || '',
      });
    } else {
      setFormData({
        description: '',
        amount: 0,
        date: format(new Date(), APP_CONFIG.DATE_FORMAT),
        category: 'maintenance',
        propertyId: prefillPropertyId,
      });
    }
  }, [editingExpense, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      amount: Number(formData.amount) || 0,
      date: startOfDay(parseISO(formData.date)).toISOString(),
    });
  };

  const footer = (
    <div className="flex gap-3 w-full rtl:flex-row-reverse">
      <Button variant="secondary" className="flex-1 h-11 uppercase tracking-widest text-[10px] font-bold" onClick={onClose}>
        {t.common.cancel}
      </Button>
      <Button type="submit" form="expense-form" className="flex-1 h-11 uppercase tracking-widest text-[10px] font-bold">
        {t.expenses.recordExpense}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingExpense ? t.expenses.modifyExpense : t.expenses.newExpense}
      footer={footer}
      maxWidth="max-w-xl"
    >
      <form id="expense-form" onSubmit={handleSubmit} className={`space-y-5 ${isRTL ? 'text-right' : 'text-left'}`}>
        <Input
          label={t.expenses.description}
          required
          placeholder={t.expenses.expenseDescriptionPlaceholder}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={`${t.expenses.totalAmount} (${APP_CONFIG.CURRENCY})`}
            required
            type="number"
            min="0"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
          />
          <Input
            label={t.expenses.date}
            required
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">{t.expenses.category}</label>
            <select
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
              className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded text-xs font-bold uppercase tracking-wider focus:border-primary-500 outline-none transition-colors cursor-pointer"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">{t.expenses.linkedProperty}</label>
            <select
              value={formData.propertyId}
              onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
              className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded text-sm font-medium focus:border-primary-500 outline-none transition-colors cursor-pointer appearance-none"
            >
              <option value="">{t.expenses.generalPortfolio}</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
};

