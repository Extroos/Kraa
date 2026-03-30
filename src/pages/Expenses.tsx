import React, { useState, useEffect } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { Plus, Search, Filter, Trash2, Calendar, Wrench, Receipt, Building2, Eye, EyeOff } from 'lucide-react';
import { Expense, ExpenseCategory } from '../types';
import { format, parseISO } from 'date-fns';
import { ExpenseFormModal } from '../components/ExpenseFormModal';
import { Button, Input, Card } from '../components/ui';
import { APP_CONFIG } from '../config/constants';
import { useTranslation } from '../i18n';

export const Expenses: React.FC = () => {
  const { isReadOnly } = useAuth();
  const { expenses, properties, addExpense, deleteExpense, profitFocusMode, toggleProfitFocusMode, updateLandlordActivity } = useAppContext();
  const { t, isRTL } = useTranslation();

  useEffect(() => {
    updateLandlordActivity(t.expenses.operatingExpenses);
  }, [updateLandlordActivity, t.expenses.operatingExpenses]);

  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [prefilledPropertyId, setPrefilledPropertyId] = useState<string>('');

  useEffect(() => {
    const state = location.state as { prefillPropertyId?: string; openAddModal?: boolean };
    if (state?.openAddModal) {
      setPrefilledPropertyId(state.prefillPropertyId || '');
      setIsModalOpen(true);
      // Clean up state so it doesn't reopen on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const filteredExpenses = expenses
    .filter((e) => {
      const matchesSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSaveExpense = async (data: any) => {
    try {
      await addExpense(data);
      setIsModalOpen(false);
    } catch (err) {
      console.error("Failed to save expense:", err);
    }
  };

  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const getCategoryColor = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'maintenance': return 'bg-orange-100 text-orange-700';
      case 'tax': return 'bg-red-100 text-red-700';
      case 'insurance': return 'bg-blue-100 text-blue-700';
      case 'utilities': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'maintenance': return t.expenses.maintenance;
      case 'tax': return t.expenses.tax;
      case 'insurance': return t.expenses.insurance;
      case 'utilities': return t.expenses.utilities;
      case 'other': return t.expenses.other;
      default: return cat;
    }
  };

  return (
    <div className={`space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className={`flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={isRTL ? 'text-right' : ''}>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">{t.expenses.operatingExpenses}</h1>
          <p className="text-xs text-neutral-500 font-bold uppercase tracking-wider mt-1">{t.expenses.maintenanceTracking}</p>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleProfitFocusMode}
            className={`bg-white border-neutral-200 text-neutral-500 hover:text-primary-500 h-10 w-10 p-0 shadow-none transition-colors ${profitFocusMode ? 'text-primary-500 bg-primary-50/50 border-primary-200' : ''}`}
            title={profitFocusMode ? t.expenses.disableProfitFocus : t.expenses.enableProfitFocus}
          >
            {profitFocusMode ? <EyeOff size={20} className="shrink-0" /> : <Eye size={20} className="shrink-0" />}
          </Button>
          {!isReadOnly && (
            <Button onClick={() => { setEditingExpense(null); setIsModalOpen(true); }} size="sm">
              <Plus size={20} className={`shrink-0 ${isRTL ? 'ml-1' : 'mr-1'}`} /> {t.expenses.addRecord}
            </Button>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-1 ${!profitFocusMode ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-6`}>
        <Card className={`${!profitFocusMode ? 'md:col-span-2' : 'md:col-span-1'} shadow-sm border-neutral-200 transition-all duration-300`}>
          <div className={`flex flex-col md:flex-row gap-4 mb-8 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
            <div className="relative flex-1">
              <Search size={20} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 shrink-0 text-neutral-400`} />
              <input
                type="text"
                placeholder={t.expenses.searchDescriptions}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full ${isRTL ? 'pr-10 text-right' : 'pl-10 text-left'} py-2 bg-neutral-50 border-neutral-200 border rounded text-sm outline-none focus:border-primary-500 transition-colors placeholder:text-neutral-400 font-medium`}
              />
            </div>
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Filter size={20} className="shrink-0 text-neutral-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`bg-neutral-50 border-neutral-200 border rounded px-3 py-2 text-xs font-bold uppercase tracking-wider outline-none focus:border-primary-500 cursor-pointer text-neutral-600 appearance-none min-w-[140px] ${isRTL ? 'text-right' : 'text-left'}`}
              >
                <option value="all">{t.expenses.allCategories}</option>
                <option value="maintenance">{t.expenses.maintenance.toUpperCase()}</option>
                <option value="tax">{t.expenses.tax.toUpperCase()}</option>
                <option value="insurance">{t.expenses.insurance.toUpperCase()}</option>
                <option value="utilities">{t.expenses.utilities.toUpperCase()}</option>
                <option value="other">{t.expenses.other.toUpperCase()}</option>
              </select>
            </div>
          </div>

          {/* PC Spreadsheet View */}
          <div className="hidden md:block overflow-x-auto">
            <table className={`min-w-full divide-y divide-neutral-100 ${isRTL ? 'text-right' : 'text-left'}`}>
              <thead>
                <tr className={`bg-neutral-50/50 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <th scope="col" className={`px-4 py-3.5 ${isRTL ? 'text-right' : 'text-left'} text-[11px] font-bold text-neutral-500 uppercase tracking-widest`}>{t.expenses.date}</th>
                  <th scope="col" className={`px-4 py-3.5 ${isRTL ? 'text-right' : 'text-left'} text-[11px] font-bold text-neutral-500 uppercase tracking-widest`}>{t.expenses.description}</th>
                  <th scope="col" className={`px-4 py-3.5 ${isRTL ? 'text-right' : 'text-left'} text-[11px] font-bold text-neutral-500 uppercase tracking-widest`}>{t.expenses.category}</th>
                  <th scope="col" className={`px-4 py-3.5 ${isRTL ? 'text-right' : 'text-left'} text-[11px] font-bold text-neutral-500 uppercase tracking-widest`}>{t.expenses.totalAmount}</th>
                  <th scope="col" className={`px-4 py-3.5 ${isRTL ? 'text-left' : 'text-right'} text-[11px] font-bold text-neutral-500 uppercase tracking-widest`}>{t.tenants.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <p className="text-sm font-medium text-neutral-400 uppercase tracking-wider">{t.expenses.noMatching}</p>
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((expense) => (
                    <tr key={expense.id} className={`hover:bg-neutral-50/50 transition-colors group ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <td className="px-4 py-4 whitespace-nowrap text-xs font-bold text-neutral-600 tabular-nums">
                        {format(parseISO(expense.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-4 max-w-xs">
                        <div className="text-sm font-bold text-neutral-900 truncate tracking-tight">{expense.description}</div>
                        {expense.propertyId && (
                          <div className={`text-[10px] text-primary-600 font-bold uppercase tracking-wider flex items-center gap-1 mt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <Building2 size={14} strokeWidth={2.5} className="shrink-0" />
                            {properties.find(p => p.id === expense.propertyId)?.name || 'Property'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getCategoryColor(expense.category)}`}>
                          {getCategoryLabel(expense.category)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-neutral-900 tabular-nums">
                        {expense.amount.toLocaleString()} <span className="text-[10px] text-neutral-400 font-bold uppercase">{APP_CONFIG.CURRENCY}</span>
                      </td>
                      <td className={`px-4 py-4 whitespace-nowrap ${isRTL ? 'text-left' : 'text-right'}`}>
                        {!isReadOnly && (
                          <button
                            onClick={() => {
                              if (window.confirm(t.expenses.deleteRecord)) deleteExpense(expense.id);
                            }}
                            className="p-2 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors"
                          >
                            <Trash2 size={20} className="shrink-0" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (PHONE ONLY) */}
          <div className="grid grid-cols-2 gap-2 md:hidden">
            {filteredExpenses.length === 0 ? (
                <div className="col-span-2 py-10 text-center border border-dashed border-neutral-100 rounded-lg bg-neutral-50/20">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{t.expenses.noMatching}</p>
                </div>
            ) : (
                filteredExpenses.map((expense) => (
                  <div key={expense.id} className="p-3 rounded-lg border border-neutral-100 bg-white shadow-sm flex flex-col h-full">
                    <div className={`flex justify-between items-start gap-1 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                       <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0 ${getCategoryColor(expense.category)}`}>
                         {getCategoryLabel(expense.category).slice(0, 8)}
                       </span>
                       <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-tighter opacity-60">
                         {format(parseISO(expense.date), 'MMM d')}
                       </span>
                    </div>

                    <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
                      <div className="text-[10px] font-bold text-neutral-900 leading-tight mb-1 line-clamp-2 min-h-[20px]">{expense.description}</div>
                      {expense.propertyId && (
                        <div className={`text-[8px] text-primary-600 font-bold uppercase tracking-wide flex items-center gap-1 mt-1 opacity-70 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Building2 size={12} strokeWidth={2.5} className="shrink-0" />
                          <span className="truncate">{properties.find(p => p.id === expense.propertyId)?.name || 'Property'}</span>
                        </div>
                      )}
                    </div>

                    <div className={`flex justify-between items-end pt-2 border-t border-neutral-50 mt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                       <div className={`flex flex-col ${isRTL ? 'items-end' : ''}`}>
                          <span className="text-[10px] font-bold text-neutral-900 tabular-nums leading-none">
                            {expense.amount.toLocaleString()} <span className="text-[8px] font-bold uppercase text-neutral-400">{APP_CONFIG.CURRENCY}</span>
                          </span>
                       </div>
                       
                       {!isReadOnly && (
                          <button
                            onClick={() => {
                              if (window.confirm(t.expenses.deleteRecord)) deleteExpense(expense.id);
                            }}
                            className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-danger-500 transition-colors"
                          >
                            <Trash2 size={16} className="shrink-0" />
                          </button>
                       )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </Card>

        {!profitFocusMode && (
          <div className="space-y-6">
            <Card className={`bg-neutral-900 text-white border-none shadow-md ${isRTL ? 'text-right' : ''}`}>
              <h3 className="text-[10px] font-bold text-primary-300 uppercase tracking-widest mb-4">{t.expenses.totalExpenditure}</h3>
              <div className={`flex items-baseline gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-3xl font-bold tabular-nums">{totalAmount.toLocaleString()}</span>
                <span className="text-xs font-bold text-primary-300 uppercase">{APP_CONFIG.CURRENCY}</span>
              </div>
              <p className={`text-[10px] font-bold text-primary-400 uppercase tracking-widest mt-6 pt-4 border-t border-primary-900/50 ${isRTL ? 'text-right' : ''}`}>
                {filteredExpenses.length} {t.expenses.recordsTracked}
              </p>
            </Card>

            <Card className="border-neutral-200 shadow-sm">
              <h3 className={`text-xs font-bold text-neutral-900 uppercase tracking-widest mb-6 flex items-center gap-2 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <Receipt size={16} className="shrink-0 text-primary-500" />
                {t.expenses.categoryBreakdown}
              </h3>
              <div className="space-y-4">
                {['maintenance', 'tax', 'insurance', 'utilities', 'other'].map(cat => {
                  const amount = expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
                  if (amount === 0) return null;
                  return (
                    <div key={cat} className={`flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs font-bold text-neutral-500 uppercase tracking-tight">{getCategoryLabel(cat)}</span>
                      <span className="text-sm font-bold text-neutral-900 tabular-nums">{amount.toLocaleString()} {APP_CONFIG.CURRENCY}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
      </div>

      <ExpenseFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveExpense}
        properties={properties}
        editingExpense={editingExpense}
      />
    </div>
  );
};
