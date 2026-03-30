import { OperationType } from '../types';

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, userId?: string, email?: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code || '';
  
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: { userId, email },
    operationType,
    path
  }
  
  // High-visibility logging for debugging
  console.group(`%c Firestore Error [${operationType}] `, 'background: #fee2e2; color: #991b1b; font-weight: bold;');
  console.error('Error Details:', errInfo);
  console.error('Error Code:', errCode);
  console.groupEnd();

  // "Resilient Mode": If it's a transient error (Quota or Network), do NOT throw.
  // This allows the app state to update locally, knowing Firestore will sync eventually.
  const isTransient = 
    errCode === 'resource-exhausted' || 
    errCode === 'unavailable' || 
    errMessage.toLowerCase().includes('quota exceeded') ||
    errMessage.toLowerCase().includes('network');

  if (isTransient) {
    console.warn(`[RECOVERY]: Transient ${operationType} failure detected. Local state will persist.`);
    return; // Silently recover for local-first experience
  }

  // Fatal errors (Permissions, Auth) still throw an error to alert the user/dev
  throw new Error(`Firestore ${operationType} failed: ${errMessage}`);
}
