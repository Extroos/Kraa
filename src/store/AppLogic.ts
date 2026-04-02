import { 
  format, 
  addMonths, 
  parseISO, 
  isValid,
  startOfMonth,
  lastDayOfMonth,
  differenceInDays
} from 'date-fns';
import { Property, Tenant, Payment, TenantWithStatus, PaymentMethod, Receipt, GlobalStats, PaymentCycle, ReceiptLayout, Expense, LandlordAccess, PropertyFolder } from '../types';

export interface AppState {
  properties: Property[];
  tenants: Tenant[];
  payments: Payment[];
  receipts: Receipt[];
  expenses: Expense[];
  globalStats: GlobalStats | null;
  receiptLayout: ReceiptLayout | null;
  authorizedLandlords: LandlordAccess[];
  folders: PropertyFolder[];
  syncCounter: number;
  additionalPayments: Payment[]; // Payments loaded on-demand (archival)
}

export interface AppContextType extends AppState {
  addProperty: (property: Omit<Property, 'id' | 'createdAt' | 'ownerId'>, imageFile?: File) => Promise<void>;
  updateProperty: (id: string, property: Partial<Property>, imageFile?: File) => Promise<void>;
  deleteProperty: (id: string) => void;
  addTenant: (tenant: Omit<Tenant, 'id' | 'createdAt' | 'ownerId'>) => void;
  updateTenant: (id: string, tenant: Partial<Tenant>) => void;
  deleteTenant: (id: string) => void;
  markAsPaid: (paymentId: string, datePaid: string, paymentMethod: PaymentMethod, paidAmount?: number, notes?: string, hasChequePhoto?: boolean) => Promise<void>;
  updatePaymentNotes: (paymentId: string, notes: string) => void;
  updatePaymentAmount: (paymentId: string, amount: number) => Promise<void>;
  unmarkAsPaid: (paymentId: string) => Promise<void>;
  ensureYearlyPayments: (tenantId: string, year: number) => void;
  getTenantsWithStatus: (includeArchived?: boolean) => TenantWithStatus[];
  generateReceipt: (paymentId: string) => Promise<Receipt>;
  recalculateAllStats: () => Promise<void>;
  fetchTenantPayments: (tenantId: string, year: number) => Promise<Payment[]>;
  fetchAllTenantPayments: (tenantId: string) => Promise<Payment[]>;
  refreshTenantStats: (tenantId: string) => Promise<void>;
  triggerDataSync: () => void;
  saveReceiptLayout: (layout: Partial<ReceiptLayout>, bgFile?: File) => Promise<void>;
  bulkMarkAsPaid: (paymentIds: string[], datePaid: string, method: PaymentMethod, notes?: string, hasChequePhoto?: boolean) => Promise<void>;
  bulkUnmarkAsPaid: (paymentIds: string[]) => Promise<void>;
  getLatestUnpaidPayments: (tenantId: string, count: number) => Promise<Payment[]>;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'ownerId'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  getPropertyFinancials: (propertyId: string) => { income: number; expenses: number; net: number };
  profitFocusMode: boolean;
  toggleProfitFocusMode: () => void;
  privacyMode: boolean;
  togglePrivacyMode: () => void;
  canManageAccess: boolean;
  authorizeLandlord: (email: string) => Promise<void>;
  revokeLandlord: (email: string, docId?: string) => Promise<void>;
  updateLandlordActivity: (pageName: string) => Promise<void>;
  updateLandlordPermissions: (docId: string, permissions: Partial<LandlordAccess>) => Promise<void>;
  consolidatePayments: (paymentIds: string[]) => Promise<void>;
  payCustomMonths: (tenantId: string, monthCount: number, datePaid: string, method: PaymentMethod, notes?: string) => Promise<void>;
  individualizeUpcomingMonths: (tenantId: string, monthCount: number) => Promise<void>;
  splitPayment: (paymentId: string) => Promise<void>;
  groupPayments: (paymentIds: string[]) => Promise<void>;
  loadArchivalYear: (tenantId: string, year: number) => Promise<void>;
  clearArchivalCache: () => void;
  addFolder: (name: string) => Promise<void>;
  updateFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  assignPropertyToFolder: (propertyId: string, folderId: string | null) => Promise<void>;
  updateFolderWithProperties: (folderId: string | null, name: string, propertyIds: string[]) => Promise<void>;
  updateReceipt: (id: string, updates: Partial<Receipt>) => Promise<void>;
  effectiveOwnerId: string | null;
}

