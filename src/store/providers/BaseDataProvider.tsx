import React, { useState, useEffect, createContext, useContext } from 'react';
import { Property, PropertyFolder, OperationType } from '../../types';
import { db, storage } from '../../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  writeBatch,
  increment
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { FIREBASE_COLLECTIONS } from '../../config/constants';
import { handleFirestoreError } from '../../utils/firestore';
import { cleanupPropertyAssets } from '../../utils/storageUtils';

export interface BaseDataContextType {
  properties: Property[];
  folders: PropertyFolder[];
  addProperty: (property: Omit<Property, 'id' | 'createdAt' | 'ownerId'>, imageFile?: File) => Promise<void>;
  updateProperty: (id: string, property: Partial<Property>, imageFile?: File) => Promise<void>;
  deleteProperty: (id: string, propertyTenants: any[], propertyExpenses: any[], relevantPayments: any[], relevantReceipts: any[]) => Promise<void>;
  addFolder: (name: string) => Promise<void>;
  updateFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  assignPropertyToFolder: (propertyId: string, folderId: string | null) => Promise<void>;
  updateFolderWithProperties: (folderId: string | null, name: string, propertyIds: string[]) => Promise<void>;
  loading: boolean;
}

export const BaseDataContext = createContext<BaseDataContextType | undefined>(undefined);

