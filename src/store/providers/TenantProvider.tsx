import React, { useState, useEffect, createContext, useContext } from 'react';
import { Tenant, OperationType } from '../../types';
import { db } from '../../firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  getDocs,
  runTransaction
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { FIREBASE_COLLECTIONS } from '../../config/constants';
import { handleFirestoreError } from '../../utils/firestore';
import { generatePaymentsForYear } from '../AppLogic';

export interface TenantContextType {
  tenants: Tenant[];
  addTenant: (tenant: Omit<Tenant, 'id' | 'createdAt' | 'ownerId'>) => Promise<void>;
  updateTenant: (id: string, tenant: Partial<Tenant>, payments: any[], stats: any) => Promise<void>;
  deleteTenant: (id: string, effectiveOwnerId: string) => Promise<void>;
  loading: boolean;
}

export const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ 
  children: React.ReactNode;
  user: any;
  effectiveOwnerId: string | null;
  isReadOnly: boolean;
  triggerDataSync: () => void;
}> = ({ children, user, effectiveOwnerId, isReadOnly, triggerDataSync }) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !effectiveOwnerId) {
      setTenants([]);
      setLoading(false);
      return;
    }

    const qTenants = query(collection(db, FIREBASE_COLLECTIONS.TENANTS), where('ownerId', '==', effectiveOwnerId));
    const unsubTenants = onSnapshot(qTenants, (snapshot) => {
      const tenantsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tenant));
      setTenants(tenantsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, FIREBASE_COLLECTIONS.TENANTS, user.uid, user.email);
      setLoading(false);
    });

    return () => unsubTenants();
  }, [user, effectiveOwnerId]);

  const addTenant = async (tenant: Omit<Tenant, 'id' | 'createdAt' | 'ownerId'>) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    const id = uuidv4();
    const newTenant = { 
      ...tenant, 
      id: id,
      tenantStatus: tenant.tenantStatus || 'active', 
      ownerId: effectiveOwnerId, 
      createdAt: new Date().toISOString(),
      lastReceiptSequence: 0
    } as Tenant;

    try {
      const { writeBatch: firestoreWriteBatch } = await import('firebase/firestore');
      const batch = firestoreWriteBatch(db);
      
      batch.set(doc(db, FIREBASE_COLLECTIONS.TENANTS, id), newTenant);
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const { parseISO, isValid } = await import('date-fns');
      const start = parseISO(newTenant.startDate);
      const startYear = isValid(start) ? start.getFullYear() : currentYear;
      const actualStartYear = Math.max(startYear, currentYear - 10);
      
      for (let y = actualStartYear; y <= currentYear; y++) {
        const generated = generatePaymentsForYear(newTenant, y, effectiveOwnerId);
        for (const payment of generated) {
          batch.set(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, payment.id), payment);
        }
      }

      await batch.commit();
      triggerDataSync();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${FIREBASE_COLLECTIONS.TENANTS}/${id}`, user.uid, user.email);
    }
  };

  const updateTenant = async (id: string, tenantUpdates: Partial<Tenant>, payments: any[], globalStats: any) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      const existingTenant = tenants.find(t => t.id === id);
      if (!existingTenant) return;

      const { getCycleMonths } = await import('../AppLogic');
      const isRentChanging = tenantUpdates.rentAmount !== undefined || tenantUpdates.paymentCycle !== undefined;
      const finalRentAmount = tenantUpdates.rentAmount !== undefined ? tenantUpdates.rentAmount : existingTenant.rentAmount;
      const finalPaymentCycle = tenantUpdates.paymentCycle !== undefined ? tenantUpdates.paymentCycle : existingTenant.paymentCycle;

      const oldCalculated = existingTenant.rentAmount * getCycleMonths(existingTenant.paymentCycle);
      const newCalculated = finalRentAmount * getCycleMonths(finalPaymentCycle);
      const deltaPerPayment = newCalculated - oldCalculated;

      await runTransaction(db, async (transaction) => {
        const tenantRef = doc(db, FIREBASE_COLLECTIONS.TENANTS, id);
        const statsRef = doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId);
        const statsSnap = await transaction.get(statsRef);

        transaction.update(tenantRef, tenantUpdates);

        if (isRentChanging && deltaPerPayment !== 0) {
          const unpaidPayments = payments.filter(p => p.tenantId === id && !p.datePaid);
          const { increment: firestoreIncrement } = await import('firebase/firestore');
          const totalDelta = deltaPerPayment * unpaidPayments.length;

          unpaidPayments.forEach(p => {
            transaction.update(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, p.id), { amount: newCalculated });
          });

          if (statsSnap.exists()) {
            transaction.update(statsRef, {
              totalDue: firestoreIncrement(totalDelta),
              lastUpdated: new Date().toISOString()
            });
          }
        }
      });
      triggerDataSync();
    } catch (error) { handleFirestoreError(error, OperationType.UPDATE, `${FIREBASE_COLLECTIONS.TENANTS}/${id}`, user.uid, user.email); }
  };

  const deleteTenant = async (id: string, ownerId: string) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      const q = query(
        collection(db, FIREBASE_COLLECTIONS.PAYMENTS), 
        where('tenantId', '==', id), 
        where('ownerId', '==', effectiveOwnerId)
      );
      const [paymentsSnap, receiptsSnap] = await Promise.all([
        getDocs(q),
        getDocs(query(collection(db, FIREBASE_COLLECTIONS.RECEIPTS), where('tenantId', '==', id)))
      ]);

      const tenantPayments = paymentsSnap.docs.map(d => d.data() as any);
      const amountToDeductCollected = tenantPayments
        .filter(p => !!p.datePaid)
        .reduce((sum, p) => sum + (Number(p.paidAmount ?? p.amount) || 0), 0);
      
      const amountToDeductDue = tenantPayments.reduce((sum, p) => {
        if (!p.datePaid) return sum + (Number(p.amount) || 0);
        return sum + (Number(p.remainingBalance) || 0);
      }, 0);

      await runTransaction(db, async (transaction) => {
        const tenantRef = doc(db, FIREBASE_COLLECTIONS.TENANTS, id);
        const statsRef = doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId);
        
        const [tenantSnap, statsSnap] = await Promise.all([
          transaction.get(tenantRef),
          transaction.get(statsRef)
        ]);

        if (!tenantSnap.exists()) return;

        transaction.delete(tenantRef);
        for (const pDoc of paymentsSnap.docs) transaction.delete(pDoc.ref);
        for (const rDoc of receiptsSnap.docs) transaction.delete(rDoc.ref);

        if (statsSnap.exists()) {
          const statsData = statsSnap.data() as any;
          transaction.update(statsRef, {
            totalCollected: Math.max(0, (statsData.totalCollected || 0) - amountToDeductCollected),
            totalDue: Math.max(0, (statsData.totalDue || 0) - amountToDeductDue),
            lastUpdated: new Date().toISOString()
          });
        }
      });
      triggerDataSync();
    } catch (error) { handleFirestoreError(error, OperationType.DELETE, `${FIREBASE_COLLECTIONS.TENANTS}/${id}`, user.uid, user.email); }
  };

  const value = {
    tenants,
    addTenant,
    updateTenant,
    deleteTenant,
    loading
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenants = () => {
  const context = useContext(TenantContext);
  if (context === undefined) throw new Error('useTenants must be used within a TenantProvider');
  return context;
};
