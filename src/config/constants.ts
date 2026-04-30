export const APP_CONFIG = {
  CURRENCY: 'Dh',
  DATE_FORMAT: 'yyyy-MM-dd',
  DISPLAY_DATE_FORMAT: 'MMM d, yyyy',
  MONTH_YEAR_FORMAT: 'MMMM yyyy',
  SHORT_MONTH_YEAR_FORMAT: 'MMM yyyy',
  USE_MOCK_AUTH: false, // Set to true to bypass Firebase domain restrictions on localhost
};

export const FIREBASE_COLLECTIONS = {
  PROPERTIES: 'properties',
  TENANTS: 'tenants',
  PAYMENTS: 'payments',
  RECEIPTS: 'receipts',
  STATS: 'stats',
  LAYOUTS: 'layouts',
  EXPENSES: 'expenses',
  LANDLORD_ACCESS: 'landlord_access',
  FOLDERS: 'folders',
};

export const DEFAULT_RECEIPT_LAYOUT = {
  bgImage: '',
  bgPosition: { x: 0, y: 0, width: 210, height: 297 },
  receiptNumber: { x: 170, y: 20, fontSize: 12, color: '#000000', visible: true },
  date: { x: 170, y: 30, fontSize: 12, color: '#000000', visible: true },
  tenantName: { x: 40, y: 60, fontSize: 14, color: '#000000', visible: true },
  amount: { x: 40, y: 80, fontSize: 14, color: '#000000', visible: true },
  property: { x: 40, y: 100, fontSize: 14, color: '#000000', visible: true },
  period: { x: 40, y: 120, fontSize: 12, color: '#000000', visible: true },
  notes: { x: 40, y: 140, fontSize: 12, color: '#000000', visible: true },
  pageSize: 'A4'
};
