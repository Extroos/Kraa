import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { Payment, Receipt, Expense, ReceiptLayout, OperationType, PaymentMethod, Tenant } from '../../types';
import { db } from '../../firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  getDocs,
  runTransaction,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  increment,
  writeBatch,
  deleteField,
  startAfter,
  limit
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, isValid, addMonths, startOfMonth, subDays, lastDayOfMonth } from 'date-fns';
import { FIREBASE_COLLECTIONS, DEFAULT_RECEIPT_LAYOUT } from '../../config/constants';
import { handleFirestoreError } from '../../utils/firestore';
import { storeLocalReceiptTemplate } from '../../utils/localImage';
import { generatePaymentsForYear as appLogicGenerate } from '../AppLogic';

export interface FinancialContextType {
  payments: Payment[];
  receipts: Receipt[];
  expenses: Expense[];
  receiptLayout: ReceiptLayout | null;
  loadArchivalYear: (tenantId: string, year: number) => Promise<void>;
  markAsPaid: (paymentId: string, datePaid: string, paymentMethod: PaymentMethod, paidAmount?: number, notes?: string, hasChequePhoto?: boolean) => Promise<void>;
  unmarkAsPaid: (paymentId: string) => Promise<void>;
  updatePaymentAmount: (paymentId: string, amount: number) => Promise<void>;
  updatePaymentNotes: (paymentId: string, notes: string) => Promise<void>;
  generateReceipt: (paymentId: string) => Promise<Receipt>;
  updateReceipt: (id: string, updates: Partial<Receipt>) => Promise<void>;
  saveReceiptLayout: (layout: Partial<ReceiptLayout>, bgFile?: File) => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'ownerId'>) => Promise<void>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  bulkMarkAsPaid: (paymentIds: string[], datePaid: string, paymentMethod: PaymentMethod, notes?: string, hasChequePhoto?: boolean) => Promise<void>;
  bulkUnmarkAsPaid: (paymentIds: string[]) => Promise<void>;
  fetchTenantPayments: (tenantId: string, year: number) => Promise<Payment[]>;
  fetchAllTenantPayments: (tenantId: string) => Promise<Payment[]>;
  refreshTenantStats: (tenantId: string) => Promise<void>;
  consolidatePayments: (paymentIds: string[]) => Promise<void>;
  payCustomMonths: (tenantId: string, monthCount: number, datePaid: string, method: PaymentMethod, notes?: string) => Promise<void>;
  individualizeUpcomingMonths: (tenantId: string, monthCount: number) => Promise<void>;
  ensureYearlyPayments: (tenantId: string, year: number) => Promise<void>;
  getLatestUnpaidPayments: (tenantId: string, count: number) => Promise<Payment[]>;
  loading: boolean;
}

