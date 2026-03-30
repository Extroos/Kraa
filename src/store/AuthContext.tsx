import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithCredential,
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  updateDoc,
  doc,
  setDoc,
  increment
} from 'firebase/firestore';
import { APP_CONFIG, FIREBASE_COLLECTIONS } from '../config/constants';
import { AuthContextType, UserRole, LandlordAccess } from '../types';

const MOCK_USER = {
  uid: 'dev-guest-user',
  email: 'guest@developer.local',
  displayName: 'Guest Developer',
  photoURL: 'https://ui-avatars.com/api/?name=Guest+Developer',
} as User;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    if (APP_CONFIG.USE_MOCK_AUTH) {
      const savedMock = localStorage.getItem('mock_user_session');
      return savedMock ? JSON.parse(savedMock) : null;
    }
    return auth.currentUser;
  });
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [role, setRole] = useState<UserRole>('owner');
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canViewDashboard, setCanViewDashboard] = useState(false);
  const [effectiveOwnerId, setEffectiveOwnerId] = useState<string | null>(null);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [restrictedTenantId, setRestrictedTenantId] = useState<string | undefined>(undefined);
  const [restrictedTenantName, setRestrictedTenantName] = useState<string | undefined>(undefined);
  const [accessAccounts, setAccessAccounts] = useState<LandlordAccess[]>([]);
  const [unseenInvitations, setUnseenInvitations] = useState<LandlordAccess[]>([]);

  const canManageAccess = role === 'owner' || isAdmin;

  // Mobile Auth Early Initialization
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      try {
        console.log("Auth: Initializing Native Google Core...");
        GoogleAuth.initialize();
      } catch (err) {
        console.error("Auth: Initialization failed:", err);
      }
    }
  }, []);

  const switchActiveAccount = React.useCallback(async (targetOwnerId: string) => {
    if (!user) return;
    
    // Save to persistence
    localStorage.setItem('lastActiveOwnerStore', targetOwnerId);

    // If moving AWAY from a guest landlord, tell them I'm gone
    if (role === 'landlord' && effectiveOwnerId && effectiveOwnerId !== targetOwnerId) {
      try {
        const docId = `${effectiveOwnerId}___${user.email?.toLowerCase()}`;
        await updateDoc(doc(db, FIREBASE_COLLECTIONS.LANDLORD_ACCESS, docId), {
          isCurrentlyViewing: false
        });
      } catch (err) { console.warn("Presence teardown failed:", err); }
    }

    if (targetOwnerId === user.uid) {
      setRole('owner');
      setIsAdmin(true);
      setCanViewDashboard(true);
      setIsReadOnly(false);
      setEffectiveOwnerId(user.uid);
      setOwnerEmail(user.email);
      setRestrictedTenantId(undefined);
      setRestrictedTenantName(undefined);
    } else {
      const account = accessAccounts.find(acc => acc.ownerId === targetOwnerId);
      if (account) {
        const isRestricted = !!account.restrictedTenantId;
        setRole('landlord');
        setIsAdmin(isRestricted ? false : !!account.isAdmin);
        setCanViewDashboard(isRestricted ? false : account.canViewDashboard !== false);
        setIsReadOnly(isRestricted ? true : !account.isAdmin);
        setEffectiveOwnerId(account.ownerId);
        setOwnerEmail(account.ownerEmail || null);
        setRestrictedTenantId(account.restrictedTenantId);
        setRestrictedTenantName(account.restrictedTenantName);
        
        // Tell them I'm here
        try {
          const docId = `${account.ownerId}___${user.email?.toLowerCase()}`;
          await updateDoc(doc(db, FIREBASE_COLLECTIONS.LANDLORD_ACCESS, docId), {
            isCurrentlyViewing: true,
            lastActive: new Date().toISOString(),
            accessCount: increment(1)
          });
        } catch (err) { console.warn("Presence activation failed:", err); }
      }
    }
  }, [user, role, effectiveOwnerId, accessAccounts]);

  useEffect(() => {
    if (APP_CONFIG.USE_MOCK_AUTH) {
      if (user) {
        setRole('owner');
        setIsReadOnly(false);
        setIsAdmin(true);
        setCanViewDashboard(true);
        setEffectiveOwnerId(user.uid);
        setOwnerEmail(user.email);
      }
      setIsAuthReady(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      
      if (u && u.email) {
        // ULTRA-STABLE: Reactive Landlord Access Listener
        const landlordQuery = query(
          collection(db, FIREBASE_COLLECTIONS.LANDLORD_ACCESS), 
          where('landlordEmail', '==', u.email.toLowerCase())
        );

        const unsubLandlords = onSnapshot(landlordQuery, (snapshot) => {
          const allAccounts = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as LandlordAccess))
            .filter(acc => !acc.isRevoked); // HARD FILTER: Never show revoked
          
          setAccessAccounts(allAccounts);

          // Find portfolios where we're invited but NOT currently active
          const currentStoreId = localStorage.getItem('lastActiveOwnerStore') || u.uid;
          const pending = allAccounts.filter(acc => acc.ownerId !== currentStoreId);
          setUnseenInvitations(pending);

          // EJECTION LOGIC: Check if currently active store is still authorized
          const isAuthorized = currentStoreId === u.uid || allAccounts.some(acc => acc.ownerId === currentStoreId);

          if (!isAuthorized) {
            console.warn("Session Revoked/Unauthorized: Resetting to personal space.");
            // Reset state to owner immediately to prevent leaked views
            setRole('owner');
            setEffectiveOwnerId(u.uid);
            setOwnerEmail(u.email);
            setIsAdmin(true);
            setIsReadOnly(false);
            setCanViewDashboard(true);
            setRestrictedTenantId(undefined);
            setRestrictedTenantName(undefined);
            localStorage.setItem('lastActiveOwnerStore', u.uid);
            setIsAuthReady(true);
            return;
          }

          // SYNC PERMISSIONS: Update active guest account details reactively
          if (currentStoreId !== u.uid) {
            const activeAcc = allAccounts.find(acc => acc.ownerId === currentStoreId);
            if (activeAcc) {
              const isRestricted = !!activeAcc.restrictedTenantId;
              setRole('landlord');
              setIsAdmin(isRestricted ? false : !!activeAcc.isAdmin);
              setCanViewDashboard(isRestricted ? false : activeAcc.canViewDashboard !== false);
              setIsReadOnly(isRestricted ? true : !activeAcc.isAdmin);
              setEffectiveOwnerId(activeAcc.ownerId);
              setOwnerEmail(activeAcc.ownerEmail || null);
              setRestrictedTenantId(activeAcc.restrictedTenantId);
              setRestrictedTenantName(activeAcc.restrictedTenantName);
            }
          } else {
            // Owner Mode
            setRole('owner');
            setEffectiveOwnerId(u.uid);
            setOwnerEmail(u.email);
            setIsAdmin(true);
            setIsReadOnly(false);
            setCanViewDashboard(true);
            setRestrictedTenantId(undefined);
            setRestrictedTenantName(undefined);
          }
          setIsAuthReady(true);
        }, (err) => {
          console.error("Landlord access listener failed:", err);
          setRole('owner');
          setEffectiveOwnerId(u.uid);
          setIsAuthReady(true);
        });

        return () => unsubLandlords();
      } else {
        // Not logged in
        setRole('owner');
        setEffectiveOwnerId(null);
        setOwnerEmail(null);
        setIsAdmin(false);
        setIsReadOnly(false);
        setCanViewDashboard(false);
        setIsAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, [user?.uid]); // Only re-run if the user ID changes

  const login = async () => {
    try {
      if (APP_CONFIG.USE_MOCK_AUTH) {
        setUser(MOCK_USER);
        localStorage.setItem('mock_user_session', JSON.stringify(MOCK_USER));
        return;
      }

      if (Capacitor.isNativePlatform()) {
        // Native Android/iOS login flow
        console.log("Auth: Attempting Native Google Sign-In...");
        const result = await GoogleAuth.signIn().catch(err => {
          console.error("Auth: Native GoogleAuth.signIn failed:", err);
          alert(`Login Error (Native): ${err.message || JSON.stringify(err)}`);
          throw err;
        });
        
        if (result && result.authentication.idToken) {
          console.log("Auth: Native Sign-In success, linking to Firebase...");
          const credential = GoogleAuthProvider.credential(result.authentication.idToken);
          const firebaseResult = await signInWithCredential(auth, credential);
          setUser(firebaseResult.user);
        } else {
          console.warn("Auth: No ID Token returned from native selector.");
        }
      } else {
        // Standard Web login flow
        console.log("Auth: Defaulting to Web Login Flow...");
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        setUser(result.user);
      }
    } catch (error) {
      console.error('Login failed', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (APP_CONFIG.USE_MOCK_AUTH) {
        setUser(null);
        localStorage.removeItem('mock_user_session');
        return;
      }
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed', error);
      throw error;
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 font-sans">
        <div className="flex flex-col items-center gap-6">
          <div className="w-14 h-14 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin shadow-sm"></div>
          <p className="text-neutral-500 font-bold tracking-tight">Securing Connection...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-xl shadow-md p-10 text-center border border-neutral-200 flex flex-col items-center">
          <div className="w-20 h-20 bg-primary-500 text-white rounded-xl flex items-center justify-center mb-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-2 tracking-tight">Welcome Back</h1>
          <p className="text-neutral-500 font-medium mb-10 leading-relaxed max-w-[280px]">
            Sign in to manage your properties and tenants.
          </p>
          <button
            onClick={login}
            className="w-full px-6 py-4 bg-primary-500 text-white rounded-lg font-bold shadow-sm hover:bg-primary-600 transition-colors flex items-center justify-center gap-4 group"
          >
            {APP_CONFIG.USE_MOCK_AUTH ? (
              <>
                <svg viewBox="0 0 24 24" className="w-6 h-6 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span className="text-lg">Enter as Guest</span>
              </>
            ) : (
              <>
                <div className="bg-white p-1 rounded-sm">
                  <svg viewBox="0 0 48 48" className="w-5 h-5">
                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                  </svg>
                </div>
                <span className="text-lg">Sign in with Google</span>
              </>
            )}
          </button>
          
          <p className="mt-8 text-xs text-neutral-400 font-bold uppercase tracking-widest">
            Professional Property Management
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthReady,
      login,
      logout,
      isReadOnly,
      isAdmin,
      canViewDashboard,
      canManageAccess,
      effectiveOwnerId,
      ownerEmail,
      accessAccounts,
      unseenInvitations,
      switchActiveAccount,
      role,
      restrictedTenantId,
      restrictedTenantName
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
