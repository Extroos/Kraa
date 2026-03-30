import { Payment, Tenant, Property } from '../types';
import { format, parseISO, isValid } from 'date-fns';

export const exportPaymentsToCSV = (
  payments: Payment[], 
  tenant: Tenant, 
  property?: Property
) => {
  if (!payments || payments.length === 0) return;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = parseISO(dateStr);
    return isValid(date) ? format(date, 'yyyy-MM-dd') : '-';
  };

  // Header row
  const headers = [
    'Date Paid',
    'Tenant Name',
    'Property',
    'Period Start',
    'Period End',
    'Amount Due',
    'Amount Paid',
    'Balance',
    'Method',
    'Notes',
    'Receipt #'
  ];

  // Data rows
  const rows = [...payments]
    .sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime())
    .map(p => [
      formatDate(p.datePaid),
      `"${tenant.name.replace(/"/g, '""')}"`,
      `"${(property?.name || '-').replace(/"/g, '""')}"`,
      formatDate(p.periodStart),
      formatDate(p.periodEnd),
      p.amount,
      p.paidAmount ?? (p.datePaid ? p.amount : 0),
      p.remainingBalance ?? (p.datePaid ? 0 : p.amount),
      p.paymentMethod || '-',
      `"${(p.notes || '').replace(/"/g, '""')}"`, // Handle quotes and commas in notes
      p.receiptSequence ? p.receiptSequence.toString().padStart(4, '0') : '-'
    ]);

  // Combine into CSV string (with BOM for Excel compatibility)
  const csvContent = "\uFEFF" + [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const filename = `KRA_Report_${tenant.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.csv`;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