export const BaseDataProvider: React.FC<{ 
  children: React.ReactNode;
  user: any;
  effectiveOwnerId: string | null;
  isReadOnly: boolean;
  triggerDataSync: () => void;
}> = ({ children, user, effectiveOwnerId, isReadOnly, triggerDataSync }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [folders, setFolders] = useState<PropertyFolder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !effectiveOwnerId) {
      setProperties([]);
      setFolders([]);
      setLoading(false);
      return;
    }

    const qProperties = query(collection(db, FIREBASE_COLLECTIONS.PROPERTIES), where('ownerId', '==', effectiveOwnerId));
    const unsubProperties = onSnapshot(qProperties, (snapshot) => {
      const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      setProperties(properties);
    }, (error) => handleFirestoreError(error, OperationType.LIST, FIREBASE_COLLECTIONS.PROPERTIES, user.uid, user.email));

    const qFolders = query(collection(db, FIREBASE_COLLECTIONS.FOLDERS), where('ownerId', '==', effectiveOwnerId));
    const unsubFolders = onSnapshot(qFolders, (snapshot) => {
      const folders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PropertyFolder));
      setFolders(folders);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, FIREBASE_COLLECTIONS.FOLDERS, user.uid, user.email);
      setLoading(false);
    });

    return () => {
      unsubProperties();
      unsubFolders();
    };
  }, [user, effectiveOwnerId]);

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
      } as Property;
      await setDoc(doc(db, FIREBASE_COLLECTIONS.PROPERTIES, id), newProperty);
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
      
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) delete updateData[key];
      });
      
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.PROPERTIES, id), updateData);
      triggerDataSync();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${FIREBASE_COLLECTIONS.PROPERTIES}/${id}`, user.uid, user.email);
    }
  };

  const deleteProperty = async (id: string, propertyTenants: any[], propertyExpenses: any[], relevantPayments: any[], relevantReceipts: any[]) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      const tenantIds = propertyTenants.map(t => t.id);
      const expenseAmount = propertyExpenses.reduce((sum, e) => sum + e.amount, 0);

      const totalCollected = relevantPayments
        .filter(p => !!p.datePaid)
        .reduce((sum, p) => sum + (Number(p.paidAmount ?? p.amount) || 0), 0);
      
      const totalDue = relevantPayments.reduce((sum, p) => {
        if (!p.datePaid) return sum + (Number(p.amount) || 0);
        return sum + (Number(p.remainingBalance) || 0);
      }, 0);

      const allRefs = [
        doc(db, FIREBASE_COLLECTIONS.PROPERTIES, id),
        ...tenantIds.map(tid => doc(db, FIREBASE_COLLECTIONS.TENANTS, tid)),
        ...relevantPayments.map(p => doc(db, FIREBASE_COLLECTIONS.PAYMENTS, p.id)),
        ...relevantReceipts.map(r => doc(db, FIREBASE_COLLECTIONS.RECEIPTS, r.id)),
        ...propertyExpenses.map(e => doc(db, FIREBASE_COLLECTIONS.EXPENSES, e.id))
      ];

      const { writeBatch: firestoreWriteBatch } = await import('firebase/firestore');
      
      for (let i = 0; i < allRefs.length; i += 450) {
        const batch = firestoreWriteBatch(db);
        const chunk = allRefs.slice(i, i + 450);
        chunk.forEach(ref => batch.delete(ref));
        
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
      
      await cleanupPropertyAssets(id);
      triggerDataSync();
    } catch (error) { handleFirestoreError(error, OperationType.DELETE, `${FIREBASE_COLLECTIONS.PROPERTIES}/${id}`, user.uid, user.email); }
  };

  const addFolder = async (name: string) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      const id = uuidv4();
      await setDoc(doc(db, FIREBASE_COLLECTIONS.FOLDERS, id), {
        id,
        name,
        ownerId: effectiveOwnerId,
        createdAt: new Date().toISOString(),
        propertyIds: []
      });
      triggerDataSync();
    } catch (error) { handleFirestoreError(error, OperationType.CREATE, FIREBASE_COLLECTIONS.FOLDERS, user.uid, user.email); }
  };

  const updateFolder = async (id: string, name: string) => {
    if (!user || isReadOnly) return;
    try {
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.FOLDERS, id), { name });
      triggerDataSync();
    } catch (error) { handleFirestoreError(error, OperationType.UPDATE, FIREBASE_COLLECTIONS.FOLDERS, user.uid, user.email); }
  };

  const deleteFolder = async (id: string) => {
    if (!user || isReadOnly) return;
    try {
      await deleteDoc(doc(db, FIREBASE_COLLECTIONS.FOLDERS, id));
      triggerDataSync();
    } catch (error) { handleFirestoreError(error, OperationType.DELETE, FIREBASE_COLLECTIONS.FOLDERS, user.uid, user.email); }
  };

  const assignPropertyToFolder = async (propertyId: string, folderId: string | null) => {
    if (!user || isReadOnly) return;
    try {
      const { writeBatch: firestoreWriteBatch } = await import('firebase/firestore');
      const batch = firestoreWriteBatch(db);
      folders.forEach(f => {
        if (f.propertyIds.includes(propertyId)) {
          batch.update(doc(db, FIREBASE_COLLECTIONS.FOLDERS, f.id), {
            propertyIds: f.propertyIds.filter(id => id !== propertyId)
          });
        }
      });
      if (folderId) {
        batch.update(doc(db, FIREBASE_COLLECTIONS.FOLDERS, folderId), {
          propertyIds: Array.from(new Set([...(folders.find(f => f.id === folderId)?.propertyIds || []), propertyId]))
        });
      }
      await batch.commit();
      triggerDataSync();
    } catch (error) { handleFirestoreError(error, OperationType.UPDATE, FIREBASE_COLLECTIONS.FOLDERS, user.uid, user.email); }
  };

  const updateFolderWithProperties = async (folderId: string | null, name: string, propertyIds: string[]) => {
    if (!user || isReadOnly || !effectiveOwnerId) return;
    try {
      if (!folderId) {
        const id = uuidv4();
        await setDoc(doc(db, FIREBASE_COLLECTIONS.FOLDERS, id), {
          id,
          name,
          ownerId: effectiveOwnerId,
          createdAt: new Date().toISOString(),
          propertyIds
        });
      } else {
        await updateDoc(doc(db, FIREBASE_COLLECTIONS.FOLDERS, folderId), { name, propertyIds });
      }
      triggerDataSync();
    } catch (error) { handleFirestoreError(error, OperationType.UPDATE, FIREBASE_COLLECTIONS.FOLDERS, user.uid, user.email); }
  };

  const value = {
    properties,
    folders,
    addProperty,
    updateProperty,
    deleteProperty,
    addFolder,
    updateFolder,
    deleteFolder,
    assignPropertyToFolder,
    updateFolderWithProperties,
    loading
  };

  return <BaseDataContext.Provider value={value}>{children}</BaseDataContext.Provider>;
};

export const useBaseData = () => {
  const context = useContext(BaseDataContext);
  if (context === undefined) throw new Error('useBaseData must be used within a BaseDataProvider');
  return context;
};
