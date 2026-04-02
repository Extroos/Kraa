import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Property, Tenant, Payment, TenantWithStatus, PaymentStatus, PaymentMethod, Receipt, GlobalStats, ReceiptLayout, Expense, LandlordAccess, PropertyFolder } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { 
  format, 
  addMonths, 
  startOfDay,
  isBefore, 
  parseISO, 
  addDays, 
  subDays,
  isValid,
  differenceInDays,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { db, auth, storage } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  getDoc, 
  runTransaction, 
  getDocs, 
  deleteField, 
  limit,
  addDoc,
  increment
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  isNativeMobile, 
  getLocalChequeImage, 
  storeLocalChequeImage,
  storeLocalReceiptTemplate 
} from '../utils/localImage';
import { useAuth } from './AuthContext';
import { FIREBASE_COLLECTIONS } from '../config/constants';
import { OperationType } from '../types';
import { handleFirestoreError } from '../utils/firestore';
import { AppState, getCycleMonths, generatePaymentsForYear } from './AppLogic';
import { AppContext } from './AppContextContent';
import { cleanupPropertyAssets } from '../utils/storageUtils';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, effectiveOwnerId, isReadOnly, canManageAccess, restrictedTenantId } = useAuth();
  const [state, setState] = useState<AppState>({ 
    properties: [], 
    tenants: [], 
    payments: [], 
    receipts: [], 
    expenses: [],
    globalStats: null,
    receiptLayout: null,
    authorizedLandlords: [],
    folders: [],
    syncCounter: 0,
    additionalPayments: [],
  });
  const [loading, setLoading] = useState(true);
  const cleanupRun = useRef(false);
  const sessionTrackedRef = useRef<string | null>(null);

  const triggerDataSync = useCallback(() => {
    cleanupRun.current = false;
    setState(prev => ({ ...prev, syncCounter: prev.syncCounter + 1 }));
  }, [setState]);

  useEffect(() => {
    if (!user || !effectiveOwnerId) {
      if (!user) {
        setState({ 
          properties: [], 
          tenants: [], 
          payments: [], 
          receipts: [], 
          expenses: [],
          globalStats: null,
          receiptLayout: null,
          authorizedLandlords: [],
          folders: [],
          syncCounter: 0,
          additionalPayments: [],
        });
        cleanupRun.current = false;
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    const qProperties = query(collection(db, FIREBASE_COLLECTIONS.PROPERTIES), where('ownerId', '==', effectiveOwnerId));
    const unsubProperties = onSnapshot(qProperties, (snapshot) => {
      const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      setState(prev => ({ ...prev, properties }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, FIREBASE_COLLECTIONS.PROPERTIES, user.uid, user.email));

    const qTenants = query(collection(db, FIREBASE_COLLECTIONS.TENANTS), where('ownerId', '==', effectiveOwnerId));
    const unsubTenants = onSnapshot(qTenants, (snapshot) => {
      const tenants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tenant));
      setState(prev => ({ ...prev, tenants }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, FIREBASE_COLLECTIONS.TENANTS, user.uid, user.email));

    const qReceipts = query(collection(db, FIREBASE_COLLECTIONS.RECEIPTS), where('ownerId', '==', effectiveOwnerId));
    const unsubReceipts = onSnapshot(qReceipts, (snapshot) => {
      const receipts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Receipt));
      setState(prev => ({ ...prev, receipts }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, FIREBASE_COLLECTIONS.RECEIPTS, user.uid, user.email));

    const currentYear = new Date().getFullYear();
    const qPayments = query(
      collection(db, FIREBASE_COLLECTIONS.PAYMENTS), 
      where('ownerId', '==', effectiveOwnerId),
      where('year', '>=', currentYear - 1) // Optimization: Only sync current and previous year by default
    );
    const unsubPayments = onSnapshot(qPayments, (snapshot) => {
      const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
      setState(prev => ({ ...prev, payments }));
    }, (error) => {
      if (error.code === 'failed-precondition') {
        console.error("Firestore Index Missing! Create it here: https://console.firebase.google.com/v1/r/project/nazih-kra/firestore/indexes?create_composite=Ckpwcm9qZWN0cy9uYXppaC1rcmEvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3BheW1lbnRzL2luZGV4ZXMvXxABGgsKB293bmVySWQQARoICgR5ZWFyEAEaDAoIX19uYW1lX18QAQ");
      }
      handleFirestoreError(error, OperationType.LIST, FIREBASE_COLLECTIONS.PAYMENTS, user.uid, user.email);
    });

    const qStats = query(collection(db, FIREBASE_COLLECTIONS.STATS), where('ownerId', '==', effectiveOwnerId));
    const unsubStats = onSnapshot(qStats, (snapshot) => {
      const statsDoc = snapshot.docs.find(d => d.id === effectiveOwnerId || d.id === 'current');
      setState(prev => ({ ...prev, globalStats: statsDoc ? statsDoc.data() as GlobalStats : null }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, FIREBASE_COLLECTIONS.STATS, user.uid, user.email));

    const qLayouts = query(collection(db, FIREBASE_COLLECTIONS.LAYOUTS), where('ownerId', '==', effectiveOwnerId));
    const unsubLayouts = onSnapshot(qLayouts, (snapshot) => {
      const layoutDoc = snapshot.docs[0];
      setState(prev => ({ ...prev, receiptLayout: layoutDoc ? layoutDoc.data() as ReceiptLayout : null }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, FIREBASE_COLLECTIONS.LAYOUTS, user.uid, user.email));

    const qExpenses = query(collection(db, FIREBASE_COLLECTIONS.EXPENSES), where('ownerId', '==', effectiveOwnerId));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      setState(prev => ({ ...prev, expenses }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, FIREBASE_COLLECTIONS.EXPENSES, user.uid, user.email));

    const qFolders = query(collection(db, FIREBASE_COLLECTIONS.FOLDERS), where('ownerId', '==', effectiveOwnerId));
    const unsubFolders = onSnapshot(qFolders, (snapshot) => {
      const folders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PropertyFolder));
      setState(prev => ({ ...prev, folders }));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, FIREBASE_COLLECTIONS.FOLDERS, user.uid, user.email);
      setLoading(false);
    });

    // Landlord Access Management (Only for Owners)
    let unsubLandlords = () => {};
    if (!isReadOnly) {
      const qLandlords = query(
        collection(db, FIREBASE_COLLECTIONS.LANDLORD_ACCESS), 
        where('ownerId', '==', user.uid),
        // Index Fix: Remove isRevoked filter to avoid composite index requirement
      );
      unsubLandlords = onSnapshot(qLandlords, (snapshot) => {
        const authorizedLandlords = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as LandlordAccess))
          .filter(acc => !acc.isRevoked); // Index Fix: filter in JS
        setState(prev => ({ ...prev, authorizedLandlords }));
      }, (error) => handleFirestoreError(error, OperationType.LIST, FIREBASE_COLLECTIONS.LANDLORD_ACCESS, user.uid, user.email));
    }

    return () => {
      unsubProperties();
      unsubTenants();
      unsubReceipts();
      unsubPayments();
      unsubStats();
      unsubLayouts();
      unsubExpenses();
      unsubFolders();
      unsubLandlords();
    };
  }, [user, effectiveOwnerId]); // No need for reactive here, useMemo handles it now!

  // HIGH STABILITY: Reactive Filtered State (Primary Logic Engine)
  const filteredState = useMemo(() => {
    let { properties, tenants, payments, receipts, globalStats, expenses, additionalPayments, ...rest } = state;

    // A. Merge Archival Payments (Deduplicate)
    const allPayments = [...payments, ...(additionalPayments || [])];
    payments = Array.from(new Map(allPayments.map(p => [p.id, p])).values());

    // 1. Context Isolation (Restricted Tenant Mode)
    if (restrictedTenantId) {
      // A. Isolate Tenants (Only see themselves)
      tenants = tenants.filter(t => t.id === restrictedTenantId);
      
      // B. Isolate Properties (Only see the property they belong to)
      const personalTenant = tenants[0];
      if (personalTenant) {
        const pid = personalTenant.propertyId;
        properties = properties.filter(p => p.id === pid);
      } else {
        // Fallback: If tenant list is loaded but restricted ID is not found,
        // it means either loading or unauthorized. Hide properties to be safe.
        if (state.tenants.length > 0) properties = [];
      }

      // C. Isolate Financials
      payments = payments.filter(p => p.tenantId === restrictedTenantId);
      receipts = receipts.filter(r => r.tenantId === restrictedTenantId);
      
      // D. Total Privacy Suppression
      globalStats = null;
      expenses = [];
    }

    return { properties, tenants, payments, receipts, globalStats, expenses, additionalPayments, ...rest };
  }, [state, restrictedTenantId, role]);

  useEffect(() => {
    if (!user || isReadOnly || state.tenants.length === 0) return;

    const runCleanupAndGenerate = async () => {
      if (!effectiveOwnerId || cleanupRun.current || state.tenants.length === 0 || state.payments.length === 0) return;
      cleanupRun.current = true;
      
      // 1. Cleanup Duplicates (Batched for Quota Efficiency)
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      let needsCommit = false;

      const paymentsByPeriod = new Map<string, Payment[]>();
      state.payments.forEach(p => {
        const s = parseISO(p.periodStart);
        if (!isValid(s)) return;
        const periodStr = format(s, 'yyyy-MM-dd');
        const key = `${p.tenantId}_${p.year}_${periodStr}`;
        if (!paymentsByPeriod.has(key)) paymentsByPeriod.set(key, []);
        paymentsByPeriod.get(key)!.push(p);
      });

      for (const [key, group] of paymentsByPeriod.entries()) {
        if (group.length > 1) {
          group.sort((a, b) => {
            if (a.datePaid && !b.datePaid) return -1;
            if (!a.datePaid && b.datePaid) return 1;
            const timeA = new Date(a.createdAt).getTime() || 0;
            const timeB = new Date(b.createdAt).getTime() || 0;
            return timeB - timeA;
          });
          const toKeep = group[0];
          const toDelete = group.slice(1);
          
          toDelete.forEach(p => {
            batch.delete(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, p.id));
            needsCommit = true;
          });

          if (toKeep.id !== key) {
            batch.set(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, key), { ...toKeep, id: key });
            batch.delete(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, toKeep.id));
            needsCommit = true;
          }
        } else if (group.length === 1 && group[0].id !== key) {
          const p = group[0];
          batch.set(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, key), { ...p, id: key });
          batch.delete(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, p.id));
          needsCommit = true;
        }
      }

      if (needsCommit) {
        await batch.commit();
        triggerDataSync();
      }

      // 2. Generate Missing Payments for Tenure-Aware Timeline
      const now = new Date();
      const currentYear = now.getFullYear();
      const prepNextYear = now.getMonth() >= 8; 
      
      for (const tenant of state.tenants) {
        if (tenant.tenantStatus === 'archived' || !tenant.startDate) continue;
        
        const start = parseISO(tenant.startDate);
        if (!isValid(start)) continue;
        
        const startYear = start.getFullYear();
        const yearsToGenerate: number[] = [];
        
        // SAFE BACKGROUND SYNC: Only auto-generate for years currently in our local sync snapshot (currentYear and previous)
        // This prevents infinite generation cycles for older data not in the current snapshot
        const syncRangeStart = currentYear - 1;
        const targetEndYear = prepNextYear ? currentYear + 1 : currentYear;
        const checkStartYear = Math.max(startYear, syncRangeStart);
        
        for (let y = checkStartYear; y <= targetEndYear; y++) {
          const hasYear = state.payments.some(p => p.tenantId === tenant.id && p.year === y);
          if (!hasYear) {
            yearsToGenerate.push(y);
          }
        }

        if (yearsToGenerate.length > 0) {
          const { writeBatch } = await import('firebase/firestore');
          const batch = writeBatch(db);
          let addedCount = 0;

          for (const year of yearsToGenerate) {
            const generated = generatePaymentsForYear(tenant, year, effectiveOwnerId, state.payments);
            for (const payment of generated) {
              const docRef = doc(db, FIREBASE_COLLECTIONS.PAYMENTS, payment.id);
              batch.set(docRef, payment, { merge: true });
              addedCount++;
            }
          }

          if (addedCount > 0) {
            try { await batch.commit(); } catch (error) { console.error(`Batch payment generation for tenant ${tenant.id} failed:`, error); }
          }
        }
      }
    };
    runCleanupAndGenerate();
  }, [state.tenants, state.payments, user, isReadOnly, effectiveOwnerId]);

  const uploadPropertyImage = async (propertyId: string, file: File): Promise<string> => {
    const storageRef = ref(storage, `properties/${propertyId}/${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const addProperty = async (property: Omit<Property, 'id' | 'createdAt' | 'ownerId'>, imageFile?: File) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    const id = uuidv4();
    let imageUrl = '';
    
    try {
      if (imageFile) {
        imageUrl = await uploadPropertyImage(id, imageFile);
      }
      
      const newProperty = { 
        ...property, 
        id: id,
        imageUrl, 
        ownerId: effectiveOwnerId, 
        createdAt: new Date().toISOString() 
      };
      await setDoc(doc(db, FIREBASE_COLLECTIONS.PROPERTIES, id), newProperty);
      
      // CRITICAL FIX: Refresh local state so it appears immediately
      triggerDataSync();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${FIREBASE_COLLECTIONS.PROPERTIES}/${id}`, user.uid, user.email);
    }
  };

  const updateProperty = async (id: string, property: Partial<Property>, imageFile?: File) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      const updateData: any = { ...property };
      
      if (imageFile) {
        updateData.imageUrl = await uploadPropertyImage(id, imageFile);
      }
      
      // Remove any undefined values to prevent Firestore errors
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });
      
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.PROPERTIES, id), updateData);
      
      // CRITICAL FIX: Refresh local state so it appears immediately
      triggerDataSync();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${FIREBASE_COLLECTIONS.PROPERTIES}/${id}`, user.uid, user.email);
    }
  };

  const deleteProperty = async (id: string) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      // 1. GATHER ALL TARGET REFS (Pre-fetch for safe cleanup)
      const propertyTenants = state.tenants.filter(t => t.propertyId === id);
      const tenantIds = propertyTenants.map(t => t.id);
      
      const propertyExpenses = state.expenses.filter(e => e.propertyId === id);
      const expenseAmount = propertyExpenses.reduce((sum, e) => sum + e.amount, 0);

      const [paymentsSnap, receiptsSnap] = await Promise.all([
        tenantIds.length > 0 
          ? getDocs(query(collection(db, FIREBASE_COLLECTIONS.PAYMENTS), where('ownerId', '==', effectiveOwnerId), where('tenantId', 'in', tenantIds)))
          : Promise.resolve({ docs: [] }),
        tenantIds.length > 0
          ? getDocs(query(collection(db, FIREBASE_COLLECTIONS.RECEIPTS), where('ownerId', '==', effectiveOwnerId), where('tenantId', 'in', tenantIds)))
          : Promise.resolve({ docs: [] })
      ]);

      const relevantPayments = paymentsSnap.docs.map(doc => doc.data() as Payment);
      const totalCollected = relevantPayments
        .filter(p => !!p.datePaid)
        .reduce((sum, p) => sum + (Number(p.paidAmount ?? p.amount) || 0), 0);
      
      const totalDue = relevantPayments.reduce((sum, p) => {
        if (!p.datePaid) return sum + (Number(p.amount) || 0);
        return sum + (Number(p.remainingBalance) || 0);
      }, 0);

      // 2. BATCHED DELETION (Handles > 500 doc limits)
      const { writeBatch } = await import('firebase/firestore');
      const allRefs = [
        doc(db, FIREBASE_COLLECTIONS.PROPERTIES, id),
        ...tenantIds.map(tid => doc(db, FIREBASE_COLLECTIONS.TENANTS, tid)),
        ...paymentsSnap.docs.map(d => d.ref),
        ...receiptsSnap.docs.map(d => d.ref),
        ...propertyExpenses.map(e => doc(db, FIREBASE_COLLECTIONS.EXPENSES, e.id))
      ];

      // Split into chunks of 450 (safe buffer for Firestore 500 limit)
      for (let i = 0; i < allRefs.length; i += 450) {
        const batch = writeBatch(db);
        const chunk = allRefs.slice(i, i + 450);
        chunk.forEach(ref => batch.delete(ref));
        
        // On the first batch, also update global stats to maintain integrity
        if (i === 0) {
          const statsRef = doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId);
          batch.update(statsRef, {
            totalCollected: increment(-totalCollected),
            totalDue: increment(-totalDue),
            totalExpenses: increment(-expenseAmount),
            lastUpdated: new Date().toISOString()
          });
        }
        await batch.commit();
      }
      
      // 3. STORAGE CLEANUP
      await cleanupPropertyAssets(id);
      triggerDataSync();
    } catch (error) { handleFirestoreError(error, OperationType.DELETE, `${FIREBASE_COLLECTIONS.PROPERTIES}/${id}`, user.uid, user.email); }
  };

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
      // CRITICAL FIX: Use writeBatch for atomic tenant + first-year payments creation
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      // 1. Add Tenant document
      batch.set(doc(db, FIREBASE_COLLECTIONS.TENANTS, id), newTenant);
      
      // 2. Generate initial payments (Tenure-Aware)
      const now = new Date();
      const currentYear = now.getFullYear();
      const start = parseISO(newTenant.startDate);
      const startYear = isValid(start) ? start.getFullYear() : currentYear;
      
      // Limit generation to last 10 years to stay within batch sizes and reasonable history
      const actualStartYear = Math.max(startYear, currentYear - 10);
      
      for (let y = actualStartYear; y <= currentYear; y++) {
        const generated = generatePaymentsForYear(newTenant, y, effectiveOwnerId);
        for (const payment of generated) {
          batch.set(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, payment.id), payment);
        }
      }

      await batch.commit();

      // 3. Refresh local state
      triggerDataSync();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${FIREBASE_COLLECTIONS.TENANTS}/${id}`, user.uid, user.email);
    }
  };

  const updateTenant = async (id: string, tenant: Partial<Tenant>) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      // 1. GATHER DELTA CONTEXT
      const existingTenant = state.tenants.find(t => t.id === id);
      if (!existingTenant) return;

      const isRentChanging = tenant.rentAmount !== undefined || tenant.paymentCycle !== undefined;
      const finalRentAmount = tenant.rentAmount !== undefined ? tenant.rentAmount : existingTenant.rentAmount;
      const finalPaymentCycle = tenant.paymentCycle !== undefined ? tenant.paymentCycle : existingTenant.paymentCycle;

      const oldCalculated = existingTenant.rentAmount * getCycleMonths(existingTenant.paymentCycle);
      const newCalculated = finalRentAmount * getCycleMonths(finalPaymentCycle);
      const deltaPerPayment = newCalculated - oldCalculated;

      // 2. ATOMIC UPDATE
      await runTransaction(db, async (transaction) => {
        const tenantRef = doc(db, FIREBASE_COLLECTIONS.TENANTS, id);
        const statsRef = doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId);
        const statsSnap = await transaction.get(statsRef);

        // A. Update Tenant
        transaction.update(tenantRef, tenant);

        // B. Update Payments & Stats if rent changed
        if (isRentChanging && deltaPerPayment !== 0) {
          const unpaidPayments = state.payments.filter(p => p.tenantId === id && !p.datePaid);
          const totalDelta = deltaPerPayment * unpaidPayments.length;

          unpaidPayments.forEach(p => {
            transaction.update(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, p.id), { amount: newCalculated });
          });

          if (statsSnap.exists()) {
            transaction.update(statsRef, {
              totalDue: increment(totalDelta),
              lastUpdated: new Date().toISOString()
            });
          }
        }
      });
    } catch (error) { handleFirestoreError(error, OperationType.UPDATE, `${FIREBASE_COLLECTIONS.TENANTS}/${id}`, user.uid, user.email); }
  };

  const deleteTenant = async (id: string) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      // Step 1: Pre-fetch all related data
      const q = query(
        collection(db, FIREBASE_COLLECTIONS.PAYMENTS), 
        where('tenantId', '==', id), 
        where('ownerId', '==', effectiveOwnerId)
      );
      const [paymentsSnap, receiptsSnap] = await Promise.all([
        getDocs(q),
        getDocs(query(collection(db, FIREBASE_COLLECTIONS.RECEIPTS), where('tenantId', '==', id)))
      ]);

      const tenantPayments = paymentsSnap.docs.map(d => d.data() as Payment);
      const amountToDeductCollected = tenantPayments
        .filter(p => !!p.datePaid)
        .reduce((sum, p) => sum + (Number(p.paidAmount ?? p.amount) || 0), 0);
      
      const amountToDeductDue = tenantPayments.reduce((sum, p) => {
        if (!p.datePaid) return sum + (Number(p.amount) || 0);
        return sum + (Number(p.remainingBalance) || 0);
      }, 0);

      // Step 2: Atomic Transaction for consistent cleanup
      await runTransaction(db, async (transaction) => {
        const tenantRef = doc(db, FIREBASE_COLLECTIONS.TENANTS, id);
        const statsRef = doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId);
        
        // 1. ALL READS FIRST
        const [tenantSnap, statsSnap] = await Promise.all([
          transaction.get(tenantRef),
          transaction.get(statsRef)
        ]);

        if (!tenantSnap.exists()) return;

        // 2. ALL WRITES AFTER (Atomic Cleanup)
        transaction.delete(tenantRef);
        
        // Delete all payments
        for (const pDoc of paymentsSnap.docs) {
          transaction.delete(pDoc.ref);
        }

        // Delete all receipts
        for (const rDoc of receiptsSnap.docs) {
          transaction.delete(rDoc.ref);
        }

        // Update Global Stats with TWO Deltas
        if (statsSnap.exists()) {
          const statsData = statsSnap.data() as GlobalStats;
          transaction.update(statsRef, {
            totalCollected: Math.max(0, (statsData.totalCollected || 0) - amountToDeductCollected),
            totalDue: Math.max(0, (statsData.totalDue || 0) - amountToDeductDue),
            lastUpdated: new Date().toISOString()
          });
        }
      });
      
      // Cleanup assets from Storage (Cheque photos)
      // TODO: Link with new storage utility in next step
    } catch (error) { handleFirestoreError(error, OperationType.DELETE, `${FIREBASE_COLLECTIONS.TENANTS}/${id}`, user.uid, user.email); }
  };

  const ensureYearlyPayments = useCallback(async (tenantId: string, year: number) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    const tenant = state.tenants.find(t => t.id === tenantId);
    if (!tenant) return;
    
    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      const generated = generatePaymentsForYear(tenant, year, effectiveOwnerId, state.payments);
      
      if (generated.length === 0) return;
      
      const existingIds = new Set(state.payments.filter(p => p.tenantId === tenantId && p.year === year).map(p => p.id));
      let added = 0;
      
      for (const payment of generated) {
        if (!existingIds.has(payment.id)) {
          batch.set(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, payment.id), payment);
          added++;
        }
      }
      
      if (added > 0) {
        await batch.commit();
        triggerDataSync();
      }
    } catch (error) { handleFirestoreError(error, OperationType.CREATE, FIREBASE_COLLECTIONS.PAYMENTS, user.uid, user.email); }
  }, [state.tenants, state.payments, user, isReadOnly, effectiveOwnerId, state.syncCounter]);

  const markAsPaid = async (paymentId: string, datePaid: string, paymentMethod: PaymentMethod, paidAmount?: number, notes?: string, hasChequePhoto?: boolean) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      await runTransaction(db, async (transaction) => {
        const paymentRef = doc(db, FIREBASE_COLLECTIONS.PAYMENTS, paymentId);
        const paymentSnap = await transaction.get(paymentRef);
        
        const tenantId = paymentSnap.exists() ? (paymentSnap.data() as Payment).tenantId : paymentId.split('_')[0];
        const tenantRef = doc(db, FIREBASE_COLLECTIONS.TENANTS, tenantId);
        const statsRef = doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId);

        const [tenantSnap, statsSnap] = await Promise.all([
          transaction.get(tenantRef),
          transaction.get(statsRef)
        ]);

        if (!tenantSnap.exists()) throw new Error("Tenant record missing - critical linkage error");

        let payment: Payment;
        if (!paymentSnap.exists()) {
          const parts = paymentId.split('_');
          const year = parseInt(parts[1], 10);
          const periodStart = parts[2];
          const tenantData = tenantSnap.data() as Tenant;
          
          const start = parseISO(periodStart);
          const cycleMonths = getCycleMonths(tenantData.paymentCycle);
          const periodEnd = addMonths(start, cycleMonths).toISOString();

          payment = {
            id: paymentId,
            tenantId,
            amount: tenantData.rentAmount,
            periodStart,
            periodEnd,
            year,
            ownerId: user.uid,
            createdAt: new Date().toISOString(),
          };

          transaction.set(paymentRef, { ...payment, datePaid, paymentMethod, notes: notes || "" });
        } else {
          payment = paymentSnap.data() as Payment;
        }

        // Stable Receipt Sequencing
        const activeTenantData = tenantSnap.data() as Tenant;
        let lastSeq = activeTenantData.lastReceiptSequence || 0;
        
        const existingPayment = paymentSnap.exists() ? paymentSnap.data() as Payment : null;
        let nextSequence = existingPayment?.receiptSequence;

        if (!nextSequence) {
          if (lastSeq === 0) {
            const tenantPaidPayments = state.payments.filter(p => p.tenantId === tenantId && p.datePaid);
            const existingSequences = tenantPaidPayments.map(p => p.receiptSequence).filter(s => s !== undefined) as number[];
            lastSeq = Math.max(...existingSequences, 0);
          }
          nextSequence = lastSeq + 1;
        }

        const finalPaidAmount = paidAmount ?? payment.amount;
        const remainingBalance = payment.amount - finalPaidAmount;

        transaction.update(paymentRef, { 
          datePaid, 
          paymentMethod, 
          paidAmount: finalPaidAmount,
          remainingBalance,
          notes: notes !== undefined ? notes : (payment.notes || ""), 
          receiptSequence: nextSequence,
          hasChequePhoto: hasChequePhoto || false
        });

        transaction.update(tenantRef, {
          totalPaid: increment(finalPaidAmount),
          balanceDue: increment(-finalPaidAmount),
          lastPaymentDate: datePaid,
          lastReceiptSequence: Math.max(activeTenantData.lastReceiptSequence || 0, nextSequence)
        });

        if (statsSnap.exists()) {
          transaction.update(statsRef, {
            totalCollected: increment(finalPaidAmount),
            totalDue: increment(-finalPaidAmount),
            lastUpdated: new Date().toISOString()
          });
        } else {
          transaction.set(statsRef, { id: effectiveOwnerId, totalCollected: finalPaidAmount, totalDue: -finalPaidAmount, lastUpdated: new Date().toISOString(), ownerId: effectiveOwnerId });
        }
      });

      // TRIGGER: Smart Payment-Linked Next Year Preparation
      // If paying for a late-year month (Sept-Dec), ensure next year is ready
      const paymentParts = paymentId.split('_');
      if (paymentParts.length >= 3) {
        const tId = paymentParts[0];
        const pYear = parseInt(paymentParts[1], 10);
        const pMonth = parseISO(paymentParts[2]).getMonth();
        if (pMonth >= 8) { // If Sept-Dec
          ensureYearlyPayments(tId, pYear + 1);
        }
      }
    } catch (error) { handleFirestoreError(error, OperationType.UPDATE, `${FIREBASE_COLLECTIONS.PAYMENTS}/${paymentId}`, user.uid, user.email); }
  };

  const updatePaymentNotes = async (paymentId: string, notes: string) => {
    if (!user || isReadOnly) return;
    try { await updateDoc(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, paymentId), { notes }); }
    catch (error) { handleFirestoreError(error, OperationType.UPDATE, `${FIREBASE_COLLECTIONS.PAYMENTS}/${paymentId}`, user.uid, user.email); }
  };

  const recalculateAllStats = async () => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);

      // 1. Fetch ALL payments and expenses for the ground truth
      const [paySnap, expSnap] = await Promise.all([
        getDocs(query(collection(db, FIREBASE_COLLECTIONS.PAYMENTS), where('ownerId', '==', effectiveOwnerId))),
        getDocs(query(collection(db, FIREBASE_COLLECTIONS.EXPENSES), where('ownerId', '==', effectiveOwnerId)))
      ]);

      const allPayments = paySnap.docs.map(doc => doc.data() as Payment);
      const allExpenses = expSnap.docs.map(doc => doc.data() as Expense);
      
      const totalCollected = allPayments
        .filter(p => !!p.datePaid)
        .reduce((sum, p) => sum + (Number(p.paidAmount ?? p.amount) || 0), 0);

      const totalDue = allPayments.reduce((sum, p) => {
        if (!p.datePaid) return sum + (Number(p.amount) || 0);
        return sum + (Number(p.remainingBalance) || 0);
      }, 0);

      const totalExpenses = allExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

      // 2. Global Stats Update in Batch
      batch.set(doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId), { 
        id: effectiveOwnerId, totalCollected, totalDue, totalExpenses,
        lastUpdated: new Date().toISOString(), ownerId: effectiveOwnerId 
      });

      // 3. Batch Update Tenants
      const activeTenantIds = new Set(state.tenants.map(t => t.id));
      for (const tenant of state.tenants) {
        const tenantPayments = allPayments.filter(p => p.tenantId === tenant.id && !!p.datePaid);
        const tenantTotalPaid = tenantPayments.reduce((sum, p) => sum + (Number(p.paidAmount ?? p.amount) || 0), 0);
        const lastPayment = tenantPayments.sort((a,b) => new Date(b.datePaid!).getTime() - new Date(a.datePaid!).getTime())[0];
        
        const tenantUnpaidPayments = allPayments.filter(p => p.tenantId === tenant.id);
        const tenantBalanceDue = tenantUnpaidPayments.reduce((sum, p) => {
          if (!p.datePaid) return sum + (Number(p.amount) || 0);
          return sum + (Number(p.remainingBalance) || 0);
        }, 0);

        batch.update(doc(db, FIREBASE_COLLECTIONS.TENANTS, tenant.id), { 
          totalPaid: Number(tenantTotalPaid) || 0, 
          balanceDue: Number(tenantBalanceDue) || 0,
          lastPaymentDate: lastPayment?.datePaid || null 
        });
      }

      // 4. Orphan Cleanup in Batch
      const orphans = paySnap.docs.filter(d => !activeTenantIds.has((d.data() as Payment).tenantId));
      for (const orphan of orphans) {
        batch.delete(orphan.ref);
      }

      await batch.commit();
      triggerDataSync();
    } catch (error) { handleFirestoreError(error, OperationType.UPDATE, FIREBASE_COLLECTIONS.STATS, user.uid, user.email); }
  };

  const fetchTenantPayments = async (tenantId: string, year: number) => {
    if (!user || !effectiveOwnerId) return [];
    try {
      const q = query(collection(db, FIREBASE_COLLECTIONS.PAYMENTS), where('tenantId', '==', tenantId), where('year', '==', year), where('ownerId', '==', effectiveOwnerId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
    } catch (error) { return []; }
  };

  const fetchAllTenantPayments = async (tenantId: string) => {
    if (!user || !effectiveOwnerId) return [];
    try {
      const q = query(collection(db, FIREBASE_COLLECTIONS.PAYMENTS), where('tenantId', '==', tenantId), where('ownerId', '==', effectiveOwnerId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
    } catch (error) { return []; }
  };

  const refreshTenantStats = async (tenantId: string) => {
     if (!user || isReadOnly || !effectiveOwnerId) return;
     const q = query(collection(db, FIREBASE_COLLECTIONS.PAYMENTS), where('tenantId', '==', tenantId), where('ownerId', '==', effectiveOwnerId));
     const snapshot = await getDocs(q);
     const allPayments = snapshot.docs.map(doc => doc.data() as Payment);
     const totalPaid = allPayments.filter(p => !!p.datePaid).reduce((sum, p) => sum + (Number(p.paidAmount ?? p.amount) || 0), 0);
     const lastPayment = allPayments.filter(p => !!p.datePaid).sort((a,b) => new Date(b.datePaid!).getTime() - new Date(a.datePaid!).getTime())[0];
     await updateDoc(doc(db, FIREBASE_COLLECTIONS.TENANTS, tenantId), { totalPaid, lastPaymentDate: lastPayment?.datePaid || null });
  };

  const tenantsWithStatus = useMemo(() => {
    const today = startOfDay(new Date());
    
    return filteredState.tenants.map((tenant) => {
      const property = filteredState.properties.find((p) => p.id === tenant.propertyId);
      const start = tenant.startDate ? parseISO(tenant.startDate) : new Date();
      const cycleMonths = getCycleMonths(tenant.paymentCycle);
      
      // 1. Primary Logic: Find the first unpaid payment record if it exists in memory
      const tenantPayments = filteredState.payments
        .filter(p => p.tenantId === tenant.id)
        .sort((a,b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());
      
      const firstUnpaid = tenantPayments.find(p => !p.datePaid);
      
      let nextDueDate: Date;
      let nextPaymentId: string | undefined = firstUnpaid?.id;

      if (firstUnpaid) {
        nextDueDate = startOfDay(parseISO(firstUnpaid.periodStart));
      } else {
        // 2. Fallback Logic: Calculate based on totalPaid if no unpaid records are in the current cache
        const totalMonthsPaid = (tenant.rentAmount > 0) 
          ? Math.floor((tenant.totalPaid || 0) / tenant.rentAmount) * cycleMonths 
          : 0;
        nextDueDate = startOfDay(addMonths(start, totalMonthsPaid));
        
        // Find or generate the ID for this future payment
        const safeYear = nextDueDate.getFullYear();
        const periodStr = format(nextDueDate, 'yyyy-MM-dd');
        nextPaymentId = `${tenant.id}_${safeYear}_${periodStr}`;
      }

      // 3. Adjusted Due Date Logic for 'End of Period' tenants (e.g. at the end of 3 months for quarterly)
      if (tenant.paymentDay === 'end') {
        if (firstUnpaid && firstUnpaid.periodEnd) {
          // Robust duration-aware calculation for grouped or custom blocks
          nextDueDate = endOfMonth(parseISO(firstUnpaid.periodEnd));
        } else {
          // Fallback to standard cycle logic for future payments not yet in the DB
          const monthsInCycle = getCycleMonths(tenant.paymentCycle);
          nextDueDate = endOfMonth(addMonths(nextDueDate, monthsInCycle - 1));
        }
      }

      let status: PaymentStatus = 'paid';
      if (firstUnpaid) {
        if (isValid(nextDueDate)) {
          if (isBefore(nextDueDate, today)) {
            status = 'late';
          } else if (differenceInDays(nextDueDate, today) <= 3) {
            status = 'due';
          } else {
            // For tenants who pay at the start of the month, being in a "pending" 
            // state for a future month is considered "Paid" (up to date).
            // For tenants who pay at the end, it stays as "Unpaid" during the month.
            status = tenant.paymentDay === 'first' ? 'paid' : 'unpaid';
          }
        }
      }
      
      const daysRemaining = isValid(nextDueDate) ? differenceInDays(nextDueDate, today) : 0;
      const nextDueDateISO = isValid(nextDueDate) ? nextDueDate.toISOString() : new Date().toISOString();
      
      return {
        ...tenant,
        property: property || { id: '', name: 'Unknown', address: '', city: '', ownerId: '', createdAt: '' },
        nextDueDate: nextDueDateISO,
        daysRemaining,
        status,
        nextPaymentId
      } as TenantWithStatus;
    });
  }, [filteredState.tenants, filteredState.properties, filteredState.payments]);

  const getTenantsWithStatus = useCallback((includeArchived = false): TenantWithStatus[] => {
    return includeArchived ? tenantsWithStatus : tenantsWithStatus.filter(t => t.tenantStatus !== 'archived');
  }, [tenantsWithStatus]);

  const generateReceipt = async (paymentId: string): Promise<Receipt> => {
    if (!user || !effectiveOwnerId) throw new Error('User not authenticated');
    const existingReceipt = state.receipts.find(r => r.paymentId === paymentId);
    if (existingReceipt) return existingReceipt;
    
    // Landlords should NOT generate new receipts if missing, but they can view existing ones.
    if (isReadOnly) throw new Error('Landlords cannot generate new receipts');

    const payment = state.payments.find(p => p.id === paymentId);
    if (!payment) throw new Error('Payment not found');

    const maxReceiptNumber = state.receipts.reduce((max, r) => Math.max(max, r.receiptNumber), 0);
    const newReceipt: Receipt = { 
      id: uuidv4(), 
      paymentId, 
      tenantId: payment.tenantId,
      receiptNumber: maxReceiptNumber + 1, 
      printedAt: new Date().toISOString(), 
      ownerId: effectiveOwnerId 
    };
    try {
      await setDoc(doc(db, FIREBASE_COLLECTIONS.RECEIPTS, newReceipt.id), newReceipt);
      return newReceipt;
    } catch (error) { throw error; }
  };

  const saveReceiptLayout = async (layout: Partial<ReceiptLayout>, bgFile?: File) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    
    try {
      let bgImage = layout.bgImage || state.receiptLayout?.bgImage;
      
      // If a new file is uploaded, store it LOCALLY only as requested
      if (bgFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(bgFile);
        });
        
        const base64 = await base64Promise;
        await storeLocalReceiptTemplate(effectiveOwnerId, base64);
        bgImage = 'local:custom_template';
      } else if (bgImage && bgImage.startsWith('data:')) {
        // Migration: If we already have a base64 string in memory but no file, move it to local storage
        await storeLocalReceiptTemplate(effectiveOwnerId, bgImage);
        bgImage = 'local:custom_template';
      }
      
      const layoutData = { 
        ...DEFAULT_RECEIPT_LAYOUT,
        ...state.receiptLayout,
        ...layout, 
        bgImage, 
        ownerId: effectiveOwnerId, 
        lastUpdated: new Date().toISOString() 
      };
      
      const q = query(collection(db, FIREBASE_COLLECTIONS.LAYOUTS), where('ownerId', '==', effectiveOwnerId));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        await addDoc(collection(db, FIREBASE_COLLECTIONS.LAYOUTS), layoutData);
      } else {
        await updateDoc(doc(db, FIREBASE_COLLECTIONS.LAYOUTS, querySnapshot.docs[0].id), layoutData);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, FIREBASE_COLLECTIONS.LAYOUTS, user.uid, user.email);
    }
  };

  const updatePaymentAmount = async (paymentId: string, amount: number) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      await runTransaction(db, async (transaction) => {
        const paymentRef = doc(db, FIREBASE_COLLECTIONS.PAYMENTS, paymentId);
        const statsRef = doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId);
        
        const [paymentSnap, statsSnap] = await Promise.all([
          transaction.get(paymentRef),
          transaction.get(statsRef)
        ]);

        if (!paymentSnap.exists()) return;
        const paymentData = paymentSnap.data() as Payment;
        const oldPaid = paymentData.paidAmount ?? (paymentData.datePaid ? paymentData.amount : 0);
        const newBalance = amount - oldPaid;
        const balanceDelta = newBalance - (paymentData.amount - oldPaid);

        // Update Payment
        transaction.update(paymentRef, { 
          amount, 
          remainingBalance: newBalance 
        });

        // Update Stats Delta
        if (statsSnap.exists()) {
          transaction.update(statsRef, {
            totalDue: increment(balanceDelta),
            lastUpdated: new Date().toISOString()
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${FIREBASE_COLLECTIONS.PAYMENTS}/${paymentId}`, user.uid, user.email);
    }
  };

  const unmarkAsPaid = async (paymentId: string) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      await runTransaction(db, async (transaction) => {
        const paymentRef = doc(db, FIREBASE_COLLECTIONS.PAYMENTS, paymentId);
        const paymentSnap = await transaction.get(paymentRef);
        if (!paymentSnap.exists()) return;
        
        const paymentData = paymentSnap.data() as Payment;
        if (!paymentData.datePaid) return;

        const tenantRef = doc(db, FIREBASE_COLLECTIONS.TENANTS, paymentData.tenantId);
        const statsRef = doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId);
        
        const [tenantSnap, statsSnap] = await Promise.all([
          transaction.get(tenantRef),
          transaction.get(statsRef)
        ]);

        transaction.update(paymentRef, {
          datePaid: deleteField(),
          paymentMethod: deleteField(),
          receiptSequence: deleteField(),
          paidAmount: deleteField(),
          remainingBalance: deleteField(),
        });

        if (tenantSnap.exists()) {
          const refundAmount = paymentData.paidAmount ?? paymentData.amount;
          const remainingPaid = state.payments.filter(p => p.tenantId === paymentData.tenantId && p.datePaid && p.id !== paymentId);
          const maxSeq = Math.max(0, ...remainingPaid.map(p => p.receiptSequence || 0));

          transaction.update(tenantRef, {
            totalPaid: increment(-refundAmount),
            balanceDue: increment(refundAmount),
            lastReceiptSequence: maxSeq
          });
        }

        if (statsSnap.exists()) {
          const refundAmount = paymentData.paidAmount ?? paymentData.amount;
          transaction.update(statsRef, {
            totalCollected: increment(-refundAmount),
            lastUpdated: new Date().toISOString()
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${FIREBASE_COLLECTIONS.PAYMENTS}/${paymentId}`, user.uid, user.email);
    }
  };

  const bulkMarkAsPaid = async (paymentIds: string[], datePaid: string, paymentMethod: PaymentMethod, notes?: string, hasChequePhoto?: boolean) => {
    if (!user || isReadOnly || !effectiveOwnerId || paymentIds.length === 0) return;
    try {
      await runTransaction(db, async (transaction) => {
        const statsRef = doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId);
        const statsSnap = await transaction.get(statsRef);
        
        let totalAmount = 0;
        let tenantId = "";

        // First, verify all payments and calculate totals
        const paymentRefs: { ref: any, id: string, amount: number, pData: Payment }[] = [];
        for (const id of paymentIds) {
          const ref = doc(db, FIREBASE_COLLECTIONS.PAYMENTS, id);
          const snap = await transaction.get(ref);
          if (snap.exists()) {
            const data = snap.data() as Payment;
            paymentRefs.push({ ref, id, amount: data.amount, pData: data });
            totalAmount += Number(data.amount) || 0;
            if (!tenantId) tenantId = data.tenantId;
          }
        }

        if (paymentRefs.length === 0) return;

        const tenantRef = doc(db, FIREBASE_COLLECTIONS.TENANTS, tenantId);
        const tenantSnap = await transaction.get(tenantRef);
        if (!tenantSnap.exists()) throw new Error("Tenant record missing");

        // Stable Receipt Sequencing (Bulk)
        const activeTenantData = tenantSnap.data() as Tenant;
        let lastSeq = activeTenantData.lastReceiptSequence || 0;

        // Check if ANY of the payments already have a sequence assigned (from consolidation)
        let nextSequence = paymentRefs.find(p => !!p.pData?.receiptSequence)?.pData?.receiptSequence;
        
        if (!nextSequence) {
          if (lastSeq === 0) {
            const tenantPaidPayments = state.payments.filter(p => p.tenantId === tenantId && p.datePaid);
            const existingSequences = tenantPaidPayments.map(p => p.receiptSequence).filter(s => s !== undefined) as number[];
            lastSeq = Math.max(...existingSequences, 0);
          }
          nextSequence = lastSeq + 1;
        }

        // Update each payment record
        for (const { ref, amount } of paymentRefs) {
          transaction.update(ref, { 
            datePaid, 
            paymentMethod, 
            paidAmount: amount,
            remainingBalance: 0,
            receiptSequence: nextSequence,
            hasChequePhoto: hasChequePhoto || false,
            notes: notes ? `${notes} (Bulk)` : (paymentRefs.length > 1 ? "Bulk Payment" : "") 
          });
        }

        // Update Tenant stats
        transaction.update(tenantRef, {
          totalPaid: increment(totalAmount),
          lastPaymentDate: datePaid,
          lastReceiptSequence: Math.max(activeTenantData.lastReceiptSequence || 0, nextSequence)
        });

        // Update Global Stats
        if (statsSnap.exists()) {
          transaction.update(statsRef, {
            totalCollected: increment(totalAmount),
            lastUpdated: new Date().toISOString()
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "bulk_payments", user.uid, user.email);
    }
  };

  const getLatestUnpaidPayments = async (tenantId: string, count: number) => {
    if (!user) return [];
    
    // 1. Get current year payments
    const currentYear = new Date().getFullYear();
    let unpaid = state.payments
      .filter(p => p.tenantId === tenantId && !p.datePaid)
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
    
    // 2. If not enough, ensure next year exists and fetch
    if (unpaid.length < count) {
      await ensureYearlyPayments(tenantId, currentYear + 1);
      // Wait for a small delay or fetch from firestore directly to be safe
      const q = query(
        collection(db, FIREBASE_COLLECTIONS.PAYMENTS),
        where('tenantId', '==', tenantId),
        where('datePaid', '==', null) // Note: this query might need a composite index
      );
      // Actually, since we just called ensureYearlyPayments, they might not be in the local state yet.
      // Let's just fetch all for this tenant and sort.
      const snap = await getDocs(query(collection(db, FIREBASE_COLLECTIONS.PAYMENTS), where('tenantId', '==', tenantId)));
      unpaid = snap.docs
        .map(d => d.data() as Payment)
        .filter(p => !p.datePaid)
        .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
    }
    
    return unpaid.slice(0, count);
  };

  const bulkUnmarkAsPaid = async (paymentIds: string[]) => {
    if (!user || isReadOnly || !effectiveOwnerId || paymentIds.length === 0) return;
    try {
        await runTransaction(db, async (transaction) => {
          let totalRefund = 0;
          let tenantId = "";
          const paymentRefs: { ref: any, amount: number, paidAmount: number, id: string }[] = [];

          // 1. COLLECT ALL READS FIRST
          for (const id of paymentIds) {
            const ref = doc(db, FIREBASE_COLLECTIONS.PAYMENTS, id);
            const snap = await transaction.get(ref);
            if (snap.exists()) {
              const data = snap.data() as Payment;
              if (data.datePaid) {
                const refundAmount = data.paidAmount ?? data.amount;
                paymentRefs.push({ ref, amount: data.amount, paidAmount: refundAmount, id });
                totalRefund += refundAmount;
                if (!tenantId) tenantId = data.tenantId;
              }
            }
          }

          if (paymentRefs.length === 0) return;

          // 2. READ TENANT AND STATS (STILL READ PHASE)
          const tenantRef = tenantId ? doc(db, FIREBASE_COLLECTIONS.TENANTS, tenantId) : null;
          const statsRef = doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId);
          
          const [tenantSnap, statsSnap] = await Promise.all([
            tenantRef ? transaction.get(tenantRef) : Promise.resolve(null),
            transaction.get(statsRef)
          ]);

          // 3. START WRITES PHASE
          for (const { ref } of paymentRefs) {
            transaction.update(ref, { 
              datePaid: deleteField(),
              paymentMethod: deleteField(),
              receiptSequence: deleteField(),
              paidAmount: deleteField(),
              remainingBalance: deleteField()
            });
          }

          if (tenantSnap?.exists()) {
            // Recalculate lastReceiptSequence accurately from the current state (Bulk version)
            const remainingPaid = state.payments.filter(p => p.tenantId === tenantId && p.datePaid && !paymentIds.includes(p.id));
            const maxSeq = Math.max(0, ...remainingPaid.map(p => p.receiptSequence || 0));

            transaction.update(tenantRef!, {
              totalPaid: increment(-totalRefund),
              lastReceiptSequence: maxSeq
            });
          }

          if (statsSnap.exists()) {
            transaction.update(statsRef, {
              totalCollected: increment(-totalRefund),
              lastUpdated: new Date().toISOString()
            });
          }
        });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bulk_revert_${paymentIds[0]}`, user.uid, user.email);
    }
  };

  const addExpense = async (expense: Omit<Expense, 'id' | 'createdAt' | 'ownerId'>) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    const id = uuidv4();
    const newExpense = { 
      ...expense, 
      id: id,
      ownerId: effectiveOwnerId, 
      createdAt: new Date().toISOString() 
    };
    try {
      await runTransaction(db, async (transaction) => {
        const statsRef = doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId);
        const statsSnap = await transaction.get(statsRef);

        transaction.set(doc(db, FIREBASE_COLLECTIONS.EXPENSES, id), newExpense);

        if (statsSnap.exists()) {
          transaction.update(statsRef, {
            totalExpenses: increment(expense.amount),
            lastUpdated: new Date().toISOString()
          });
        } else {
          transaction.set(statsRef, { 
            id: effectiveOwnerId, totalExpenses: expense.amount, totalCollected: 0, totalDue: 0, 
            ownerId: effectiveOwnerId, lastUpdated: new Date().toISOString() 
          });
        }
      });
      
      // CRITICAL FIX: Refresh local state
      triggerDataSync();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${FIREBASE_COLLECTIONS.EXPENSES}/${id}`, user.uid, user.email);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      const expense = state.expenses.find(e => e.id === id);
      if (expense) {
        await runTransaction(db, async (transaction) => {
          const expenseRef = doc(db, FIREBASE_COLLECTIONS.EXPENSES, id);
          const statsRef = doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId);
          const statsSnap = await transaction.get(statsRef);

          transaction.delete(expenseRef);

          if (statsSnap.exists()) {
            transaction.update(statsRef, {
              totalExpenses: increment(-expense.amount),
              lastUpdated: new Date().toISOString()
            });
          }
        });
        
        // CRITICAL FIX: Refresh local state
        triggerDataSync();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${FIREBASE_COLLECTIONS.EXPENSES}/${id}`, user.uid, user.email);
    }
  };

  const [profitFocusMode, setProfitFocusMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('global_profitFocusMode');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const toggleProfitFocusMode = useCallback(() => {
    setProfitFocusMode(prev => {
      const newVal = !prev;
      localStorage.setItem('global_profitFocusMode', JSON.stringify(newVal));
      return newVal;
    });
  }, []);

  const [privacyMode, setPrivacyMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('global_privacyMode');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const togglePrivacyMode = useCallback(() => {
    setPrivacyMode(prev => {
      const newVal = !prev;
      localStorage.setItem('global_privacyMode', JSON.stringify(newVal));
      return newVal;
    });
  }, []);

  const getPropertyFinancials = useCallback((propertyId: string) => {
    const propertyTenants = state.tenants.filter(t => t.propertyId === propertyId);
    const tenantIds = new Set(propertyTenants.map(t => t.id));
    
    // Total Income from this property (Sum of all paid payments for its tenants)
    const income = state.payments
      .filter(p => tenantIds.has(p.tenantId) && !!p.datePaid)
      .reduce((sum, p) => sum + (Number(p.paidAmount ?? p.amount) || 0), 0);
      
    // Total Expenses for this property
    const expenses = state.expenses
      .filter(e => e.propertyId === propertyId)
      .reduce((sum, e) => sum + e.amount, 0);
      
    return { income, expenses, net: income - expenses };
  }, [state.tenants, state.payments, state.expenses]);

  const authorizeLandlord = async (email: string) => {
    if (!user || isReadOnly) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    try {
      const id = `${user.uid}___${cleanEmail}`;
      await setDoc(doc(db, FIREBASE_COLLECTIONS.LANDLORD_ACCESS, id), {
        id: id,
        ownerId: user.uid,
        ownerEmail: user.email,
        landlordEmail: cleanEmail,
        isAdmin: false,
        canViewDashboard: true,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, FIREBASE_COLLECTIONS.LANDLORD_ACCESS, user.uid, user.email);
    }
  };

  const revokeLandlord = async (email: string, docId?: string) => {
    if (!user || isReadOnly) return;
    const cleanEmail = email.trim().toLowerCase();
    try {
      // ULTRA-STABLE: Soft Revoke pattern
      const targetId = docId || `${user.uid}___${cleanEmail}`;
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.LANDLORD_ACCESS, targetId), {
        isRevoked: true,
        revokedAt: new Date().toISOString(),
        lastActive: null,
        isCurrentlyViewing: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, FIREBASE_COLLECTIONS.LANDLORD_ACCESS, user.uid, user.email);
    }
  };

  const updateLandlordActivity = async (pageName: string, details?: string) => {
    if (!user || !isReadOnly || !effectiveOwnerId || !user.email) return;
    try {
      const accessId = `${effectiveOwnerId}___${user.email.toLowerCase()}`;
      
      // Update basic heartbeat info (STABLE: No more incrementing visit count here)
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.LANDLORD_ACCESS, accessId), {
        lastActive: new Date().toISOString(),
        lastVisitedPage: pageName,
        isCurrentlyViewing: true
      });

      // Throttled Session Increment: Only once per mount/login
      const currentSessionKey = `${effectiveOwnerId}_${user.email}_${new Date().toDateString()}`;
      if (sessionTrackedRef.current !== currentSessionKey) {
        sessionTrackedRef.current = currentSessionKey;
        await updateDoc(doc(db, FIREBASE_COLLECTIONS.LANDLORD_ACCESS, accessId), {
          accessCount: increment(1)
        });
      }

      // Record detailed audit log entry
      await addDoc(collection(db, 'activity_logs'), {
        ownerId: effectiveOwnerId,
        landlordEmail: user.email.toLowerCase(),
        action: pageName,
        details: details || `Visited ${pageName}`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.warn("Activity heartbeat/logging failed:", err);
    }
  };

  const updateLandlordPermissions = async (docId: string, permissions: Partial<LandlordAccess>) => {
    if (!user || isReadOnly || !canManageAccess) return;
    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.LANDLORD_ACCESS, docId), permissions);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, FIREBASE_COLLECTIONS.LANDLORD_ACCESS, user.uid, user.email);
    }
  };

  const consolidatePayments = async (paymentIds: string[]) => {
    if (!user || isReadOnly || !effectiveOwnerId || paymentIds.length === 0) return;
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Get first payment to identify tenant
        const firstRef = doc(db, FIREBASE_COLLECTIONS.PAYMENTS, paymentIds[0]);
        const firstSnap = await transaction.get(firstRef);
        if (!firstSnap.exists()) return;
        const tenantId = (firstSnap.data() as Payment).tenantId;

        const tenantRef = doc(db, FIREBASE_COLLECTIONS.TENANTS, tenantId);
        const tenantSnap = await transaction.get(tenantRef);
        if (!tenantSnap.exists()) return;
        const tenantData = tenantSnap.data() as Tenant;

        // 2. Determine next sequence
        let lastSeq = tenantData.lastReceiptSequence || 0;
        if (lastSeq === 0) {
          const tenantPaidPayments = state.payments.filter(p => p.tenantId === tenantId && p.datePaid);
          const existingSequences = tenantPaidPayments.map(p => p.receiptSequence).filter(s => s !== undefined) as number[];
          lastSeq = Math.max(...existingSequences, 0);
        }
        const nextSequence = lastSeq + 1;

        // 3. Assign sequence to all unpaid payments in the set
        for (const pid of paymentIds) {
          const pRef = doc(db, FIREBASE_COLLECTIONS.PAYMENTS, pid);
          transaction.update(pRef, { receiptSequence: nextSequence });
        }

        // 4. Update tenant record
        transaction.update(tenantRef, { lastReceiptSequence: nextSequence });
      });
    } catch (error) {
       console.error("Consolidation failed:", error);
    }
  };

  const payCustomMonths = async (tenantId: string, monthCount: number, datePaid: string, method: PaymentMethod, notes?: string) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      await runTransaction(db, async (transaction) => {
        const tenantRef = doc(db, FIREBASE_COLLECTIONS.TENANTS, tenantId);
        const statsRef = doc(db, FIREBASE_COLLECTIONS.STATS, effectiveOwnerId);
        
        const [tenantSnap, statsSnap] = await Promise.all([
          transaction.get(tenantRef),
          transaction.get(statsRef)
        ]);

        if (!tenantSnap.exists()) throw new Error("Occupant not found");
        const tenantData = tenantSnap.data() as Tenant;

        const start = startOfDay(parseISO(tenantsWithStatus.find(t => t.id === tenantId)?.nextDueDate || tenantData.startDate));
        const end = subDays(addMonths(start, monthCount), 1);
        const amount = tenantData.rentAmount * monthCount;
        
        const year = start.getFullYear();
        const periodStr = format(start, 'yyyy-MM-dd');
        const paymentId = `${tenantId}_${year}_${periodStr}`;
        const paymentRef = doc(db, FIREBASE_COLLECTIONS.PAYMENTS, paymentId);

        let lastSeq = tenantData.lastReceiptSequence || 0;
        const nextSequence = lastSeq + 1;

        transaction.set(paymentRef, {
          id: paymentId,
          tenantId,
          year,
          amount,
          datePaid,
          paymentMethod: method,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          ownerId: effectiveOwnerId,
          createdAt: new Date().toISOString(),
          receiptSequence: nextSequence,
          notes: notes || `Custom ${monthCount} Mo`
        });
        
        const newStartDate = addMonths(start, monthCount).toISOString();
        transaction.update(tenantRef, {
          startDate: newStartDate,
          totalPaid: increment(amount),
          lastPaymentDate: datePaid,
          lastReceiptSequence: Math.max(tenantData.lastReceiptSequence || 0, nextSequence)
        });

        if (statsSnap.exists()) {
          transaction.update(statsRef, {
            totalCollected: increment(amount),
            lastUpdated: new Date().toISOString()
          });
        }
      });

      // Cleanup: Only delete unpaid records starting AFTER the new paid period
      const newStart = addMonths(parseISO(tenantsWithStatus.find(t => t.id === tenantId)?.nextDueDate || state.tenants.find(t => t.id === tenantId)!.startDate), monthCount);
      const futureUnpaid = state.payments.filter(p => 
        p.tenantId === tenantId && 
        !p.datePaid && 
        parseISO(p.periodStart) >= newStart
      );
      for (const p of futureUnpaid) { try { await deleteDoc(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, p.id)); } catch(e) {} }
      
      triggerDataSync();
    } catch (err) { console.error("Process custom months failed:", err); }
  };

  const individualizeUpcomingMonths = async (tenantId: string, monthCount: number) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    const tenant = state.tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      const start = startOfMonth(parseISO(tenantsWithStatus.find(t => t.id === tenantId)?.nextDueDate || tenant.startDate));
      const end = addMonths(start, monthCount);
      
      // 1. Delete ALL unpaid placeholders that INTERSECT with the split range
      const overlapping = state.payments.filter(p => 
        p.tenantId === tenantId && 
        !p.datePaid && 
        parseISO(p.periodStart) < end && 
        parseISO(p.periodEnd) > start
      );
      
      let maxEnd = end;
      for (const p of overlapping) {
        const pEnd = parseISO(p.periodEnd);
        if (pEnd > maxEnd) maxEnd = pEnd;
        batch.delete(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, p.id));
      }

      // 2. Create individual monthly unpaid rows for the FULL span of deleted records
      let current = start;
      while (current < maxEnd) {
        const pStart = current;
        const pNext = addMonths(pStart, 1);
        const pEnd = subDays(pNext, 1);
        const pId = `${tenantId}_${pStart.getFullYear()}_${format(pStart, 'yyyy-MM-dd')}`;
        
        batch.set(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, pId), {
          id: pId,
          tenantId,
          year: pStart.getFullYear(),
          amount: tenant.rentAmount,
          periodStart: pStart.toISOString(),
          periodEnd: pNext.toISOString(), // Use 1st of next month for better generator alignment
          ownerId: effectiveOwnerId,
          createdAt: new Date().toISOString(),
          datePaid: null // Explicitly unpaid
        });
        current = pNext;
      }

      await batch.commit();
      triggerDataSync();
    } catch (err) { console.error("Individualize failed:", err); }
  };

  const splitPayment = async (paymentId: string) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    const payment = state.payments.find(p => p.id === paymentId);
    if (!payment || payment.datePaid) return;

    const tenant = state.tenants.find(t => t.id === payment.tenantId);
    if (!tenant) return;

    const start = parseISO(payment.periodStart);
    const end = parseISO(payment.periodEnd);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth() + 1);

    if (months <= 1) return;

    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);

      // 1. Delete THE block payment
      batch.delete(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, paymentId));

      // 2. Scan for and delete any PRE-EXISTING duplicates in this range
      const overlapPayments = state.payments.filter(p => 
        p.tenantId === tenant.id && 
        p.id !== paymentId &&
        !p.datePaid &&
        parseISO(p.periodStart) >= start && 
        parseISO(p.periodStart) <= end
      );
      
      overlapPayments.forEach(p => {
        batch.delete(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, p.id));
      });

      // 3. Create the new individual months
      for (let i = 0; i < months; i++) {
        const pStart = addMonths(start, i);
        const pEnd = subDays(addMonths(pStart, 1), 1);
        const pId = `${tenant.id}_${pStart.getFullYear()}_${format(pStart, 'yyyy-MM-dd')}`;
        
        batch.set(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, pId), {
          ...payment,
          id: pId,
          amount: tenant.rentAmount,
          periodStart: pStart.toISOString(),
          periodEnd: pEnd.toISOString(),
          year: pStart.getFullYear(),
          createdAt: new Date().toISOString()
        });
      }
      await batch.commit();
      triggerDataSync();
    } catch (err) { console.error("Split failed:", err); }
  };

  const loadArchivalYear = async (tenantId: string, year: number) => {
    if (!user || !effectiveOwnerId) return;
    try {
      const q = query(
        collection(db, FIREBASE_COLLECTIONS.PAYMENTS),
        where('tenantId', '==', tenantId),
        where('year', '==', year),
        where('ownerId', '==', effectiveOwnerId)
      );
      const snapshot = await getDocs(q);
      const newPayments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
      
      setState(prev => ({
        ...prev,
        additionalPayments: [...(prev.additionalPayments || []), ...newPayments]
      }));
    } catch (error) {
      console.error("Failed to load archival year:", year);
    }
  };

  const groupPayments = async (paymentIds: string[]) => {
    if (!user || isReadOnly || !effectiveOwnerId || paymentIds.length < 2) return;
    const sorted = state.payments.filter(p => paymentIds.includes(p.id)).sort((a,b) => a.periodStart.localeCompare(b.periodStart));
    if (sorted.some(p => p.datePaid)) return;

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalAmount = sorted.reduce((s,p) => s + p.amount, 0);

    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      for (const id of paymentIds) batch.delete(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, id));

      const gId = `${first.tenantId}_${first.year}_${format(parseISO(first.periodStart), 'yyyy-MM-dd')}`;
      batch.set(doc(db, FIREBASE_COLLECTIONS.PAYMENTS, gId), {
        ...first,
        id: gId,
        amount: totalAmount,
        periodEnd: last.periodEnd,
        createdAt: new Date().toISOString()
      });
      await batch.commit();
      triggerDataSync();
    } catch (err) { console.error("Group failed:", err); }
  };

  const addFolder = async (name: string) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      const id = uuidv4();
      const folderRef = doc(db, FIREBASE_COLLECTIONS.FOLDERS, id);
      const folder: PropertyFolder = {
        id,
        name,
        ownerId: effectiveOwnerId,
        createdAt: new Date().toISOString()
      };
      await setDoc(folderRef, folder);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, FIREBASE_COLLECTIONS.FOLDERS);
    }
  };

  const updateFolder = async (id: string, name: string) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      const folderRef = doc(db, FIREBASE_COLLECTIONS.FOLDERS, id);
      await updateDoc(folderRef, { name });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, FIREBASE_COLLECTIONS.FOLDERS);
    }
  };

  const deleteFolder = async (id: string) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      // 1. Clear folderId for properties in this folder
      const associatedProps = state.properties.filter(p => p.folderId === id);
      associatedProps.forEach(p => {
        batch.update(doc(db, FIREBASE_COLLECTIONS.PROPERTIES, p.id), { folderId: deleteField() });
      });
      
      // 2. Delete the folder
      batch.delete(doc(db, FIREBASE_COLLECTIONS.FOLDERS, id));
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, FIREBASE_COLLECTIONS.FOLDERS);
    }
  };

  const assignPropertyToFolder = async (propertyId: string, folderId: string | null) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      const propertyRef = doc(db, FIREBASE_COLLECTIONS.PROPERTIES, propertyId);
      await updateDoc(propertyRef, { 
        folderId: folderId === null ? deleteField() : folderId 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, FIREBASE_COLLECTIONS.PROPERTIES);
    }
  };

  const updateFolderWithProperties = async (folderId: string | null, name: string, propertyIds: string[]) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      let finalFolderId = folderId;
      
      // 1. Create or update the folder
      if (!finalFolderId) {
        finalFolderId = uuidv4();
        const folderRef = doc(db, FIREBASE_COLLECTIONS.FOLDERS, finalFolderId);
        const folder: PropertyFolder = {
          id: finalFolderId,
          name,
          ownerId: effectiveOwnerId,
          createdAt: new Date().toISOString()
        };
        batch.set(folderRef, folder);
      } else {
        const folderRef = doc(db, FIREBASE_COLLECTIONS.FOLDERS, finalFolderId);
        batch.update(folderRef, { name });
      }
      
      // 2. Clear folderId for properties previously in this folder (if editing)
      if (folderId) {
        const prevProps = state.properties.filter(p => p.folderId === folderId);
        for (const prop of prevProps) {
          if (!propertyIds.includes(prop.id)) {
            batch.update(doc(db, FIREBASE_COLLECTIONS.PROPERTIES, prop.id), { folderId: deleteField() });
          }
        }
      }
      
      // 3. Assign folderId to selected properties
      for (const pId of propertyIds) {
        batch.update(doc(db, FIREBASE_COLLECTIONS.PROPERTIES, pId), { folderId: finalFolderId });
      }
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, FIREBASE_COLLECTIONS.FOLDERS);
    }
  };

  const updateReceipt = async (id: string, updates: Partial<Receipt>) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      const receiptRef = doc(db, FIREBASE_COLLECTIONS.RECEIPTS, id);
      await updateDoc(receiptRef, {
        ...updates,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, FIREBASE_COLLECTIONS.RECEIPTS, user.uid, user.email);
    }
  };

  return (
    <AppContext.Provider value={{ 
      ...filteredState, 
      addProperty, 
      updateProperty, 
      deleteProperty, 
      addTenant, 
      updateTenant, 
      deleteTenant, 
      markAsPaid, 
      unmarkAsPaid, 
      bulkMarkAsPaid, 
      bulkUnmarkAsPaid, 
      getLatestUnpaidPayments, 
      updatePaymentNotes, 
      updatePaymentAmount, 
      ensureYearlyPayments, 
      getTenantsWithStatus, 
      generateReceipt, 
      recalculateAllStats, 
      fetchTenantPayments, 
      fetchAllTenantPayments,
      refreshTenantStats, 
      triggerDataSync, 
      saveReceiptLayout, 
      addExpense, 
      deleteExpense, 
      getPropertyFinancials, 
      profitFocusMode, 
      effectiveOwnerId,
      toggleProfitFocusMode, 
      privacyMode, 
      togglePrivacyMode,
      canManageAccess,
      authorizeLandlord,
      revokeLandlord,
      updateLandlordActivity,
      updateLandlordPermissions,
      consolidatePayments,
      payCustomMonths,
      individualizeUpcomingMonths,
      splitPayment,
      groupPayments,
      loadArchivalYear,
      clearArchivalCache: () => setState(prev => ({ ...prev, additionalPayments: [] })),
      addFolder,
      updateFolder,
      deleteFolder,
      assignPropertyToFolder,
      updateFolderWithProperties,
      updateReceipt
    }}>
      {children}
    </AppContext.Provider>
  );
};
export const DEFAULT_RECEIPT_LAYOUT = {
  bgImage: '/kra.jpg',
  bgPosition: { x: 0, y: 0, width: 165, height: 103 },
  pageSize: { width: 165, height: 103 },
  tenantName: { x: 110, y: 26, fontSize: 14 },
  propertyAddress: { x: 65, y: 50, fontSize: 14 },
  amountNumbers: { x: 10, y: 11, fontSize: 14 },
  totalAmountNumbers: { x: 10, y: 44, fontSize: 14 },
  amountLetters: { x: 125, y: 35, fontSize: 14 },
  monthYear: { x: 45, y: 58, fontSize: 14 },
  periodStart: { x: 130, y: 66, fontSize: 14 },
  periodEnd: { x: 65, y: 66, fontSize: 14 },
  paymentDate: { x: 38, y: 72, fontSize: 14 },
  paymentPlace: { x: 30, y: 72, fontSize: 14 },
  propertyType: { x: 105, y: 50, fontSize: 14 },
  tenantReceiptNumber: { x: 145, y: 20, fontSize: 14 },
};