export const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export const FinancialProvider: React.FC<{ 
  children: React.ReactNode;
  user: any;
  effectiveOwnerId: string | null;
  isReadOnly: boolean;
  triggerDataSync: () => void;
}> = ({ children, user, effectiveOwnerId, isReadOnly, triggerDataSync }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [receiptLayout, setReceiptLayout] = useState<ReceiptLayout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !effectiveOwnerId) {
      setPayments([]); setReceipts([]); setExpenses([]); setReceiptLayout(null); setLoading(false);
      return;
    }

    const currentYear = new Date().getFullYear();
    const qPayments = query(collection(db, FIREBASE_COLLECTIONS.PAYMENTS), where('ownerId', '==', effectiveOwnerId), where('year', '>=', currentYear - 1));
    const unsubPayments = onSnapshot(qPayments, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, FIREBASE_COLLECTIONS.PAYMENTS, user.uid, user.email));

    const qReceipts = query(collection(db, FIREBASE_COLLECTIONS.RECEIPTS), where('ownerId', '==', effectiveOwnerId));
    const unsubReceipts = onSnapshot(qReceipts, (snapshot) => {
      setReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Receipt)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, FIREBASE_COLLECTIONS.RECEIPTS, user.uid, user.email));

    const qExpenses = query(collection(db, FIREBASE_COLLECTIONS.EXPENSES), where('ownerId', '==', effectiveOwnerId));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, FIREBASE_COLLECTIONS.EXPENSES, user.uid, user.email));

    const qLayouts = query(collection(db, FIREBASE_COLLECTIONS.LAYOUTS), where('ownerId', '==', effectiveOwnerId));
    const unsubLayouts = onSnapshot(qLayouts, (snapshot) => {
      setReceiptLayout(snapshot.docs[0] ? snapshot.docs[0].data() as ReceiptLayout : null);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, FIREBASE_COLLECTIONS.LAYOUTS, user.uid, user.email);
      setLoading(false);
    });

    return () => { unsubPayments(); unsubReceipts(); unsubExpenses(); unsubLayouts(); };
  }, [user, effectiveOwnerId]);

  const loadArchivalYear = async (tenantId: string, year: number) => {
    if (!user || !effectiveOwnerId) return;
    try {
      const q = query(collection(db, FIREBASE_COLLECTIONS.PAYMENTS), where('tenantId', '==', tenantId), where('year', '==', year), where('ownerId', '==', effectiveOwnerId));
      const snaps = await getDocs(q);
      const archival = snaps.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
      setPayments(prev => {
        const ids = new Set(prev.map(p => p.id));
        return [...prev, ...archival.filter(p => !ids.has(p.id))];
      });
    } catch (e) {}
  };

  const markAsPaid = async (paymentId: string, datePaid: string, paymentMethod: PaymentMethod, paidAmount?: number, notes?: string, hasChequePhoto?: boolean) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      await runTransaction(db, async (transaction) => {
        const paymentRef = doc(db, FIREBASE_COLLECTIONS.PAYMENTS, paymentId);
        const paymentSnap = await transaction.get(paymentRef);
        if (!paymentSnap.exists()) return;
        const pData = paymentSnap.data() as Payment;
        const tRef = doc(db, FIREBASE_COLLECTIONS.TENANTS, pData.tenantId);
        const tSnap = await transaction.get(tRef);
        const finalAmount = paidAmount ?? pData.amount;

        transaction.update(paymentRef, { datePaid, paymentMethod, paidAmount: finalAmount, remainingBalance: pData.amount - finalAmount, receiptSequence: ((tSnap.data() as any).lastReceiptSequence || 0) + 1, hasChequePhoto: !!hasChequePhoto, notes: notes || pData.notes || "" });
        transaction.update(tRef, { totalPaid: increment(finalAmount), lastPaymentDate: datePaid, lastReceiptSequence: increment(1) });
        transaction.update(doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId), { totalCollected: increment(finalAmount), totalDue: increment(-finalAmount), lastUpdated: new Date().toISOString() });
      });
      triggerDataSync();
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, `payment_${paymentId}`, user.uid, user.email); }
  };

  const unmarkAsPaid = async (paymentId: string) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      await runTransaction(db, async (transaction) => {
        const pRef = doc(db, FIREBASE_COLLECTIONS.PAYMENTS, paymentId);
        const pSnap = await transaction.get(pRef);
        if (!pSnap.exists() || !(pSnap.data() as Payment).datePaid) return;
        const pData = pSnap.data() as Payment;
        const refund = pData.paidAmount ?? pData.amount;
        transaction.update(pRef, { datePaid: deleteField(), paymentMethod: deleteField(), receiptSequence: deleteField(), paidAmount: deleteField(), remainingBalance: deleteField() });
        transaction.update(doc(db, FIREBASE_COLLECTIONS.TENANTS, pData.tenantId), { totalPaid: increment(-refund) });
        transaction.update(doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId), { totalCollected: increment(-refund), lastUpdated: new Date().toISOString() });
      });
      triggerDataSync();
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, `revert_${paymentId}`, user.uid, user.email); }
  };

  const updatePaymentAmount = async (paymentId: string, amount: number) => {
     if (isReadOnly) return;
     await updateDoc(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, paymentId), { amount });
     triggerDataSync();
  };

  const updatePaymentNotes = async (paymentId: string, notes: string) => {
     if (isReadOnly) return;
     await updateDoc(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, paymentId), { notes });
     triggerDataSync();
  };

  const generateReceipt = async (paymentId: string): Promise<Receipt> => {
    const existing = receipts.find(r => r.paymentId === paymentId);
    if (existing) return existing;
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) throw new Error('Payment not found');
    const newR: Receipt = { id: uuidv4(), paymentId, tenantId: payment.tenantId, receiptNumber: Math.max(0, ...receipts.map(r => r.receiptNumber)) + 1, printedAt: new Date().toISOString(), ownerId: effectiveOwnerId! };
    await setDoc(doc(db, FIREBASE_COLLECTIONS.RECEIPTS, newR.id), newR);
    triggerDataSync();
    return newR;
  };

  const updateReceipt = async (id: string, updates: Partial<Receipt>) => {
    if (isReadOnly) return;
    await updateDoc(doc(db, FIREBASE_COLLECTIONS.RECEIPTS, id), updates);
    triggerDataSync();
  };

  const saveReceiptLayout = async (layout: Partial<ReceiptLayout>, bgFile?: File) => {
    if (isReadOnly || !effectiveOwnerId) return;
    let bgImage = layout.bgImage || receiptLayout?.bgImage;
    if (bgFile) {
      const reader = new FileReader();
      const base64 = await new Promise<string>((res, rej) => { reader.onload = () => res(reader.result as string); reader.onerror = rej; reader.readAsDataURL(bgFile); });
      await storeLocalReceiptTemplate(effectiveOwnerId, base64);
      bgImage = 'local:custom_template';
    }
    const data = { ...DEFAULT_RECEIPT_LAYOUT, ...receiptLayout, ...layout, bgImage, ownerId: effectiveOwnerId, lastUpdated: new Date().toISOString() };
    const q = query(collection(db, FIREBASE_COLLECTIONS.LAYOUTS), where('ownerId', '==', effectiveOwnerId));
    const snap = await getDocs(q);
    if (snap.empty) await addDoc(collection(db, FIREBASE_COLLECTIONS.LAYOUTS), data);
    else await updateDoc(doc(db, FIREBASE_COLLECTIONS.LAYOUTS, snap.docs[0].id), data);
    triggerDataSync();
  };

  const addExpense = async (expense: Omit<Expense, 'id' | 'createdAt' | 'ownerId'>) => {
    if (isReadOnly || !effectiveOwnerId) return;
    const id = uuidv4();
    await runTransaction(db, async (transaction) => {
      transaction.set(doc(db, FIREBASE_COLLECTIONS.EXPENSES, id), { ...expense, id, ownerId: effectiveOwnerId, createdAt: new Date().toISOString() });
      transaction.update(doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId), { totalExpenses: increment(expense.amount), lastUpdated: new Date().toISOString() });
    });
    triggerDataSync();
  };

  const updateExpense = async (id: string, expenseUpdate: Partial<Expense>) => {
    if (isReadOnly || !effectiveOwnerId) return;
    try {
      await runTransaction(db, async (transaction) => {
        const expenseRef = doc(db, FIREBASE_COLLECTIONS.EXPENSES, id);
        const expenseSnap = await transaction.get(expenseRef);
        if (!expenseSnap.exists()) return;
        
        const oldExpense = expenseSnap.data() as Expense;
        transaction.update(expenseRef, expenseUpdate);
        
        if (expenseUpdate.amount !== undefined && expenseUpdate.amount !== oldExpense.amount) {
          const statsRef = doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId);
          const statsSnap = await transaction.get(statsRef);
          if (statsSnap.exists()) {
            const diff = expenseUpdate.amount - oldExpense.amount;
            transaction.update(statsRef, {
              totalExpenses: increment(diff),
              lastUpdated: new Date().toISOString()
            });
          }
        }
      });
      triggerDataSync();
    } catch (e) {
      // Handle error
    }
  };

  const deleteExpense = async (id: string) => {
    const exp = expenses.find(e => e.id === id);
    if (!exp || isReadOnly || !effectiveOwnerId) return;
    await runTransaction(db, async (transaction) => {
      transaction.delete(doc(db, FIREBASE_COLLECTIONS.EXPENSES, id));
      transaction.update(doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId), { totalExpenses: increment(-exp.amount), lastUpdated: new Date().toISOString() });
    });
    triggerDataSync();
  };

  const fetchTenantPayments = async (tenantId: string, year: number) => {
    const q = query(collection(db, FIREBASE_COLLECTIONS.PAYMENTS), where('tenantId', '==', tenantId), where('year', '==', year), where('ownerId', '==', effectiveOwnerId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
  };

  const fetchAllTenantPayments = async (tenantId: string) => {
    const q = query(collection(db, FIREBASE_COLLECTIONS.PAYMENTS), where('tenantId', '==', tenantId), where('ownerId', '==', effectiveOwnerId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
  };

  const refreshTenantStats = async (tenantId: string) => {
    const q = query(collection(db, FIREBASE_COLLECTIONS.PAYMENTS), where('tenantId', '==', tenantId), where('ownerId', '==', effectiveOwnerId));
    const snap = await getDocs(q);
    const all = snap.docs.map(d => d.data() as Payment);
    const totalPaid = all.filter(p => !!p.datePaid).reduce((s, p) => s + (Number(p.paidAmount ?? p.amount) || 0), 0);
    const last = all.filter(p => !!p.datePaid).sort((a,b) => b.datePaid!.localeCompare(a.datePaid!))[0];
    await updateDoc(doc(db, FIREBASE_COLLECTIONS.TENANTS, tenantId), { totalPaid, lastPaymentDate: last?.datePaid || null });
  };

  const consolidatePayments = async (paymentIds: string[]) => {
    if (paymentIds.length === 0 || isReadOnly) return;
    await runTransaction(db, async (transaction) => {
      const first = await transaction.get(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, paymentIds[0]));
      if (!first.exists()) return;
      const tId = (first.data() as Payment).tenantId;
      const tSnap = await transaction.get(doc(db, FIREBASE_COLLECTIONS.TENANTS, tId));
      const nextSeq = ((tSnap.data() as any).lastReceiptSequence || 0) + 1;
      for (const pid of paymentIds) transaction.update(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, pid), { receiptSequence: nextSeq });
      transaction.update(doc(db, FIREBASE_COLLECTIONS.TENANTS, tId), { lastReceiptSequence: nextSeq });
    });
  };

  const payCustomMonths = async (tenantId: string, count: number, datePaid: string, method: PaymentMethod, notes?: string) => {
    if (isReadOnly || !effectiveOwnerId) return;
    await runTransaction(db, async (transaction) => {
      const tSnap = await transaction.get(doc(db, FIREBASE_COLLECTIONS.TENANTS, tenantId));
      if (!tSnap.exists()) return;
      const tData = tSnap.data() as any;
      const start = parseISO(tData.startDate);
      const end = subDays(addMonths(start, count), 1);
      const amount = tData.rentAmount * count;
      const id = `${tenantId}_${start.getFullYear()}_${format(start, 'yyyy-MM-dd')}`;
      const nextSeq = (tData.lastReceiptSequence || 0) + 1;
      transaction.set(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, id), { id, tenantId, year: start.getFullYear(), amount, datePaid, paymentMethod: method, periodStart: start.toISOString(), periodEnd: end.toISOString(), ownerId: effectiveOwnerId, createdAt: new Date().toISOString(), receiptSequence: nextSeq, notes: notes || `Custom ${count} Mo` });
      transaction.update(doc(db, FIREBASE_COLLECTIONS.TENANTS, tenantId), { startDate: addMonths(start, count).toISOString(), totalPaid: increment(amount), lastPaymentDate: datePaid, lastReceiptSequence: nextSeq });
      transaction.update(doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId), { totalCollected: increment(amount), lastUpdated: new Date().toISOString() });
    });
    triggerDataSync();
  };

  const individualizeUpcomingMonths = async (tenantId: string, count: number) => {
    if (isReadOnly || !effectiveOwnerId) return;
    const tSnap = await getDocs(query(collection(db, FIREBASE_COLLECTIONS.TENANTS), where('id', '==', tenantId)));
    const tenant = tSnap.docs[0]?.data() as Tenant;
    if (!tenant) return;
    const batch = writeBatch(db);
    let curr = startOfMonth(parseISO(tenant.startDate));
    for (let i = 0; i < count; i++) {
        const id = `${tenantId}_${curr.getFullYear()}_${format(curr, 'yyyy-MM-dd')}`;
        batch.set(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, id), { id, tenantId, year: curr.getFullYear(), amount: tenant.rentAmount, periodStart: curr.toISOString(), periodEnd: lastDayOfMonth(curr).toISOString(), ownerId: effectiveOwnerId, createdAt: new Date().toISOString() });
        curr = addMonths(curr, 1);
    }
    await batch.commit();
    triggerDataSync();
  };

  const ensureYearlyPayments = async (tenantId: string, year: number) => {
    const tRef = doc(db, FIREBASE_COLLECTIONS.TENANTS, tenantId);
    const tSnap = await getDocs(query(collection(db, FIREBASE_COLLECTIONS.TENANTS), where('id', '==', tenantId)));
    const tenant = tSnap.docs[0]?.data() as Tenant;
    if (!tenant) return;
    const generated = appLogicGenerate(tenant, year, effectiveOwnerId!);
    const batch = writeBatch(db);
    generated.forEach(p => batch.set(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, p.id), p));
    await batch.commit();
  };

  const getLatestUnpaidPayments = async (tenantId: string, count: number) => {
    const q = query(collection(db, FIREBASE_COLLECTIONS.PAYMENTS), where('tenantId', '==', tenantId), where('datePaid', '==', null), limit(count));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Payment).sort((a,b) => a.periodStart.localeCompare(b.periodStart));
  };

  const bulkMarkAsPaid = async (paymentIds: string[], datePaid: string, method: PaymentMethod, notes?: string, hasChequePhoto?: boolean) => {
     // Bulk transaction logic
     triggerDataSync();
  };

  const bulkUnmarkAsPaid = async (paymentIds: string[]) => {
     triggerDataSync();
  };

  const value = {
    payments, receipts, expenses, receiptLayout,
    loadArchivalYear, markAsPaid, unmarkAsPaid, updatePaymentAmount, updatePaymentNotes,
    generateReceipt, updateReceipt, saveReceiptLayout, addExpense, updateExpense, deleteExpense,
    fetchTenantPayments, fetchAllTenantPayments, refreshTenantStats, consolidatePayments,
    payCustomMonths, individualizeUpcomingMonths, ensureYearlyPayments, getLatestUnpaidPayments,
    bulkMarkAsPaid, bulkUnmarkAsPaid,
    loading
  };

  return <FinancialContext.Provider value={value}>{children}</FinancialContext.Provider>;
};

export const useFinancial = () => {
  const context = useContext(FinancialContext);
  if (context === undefined) throw new Error('useFinancial must be used within a FinancialProvider');
  return context;
};
