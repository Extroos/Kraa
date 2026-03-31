import { User } from 'firebase/auth';
export type PaymentCycle = 'monthly' | '3_months' | '6_months' | 'yearly';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export type PropertyType = 'شقة' | 'فيلا' | 'مرآب' | 'دار';

export interface Property {
  id: string;
  name: string;
  nameAr?: string;
  type?: PropertyType;
  address: string;
  addressAr?: string;
  city: string;
  notes?: string;
  imageUrl?: string;
  ownerId: string;
  createdAt: string;
  folderId?: string;
}

export interface PropertyFolder {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}


export interface Tenant {
  id: string;
  propertyId: string;
  name: string;
  nameAr?: string;
  phone: string;
  rentAmount: number;
  rentAmountArText?: string;
  paymentCycle: PaymentCycle;
  startDate: string;
  notes?: string;
  ownerId: string;
  createdAt: string;
  tenantStatus?: 'active' | 'archived';
  archiveDate?: string;
  // Summary fields for aggregation
  totalPaid?: number;
  balanceDue?: number;
  totalDebt?: number; // Cumulative across all payments
  lastPaymentDate?: string;
  lastReceiptSequence?: number;
  paymentDay?: 'first' | 'end';
}

export interface Payment {
  id: string;
  tenantId: string;
  year: number;
  amount: number; // Total amount due for this period
  paidAmount?: number; // Actual amount collected (partial pay support)
  remainingBalance?: number; // Calculated balance (amount - paidAmount)
  datePaid?: string;
  paymentMethod?: PaymentMethod;
  periodStart: string;
  periodEnd: string;
  notes?: string;
  ownerId: string;
  createdAt: string;
  receiptSequence?: number;
  hasChequePhoto?: boolean;
}

export type PaymentStatus = 'paid' | 'due' | 'late';

export interface Receipt {
  id: string;
  paymentId: string;
  tenantId: string;
  receiptNumber: number;
  printedAt: string;
  ownerId: string;
}

export interface GlobalStats {
  id: string; // usually 'current'
  totalCollected: number;
  totalDue: number;
  totalExpenses?: number;
  lastUpdated: string;
  ownerId: string;
}

export type ExpenseCategory = 'maintenance' | 'tax' | 'insurance' | 'utilities' | 'other';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: ExpenseCategory;
  propertyId?: string;
  ownerId: string;
  createdAt: string;
}

export interface LandlordAccess {
  id: string;
  ownerId: string;
  ownerEmail?: string;
  landlordEmail: string;
  isAdmin?: boolean;
  isReadOnly?: boolean;
  canViewDashboard?: boolean;
  createdAt: string;
  lastActive?: string;
  accessCount?: number;
  lastVisitedPage?: string;
  isCurrentlyViewing?: boolean;
  restrictedTenantId?: string;
  restrictedTenantName?: string;

  isRevoked?: boolean;
}

export type UserRole = 'owner' | 'landlord';

export interface LayoutPosition {
  x: number;
  y: number;
  fontSize?: number;
  width?: number;
  height?: number;
}

export interface ReceiptLayout {
  id: string; // 'current'
  ownerId: string;
  bgImage?: string;
  bgPosition?: LayoutPosition;
  pageSize?: { width: number, height: number };
  tenantName: LayoutPosition;
  propertyAddress: LayoutPosition;
  amountNumbers: LayoutPosition;
  totalAmountNumbers: LayoutPosition;
  amountLetters: LayoutPosition;
  monthYear: LayoutPosition;
  periodStart: LayoutPosition;
  periodEnd: LayoutPosition;
  paymentDate: LayoutPosition;
  paymentPlace: LayoutPosition;
  propertyType: LayoutPosition;
  tenantReceiptNumber: LayoutPosition;
  lastUpdated: string;
}

export interface TenantWithStatus extends Tenant {
  property: Property;
  nextDueDate: string;
  daysRemaining: number;
  status: PaymentStatus;
  nextPaymentId?: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthReady: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isReadOnly: boolean;
  isAdmin: boolean;
  canViewDashboard: boolean;
  canManageAccess: boolean;
  effectiveOwnerId: string | null;
  ownerEmail: string | null;
  role: UserRole;
  restrictedTenantId?: string;
  restrictedTenantName?: string;
  accessAccounts: LandlordAccess[];
  unseenInvitations: LandlordAccess[];
  switchActiveAccount: (ownerId: string) => Promise<void>;
}
