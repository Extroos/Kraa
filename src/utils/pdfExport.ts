import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Payment, Tenant, Property } from '../types';
import { APP_CONFIG } from '../config/constants';
// @ts-ignore
import ArabicReshaper from 'arabic-reshaper';
import { loadArabicFont } from './pdfFontLoader';

export const exportPaymentsToPDF = async (
  payments: Payment[],
  tenant: Tenant,
  property: Property | undefined,
  t: any,
  isRTL: boolean
) => {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
    putOnlyUsedFonts: true
  });

  // 1. Handle Arabic Reshaping & Font Loading
  if (isRTL) {
    await loadArabicFont(doc);
    doc.setFont('Almarai');
  }

  const reshape = (text: string) => {
    if (!isRTL) return text;
    try {
      const reshaped = ArabicReshaper.reshape(text);
      return reshaped.split('').reverse().join('');
    } catch (e) {
      return text;
    }
  };

  const primaryColor: [number, number, number] = [0, 0, 0]; // Black
  const secondaryColor: [number, number, number] = [100, 100, 100]; // Gray
  const borderColor: [number, number, number] = [0, 0, 0]; // Black lines

  // 2. Header & Branding (Classic Stationary Style)
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(24);
  if (isRTL) doc.setFont('Almarai', 'bold');
  else doc.setFont("helvetica", "bold");
  doc.text(reshape("KRA Property Management"), isRTL ? 200 : 10, 20, { align: isRTL ? 'right' : 'left' });
  
  doc.setFontSize(10);
  if (isRTL) doc.setFont('Almarai', 'normal');
  else doc.setFont("helvetica", "normal");
  doc.text(reshape(t.tenantProfile.financialSummary), isRTL ? 200 : 10, 28, { align: isRTL ? 'right' : 'left' });

  // Classic Divider Line
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.8);
  doc.line(10, 35, 200, 35);

  // 3. Info Bar
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(11);
  const infoY = 48;
  
  // Tenant Info
  if (isRTL) doc.setFont('Almarai', 'bold');
  else doc.setFont("helvetica", "bold");
  doc.text(reshape(t.tenants.tenant), isRTL ? 200 : 15, infoY, { align: isRTL ? 'right' : 'left' });
  if (isRTL) doc.setFont('Almarai', 'normal');
  else doc.setFont("helvetica", "normal");
  doc.text(reshape(tenant.name), isRTL ? 200 : 15, infoY + 6, { align: isRTL ? 'right' : 'left' });

  // Property Info
  if (isRTL) doc.setFont('Almarai', 'bold');
  else doc.setFont("helvetica", "bold");
  doc.text(reshape(t.nav.properties), isRTL ? 110 : 110, infoY, { align: isRTL ? 'right' : 'left' });
  if (isRTL) doc.setFont('Almarai', 'normal');
  else doc.setFont("helvetica", "normal");
  doc.text(reshape(property?.name || "-"), isRTL ? 110 : 110, infoY + 6, { align: isRTL ? 'right' : 'left' });

  // 4. Financial Summary Boxes (Simplified Classic)
  const boxY = 65;
  const boxW = 60;
  const boxH = 18;

  // Total Paid
  doc.setLineWidth(0.2);
  doc.setDrawColor(200, 200, 200);
  doc.rect(15, boxY, boxW, boxH);
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(reshape(t.tenantProfile.totalPaid), 15 + (boxW/2), boxY + 6, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  if (isRTL) doc.setFont('Almarai', 'bold');
  doc.text(`${(tenant.totalPaid || 0).toLocaleString()} ${APP_CONFIG.CURRENCY}`, 15 + (boxW/2), boxY + 13, { align: 'center' });

  // Balance Due
  doc.rect(15 + boxW + 5, boxY, boxW, boxH);
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(reshape(t.tenantProfile.balance), 15 + boxW + 5 + (boxW/2), boxY + 6, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`${(tenant.balanceDue || 0).toLocaleString()} ${APP_CONFIG.CURRENCY}`, 15 + boxW + 5 + (boxW/2), boxY + 13, { align: 'center' });

  // 5. Payment Table
  const tableHeaders = [
    t.tenantProfile.periodStart,
    t.tenantProfile.paymentAmount,
    t.tenantProfile.balance,
    t.common.confirm, // Status
    t.common.proceed // Receipt #
  ];

  const tableData = payments
    .sort((a,b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime())
    .map(p => [
      format(new Date(p.periodStart), 'MMM yyyy'),
      `${(p.paidAmount ?? (p.datePaid ? p.amount : 0)).toLocaleString()} / ${p.amount.toLocaleString()}`,
      `${(p.remainingBalance ?? (p.datePaid ? 0 : p.amount)).toLocaleString()}`,
      p.datePaid ? t.tenants.active : t.tenants.archived,
      p.receiptSequence ? `#${p.receiptSequence.toString().padStart(4, '0')}` : '-'
    ]);

  autoTable(doc, {
    startY: 95,
    head: [tableHeaders.map(h => reshape(h))],
    body: tableData.map(row => row.map(cell => reshape(cell))),
    styles: { 
      font: isRTL ? 'Almarai' : 'helvetica',
      fontSize: 9,
      cellPadding: 4,
      halign: isRTL ? 'right' : 'left',
      textColor: [0, 0, 0]
    },
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: isRTL ? 'normal' : 'bold' // Bold is separate in Almarai so we use normal for now
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250]
    },
    theme: 'striped',
    margin: { top: 30 }
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    if (isRTL) doc.setFont('Almarai', 'normal');
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    const footerText = `KRA Property Management | ${format(new Date(), 'yyyy-MM-dd HH:mm')} | ${i} / ${pageCount}`;
    doc.text(reshape(footerText), 105, 285, { align: 'center' });
  }

  doc.save(`KRA_Statement_${tenant.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