export const getCycleMonths = (cycle: PaymentCycle): number => {
  switch (cycle) {
    case 'monthly': return 1;
    case '3_months': return 3;
    case '6_months': return 6;
    case 'yearly': return 12;
    default: return 1;
  }
};

export const formatReceiptNumber = (num?: number): string => {
  if (num === undefined || num === null) return '----';
  return num.toString().padStart(4, '0');
};

export const generatePaymentsForYear = (tenant: Tenant, year: number, ownerId: string, existingPayments: Payment[] = []): Payment[] => {
  if (!tenant.startDate) return [];
  const start = parseISO(tenant.startDate);
  if (!isValid(start)) return [];
  
  const startYear = start.getFullYear();
  if (year < startYear) return [];

  // Map of months (YYYY-MM) already covered by existing payments
  const covered = new Set<string>();
  existingPayments.filter(p => p.tenantId === tenant.id).forEach(p => {
    let curr = parseISO(p.periodStart);
    const pEnd = parseISO(p.periodEnd);
    // Add all months in the period to the covered set
    while (curr <= pEnd) {
      covered.add(format(curr, 'yyyy-MM'));
      curr = addMonths(curr, 1);
    }
  });
  
  let pStart = startOfMonth(start);
  const cycleMonths = getCycleMonths(tenant.paymentCycle);
  
  // Forward to target year, but respect coverage
  while (pStart.getFullYear() < year) {
    pStart = addMonths(pStart, cycleMonths);
  }
  
  const newPayments: Payment[] = [];
  while (pStart.getFullYear() === year) {
    const monthKey = format(pStart, 'yyyy-MM');
    
    // If THIS month is already covered, skip 1 month and check again
    if (covered.has(monthKey)) {
      pStart = addMonths(pStart, 1);
      continue;
    }

    // Gap found! Scan ahead to see how many months we can fit before an obstacle
    let gapMonths = 0;
    while (gapMonths < cycleMonths) {
      const checkDate = addMonths(pStart, gapMonths);
      if (covered.has(format(checkDate, 'yyyy-MM'))) break;
      gapMonths++;
    }

    if (gapMonths === 0) {
      pStart = addMonths(pStart, 1);
      continue;
    }

    const pEnd = lastDayOfMonth(addMonths(pStart, gapMonths - 1));
    const dateStr = format(pStart, 'yyyy-MM-dd');
    const id = `${tenant.id}_${year}_${dateStr}`;
    
    newPayments.push({
      id,
      tenantId: tenant.id,
      year: year,
      amount: (Number(tenant.rentAmount) || 0) * gapMonths,
      periodStart: pStart.toISOString(),
      periodEnd: pEnd.toISOString(),
      ownerId,
      createdAt: new Date().toISOString()
    });
    pStart = addMonths(pStart, gapMonths);
  }
  return newPayments;
};

export const getPaymentStatus = (payment: Payment): 'paid' | 'late' | 'due' | 'unpaid' => {
  if (payment.datePaid) return 'paid';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = parseISO(payment.periodStart);
  if (!isValid(dueDate)) return 'due';
  
  dueDate.setHours(0, 0, 0, 0);
  
  if (dueDate < today) return 'late';
  
  // Calculate days remaining
  if (differenceInDays(dueDate, today) <= 3) return 'due';
  
  return 'unpaid';
};
