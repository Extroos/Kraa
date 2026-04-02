import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useAppContext } from '../hooks/useAppContext';
import { format, parseISO, isValid, addMonths } from 'date-fns';
import { Receipt, Payment, ReceiptLayout, LayoutPosition } from '../types';
import { Button } from '../components/ui';
import { DEFAULT_RECEIPT_LAYOUT } from '../store/AppProvider';
import { numberToArabicWords } from '../utils/arabic';
import { useTranslation } from '../i18n';
import { 
  AlertCircle, 
  Printer, 
  Move, 
  Save, 
  X as CloseIcon, 
  Edit3, 
  FileImage, 
  Lock, 
  Unlock, 
  Maximize, 
  Minimize,
  Eye,
  RotateCcw,
  CheckCircle
} from 'lucide-react';

export const ReceiptPreview: React.FC = () => {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const { isReadOnly } = useAuth();
  const { 
    payments, 
    tenants, 
    properties, 
    receipts,
    generateReceipt, 
    fetchTenantPayments, 
    receiptLayout, 
    saveReceiptLayout, 
    updateReceipt,
    updateLandlordActivity 
  } = useAppContext();
  const { t, isRTL } = useTranslation();

  useEffect(() => {
    if (paymentId) {
      updateLandlordActivity(t.receipt.preview);
    }
  }, [paymentId, updateLandlordActivity, t.receipt.preview]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editingField, setEditingField] = useState<keyof ReceiptLayout | null>(null);
  const [editValue, setEditValue] = useState('');
  const initialized = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [paymentList, setPaymentList] = useState<Payment[]>([]);
  const payment = paymentList[0] || null;
  const tenant = payment ? tenants.find(t => t.id === payment.tenantId) : undefined;
  const property = tenant ? properties.find(p => p.id === tenant.propertyId) : undefined;

  // Design Mode State
  const [isDesigning, setIsDesigning] = useState(false);
  const [tempLayout, setTempLayout] = useState<ReceiptLayout | null>(null);
  const [isImageLocked, setIsImageLocked] = useState(true);
  const [activeField, setActiveField] = useState<keyof Omit<ReceiptLayout, 'id' | 'ownerId' | 'lastUpdated'> | 'backgroundImage' | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const currentLayout = useMemo(() => {
    if (!receiptLayout) return DEFAULT_RECEIPT_LAYOUT as unknown as ReceiptLayout;
    return { 
      ...DEFAULT_RECEIPT_LAYOUT, 
      ...receiptLayout,
      bgPosition: receiptLayout.bgPosition || DEFAULT_RECEIPT_LAYOUT.bgPosition,
      pageSize: receiptLayout.pageSize || DEFAULT_RECEIPT_LAYOUT.pageSize
    } as ReceiptLayout;
  }, [receiptLayout]);

  const receipt = useMemo(() => {
    if (!paymentId) return null;
    const ids = paymentId.split(',');
    return receipts.find(r => r.paymentId === ids[0]) || null;
  }, [receipts, paymentId]);

  const [bgFile, setBgFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Responsive Zoom State
  const [isZoomed, setIsZoomed] = useState(false);
  const [viewportScale, setViewportScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const pageWidthMm = currentLayout.pageSize?.width || 165;
      const pageWidthPx = pageWidthMm * 3.7795275591; // Convert mm to px approx
      const availableWidth = window.innerWidth - 32; // Margin
      
      if (availableWidth < pageWidthPx) {
        setViewportScale(availableWidth / pageWidthPx);
      } else {
        setViewportScale(1);
      }
    };
    
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [currentLayout]);

  // Keyboard shortcuts for designer
  useEffect(() => {
    if (!isDesigning || !activeField || !tempLayout) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 1 : 0.1;
      
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        adjustPosition(e.key, step);
      } else if (e.key === '+' || e.key === '=') {
        adjustSize(activeField === 'backgroundImage' ? 'background' : 'current', 'font', 1);
      } else if (e.key === '-' || e.key === '_') {
        adjustSize(activeField === 'backgroundImage' ? 'background' : 'current', 'font', -1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDesigning, activeField, tempLayout]);

  const adjustPosition = (key: string, step: number) => {
    if (!tempLayout || !activeField) return;
    const isBg = activeField === 'backgroundImage';
    const target = isBg ? tempLayout.bgPosition : (tempLayout[activeField as keyof ReceiptLayout] as LayoutPosition);
    
    const newPos = { ...target };
    if (key === 'ArrowUp') newPos.y -= step;
    if (key === 'ArrowDown') newPos.y += step;
    if (key === 'ArrowLeft') newPos.x -= step;
    if (key === 'ArrowRight') newPos.x += step;

    setTempLayout({
      ...tempLayout,
      [isBg ? 'bgPosition' : activeField]: newPos
    });
  };

  const tenantPaymentIndex = useMemo(() => {
    if (!tenant || !paymentId) return 1;
    const ids = paymentId.split(',');
    const primaryId = ids[ids.length - 1]; // Use the latest payment in the group for the index
    const sortedPayments = payments
      .filter(p => p.tenantId === tenant.id)
      .sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());
    const currentIndex = sortedPayments.findIndex(p => p.id === primaryId);
    return currentIndex !== -1 ? currentIndex + 1 : 1;
  }, [tenant, payments, paymentId]);

  const formatSequence = (num: number) => num.toString().padStart(4, '0');

  useEffect(() => {
    if (initialized.current) return;
    
    const initReceipt = async () => {
      if (!paymentId) {
        setError(t.common.somethingWrong);
        setLoading(false);
        return;
      }

      const ids = paymentId.split(',');
      const foundPayments: Payment[] = [];
      
      for (const id of ids) {
        let p = payments.find(pay => pay.id === id);
        if (!p) {
          try {
            const parts = id.split('_');
            if (parts.length >= 3) {
              const tId = parts[0];
              const year = parseInt(parts[1], 10);
              const fetched = await fetchTenantPayments(tId, year);
              p = fetched.find(pay => pay.id === id);
            }
          } catch (err) { console.error("Historical lookup failed:", id, err); }
        }
        if (p) foundPayments.push(p);
      }

      if (foundPayments.length === 0 || !tenants.find(t => t.id === foundPayments[0]?.tenantId)) {
        setError(t.receipt.failedLoad);
        setLoading(false);
        return;
      }

      setPaymentList(foundPayments);
      initialized.current = true;
      try {
        await generateReceipt(ids[0]);
        setLoading(false);
      } catch (err) {
        console.error("Failed to generate receipt:", err);
        setError(t.receipt.failedLoad);
        setLoading(false);
      }
    };

    initReceipt();
  }, [paymentId, payments, tenants, properties, generateReceipt, fetchTenantPayments, t]);

  const handleDragStart = (e: React.MouseEvent, field: keyof Omit<ReceiptLayout, 'id' | 'ownerId' | 'lastUpdated'> | 'backgroundImage') => {
    if (!isDesigning) return;
    if (field === 'backgroundImage' && isImageLocked) return;
    
    e.preventDefault();
    setActiveField(field);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDesigning || !activeField || !dragStart || !tempLayout || !containerRef.current) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    const pageWidth = tempLayout.pageSize?.width || 165;
    const pxPerMm = containerRef.current.clientWidth / pageWidth;
    const dxMm = dx / pxPerMm;
    const dyMm = dy / pxPerMm;

    if (activeField === 'backgroundImage') {
      const currentPos = tempLayout.bgPosition || DEFAULT_RECEIPT_LAYOUT.bgPosition;
      setTempLayout({
        ...tempLayout,
        bgPosition: {
          ...currentPos,
          x: Math.round((currentPos.x + dxMm) * 10) / 10,
          y: Math.round((currentPos.y + dyMm) * 10) / 10
        }
      });
    } else {
      const currentPos = tempLayout[activeField as keyof ReceiptLayout] as LayoutPosition;
      setTempLayout({
        ...tempLayout,
        [activeField]: {
          ...currentPos,
          x: Math.round((currentPos.x + dxMm) * 10) / 10,
          y: Math.round((currentPos.y + dyMm) * 10) / 10
        }
      });
    }

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setDragStart(null);
  };

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && tempLayout) {
      setBgFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempLayout({
          ...tempLayout,
          bgImage: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetLayout = () => {
    if (window.confirm(t.receipt.resetLayout)) {
      setTempLayout(DEFAULT_RECEIPT_LAYOUT as unknown as ReceiptLayout);
      setBgFile(null);
    }
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (!isDesigning) return;
    // Only deselect if clicking the container background, not a field
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('design-grid') || (e.target as HTMLElement).classList.contains('print-container')) {
      setActiveField(null);
    }
  };

  const handleSaveLayout = async () => {
    if (tempLayout) {
      setLoading(true);
      await saveReceiptLayout(tempLayout, bgFile || undefined);
      // Give standard Firestore latency some room to reflect in state
      setTimeout(() => {
        setIsDesigning(false);
        setTempLayout(null);
        setBgFile(null);
        setLoading(false);
      }, 300);
    }
  };

  const handleFieldEdit = (field: keyof ReceiptLayout, currentContent: string | number) => {
    if (!isEditingText || isDesigning) return;
    setEditingField(field);
    setEditValue(String(receipt?.customFields?.[field] || currentContent));
  };

  const saveCustomField = async () => {
    if (!receipt || !editingField) return;
    
    const newCustomFields = {
      ...(receipt.customFields || {}),
      [editingField]: editValue
    };

    await updateReceipt(receipt.id, { customFields: newCustomFields });
    setEditingField(null);
  };

  const adjustSize = (field: 'current' | 'background' | 'page', type: 'font' | 'width' | 'height', delta: number) => {
    if (!tempLayout) return;
    
    if (field === 'page') {
      const size = tempLayout.pageSize || { width: 165, height: 103 };
      setTempLayout({
        ...tempLayout,
        pageSize: {
          ...size,
          [type]: Math.max(50, Math.min(500, (size[type as 'width' | 'height'] || (type === 'width' ? 165 : 103)) + delta))
        }
      });
    } else if (field === 'background') {
      // Background size is now master-controlled by paper size
      // We only allow x/y position adjustments for nudging
      if (type === 'width' || type === 'height') return;
      
      const pos = tempLayout.bgPosition || DEFAULT_RECEIPT_LAYOUT.bgPosition;
      const key = type as keyof LayoutPosition;
      setTempLayout({
        ...tempLayout,
        bgPosition: {
          ...pos,
          [key]: Math.round((((pos as any)[key] || 0) + delta) * 10) / 10
        } as LayoutPosition
      });
    } else if (activeField && activeField !== 'backgroundImage') {
      const pos = tempLayout[activeField as keyof ReceiptLayout] as LayoutPosition;
      if (type === 'font') {
        const currentSize = pos.fontSize || 14;
        setTempLayout({
          ...tempLayout,
          [activeField]: {
            ...pos,
            fontSize: Math.max(8, Math.min(48, currentSize + delta))
          }
        });
      }
    }
  };

  // Data calculations (Must be before early returns)
  const monthNamesArr = useMemo(() => {
    return paymentList.map(p => {
      const d = parseISO(p.periodStart);
      return { month: isValid(d) ? d.getMonth() + 1 : 1, year: isValid(d) ? d.getFullYear() : 2026 };
    }).sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  }, [paymentList]);

  const arabicMonths = ["يناير", "فبراير", "مارس", "أبريل", "ماي", "يونيو", "يوليوز", "غشت", "شتنبر", "أكتوبر", "نونبر", "دجنبر"];
  
  const monthCount = useMemo(() => {
    let total = 0;
    paymentList.forEach(p => {
      const s = parseISO(p.periodStart);
      const e = parseISO(p.periodEnd);
      if (isValid(s) && isValid(e)) {
        const diff = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth() + 1);
        total += Math.max(1, diff);
      } else {
        total += 1;
      }
    });
    return total || 1;
  }, [paymentList]);

  const isPaid = useMemo(() => paymentList.some(p => !!p.datePaid), [paymentList]);
  
  const totalAmountValue = useMemo(() => {
    if (isPaid) {
      return paymentList.reduce((sum, p) => sum + (p.paidAmount ?? p.amount), 0);
    }
    // If unpaid/revoked, use LIVE rent from tenant record for preview
    return (tenant?.rentAmount || 0) * monthCount;
  }, [paymentList, isPaid, tenant?.rentAmount, monthCount]);

  const baseRent = useMemo(() => Math.round(totalAmountValue / monthCount), [totalAmountValue, monthCount]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-500/10 border-t-primary-500 rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t.receipt.syncing}</p>
        </div>
      </div>
    );
  }

  if (error || !payment || !tenant || !property || !receipt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 p-6">
        <div className={`bg-white p-10 rounded shadow-sm text-center max-w-md w-full border border-neutral-200 ${isRTL ? 'rtl' : ''}`}>
          <div className="w-16 h-16 bg-danger-50 text-danger-600 rounded-full flex items-center justify-center mx-auto mb-6 border border-danger-100">
            <AlertCircle className="w-12 h-12" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2 tracking-tight uppercase">{t.receipt.systemError}</h2>
          <p className="text-sm text-neutral-500 font-medium mb-8 leading-relaxed">{error || t.receipt.failedLoad}</p>
          <Button onClick={() => navigate(-1)} variant="secondary" className="w-full h-11">{t.receipt.backToDashboard}</Button>
        </div>
      </div>
    );
  }

  let arabicMonthYear = "";
  if (monthNamesArr.length === 0) {
    arabicMonthYear = "---";
  } else if (monthCount === 1) {
    arabicMonthYear = `${arabicMonths[monthNamesArr[0].month - 1]} ${monthNamesArr[0].year}`;
  } else {
    // Multi-month (either bulk or cycle)
    const first = monthNamesArr[0];
    let last = monthNamesArr[monthNamesArr.length - 1];
    
    // If it's a single payment covering multiple months, expand manually
    if (paymentList.length === 1 && monthCount > 1) {
       const p = paymentList[0];
       const e = parseISO(p.periodEnd);
       last = { month: e.getMonth() + 1, year: e.getFullYear() };
    }

    if (first.year === last.year && first.month === last.month) {
      arabicMonthYear = `${arabicMonths[first.month - 1]} ${first.year}`;
    } else if (first.year === last.year) {
      arabicMonthYear = `من ${arabicMonths[first.month - 1]} إلى ${arabicMonths[last.month - 1]} ${first.year}`;
    } else {
      arabicMonthYear = `من ${arabicMonths[first.month - 1]} ${first.year} إلى ${arabicMonths[last.month - 1]} ${last.year}`;
    }
  }
  
  const paymentDate = payment?.datePaid ? new Date(payment.datePaid) : new Date(receipt?.printedAt || new Date());
  const formatDateFR = (date: Date) => isValid(date) ? format(date, 'dd/MM/yyyy') : '??/??/????';
  
  const startDate = monthNamesArr.length > 0 ? new Date(monthNamesArr[0].year, monthNamesArr[0].month - 1, 1) : new Date();
  // Adjust endDate for multi-month selections
  let endDate: Date;
  if (paymentList.length === 1 && monthCount > 1) {
    endDate = parseISO(paymentList[0].periodEnd);
  } else {
    const lastP = paymentList.sort((a,b) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime())[paymentList.length - 1];
    endDate = lastP ? parseISO(lastP.periodEnd) : new Date();
  }

  // Defensive check for invalid dates to prevent crashes
  const safeStartDate = isValid(startDate) ? startDate : new Date();
  const safeEndDate = isValid(endDate) ? endDate : new Date();
  const safePaymentDate = isValid(paymentDate) ? paymentDate : new Date();

  const displayLayout = isDesigning ? tempLayout || currentLayout : currentLayout;

  const handleTouchStart = (e: React.TouchEvent, field: keyof Omit<ReceiptLayout, 'id' | 'ownerId' | 'lastUpdated'> | 'backgroundImage') => {
    if (!isDesigning) return;
    if (field === 'backgroundImage' && isImageLocked) return;
    
    const touch = e.touches[0];
    setActiveField(field);
    setDragStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDesigning || !activeField || !dragStart || !tempLayout || !containerRef.current) return;

    const touch = e.touches[0];
    const dx = touch.clientX - dragStart.x;
    const dy = touch.clientY - dragStart.y;

    const pageWidth = tempLayout.pageSize?.width || 165;
    const pxPerMm = containerRef.current.clientWidth / pageWidth;
    const dxMm = dx / pxPerMm;
    const dyMm = dy / pxPerMm;

    if (activeField === 'backgroundImage') {
      const currentPos = tempLayout.bgPosition || DEFAULT_RECEIPT_LAYOUT.bgPosition;
      setTempLayout({
        ...tempLayout,
        bgPosition: {
          ...currentPos,
          x: Math.round((currentPos.x + dxMm) * 10) / 10,
          y: Math.round((currentPos.y + dyMm) * 10) / 10
        }
      });
    } else {
      const currentPos = tempLayout[activeField as keyof ReceiptLayout] as LayoutPosition;
      setTempLayout({
        ...tempLayout,
        [activeField]: {
          ...currentPos,
          x: Math.round((currentPos.x + dxMm) * 10) / 10,
          y: Math.round((currentPos.y + dyMm) * 10) / 10
        }
      });
    }

    setDragStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    setDragStart(null);
  };

  const renderField = (field: keyof Omit<ReceiptLayout, 'id' | 'ownerId' | 'lastUpdated'>, content: string | number, extraClass = '', isRtl = false) => {
    const pos = displayLayout[field] as LayoutPosition;
    const fontSize = pos.fontSize || 14;
    const isOverridden = receipt?.customFields && receipt.customFields[field];
    const displayContent = isOverridden ? receipt.customFields![field] : content;

    return (
      <div 
        className={`receipt-field cursor-move select-none group touch-none ${extraClass} ${
          isDesigning && activeField === field ? 'ring-2 ring-primary-500 z-50' : ''
        } ${isDesigning ? 'hover:bg-primary-500/5 transition-colors' : ''} ${
          isEditingText ? 'hover:ring-2 hover:ring-warning-400 hover:bg-warning-50/30 cursor-pointer ring-1 ring-dashed ring-neutral-200' : ''
        } ${isOverridden ? 'text-primary-700' : ''}`}
        style={{ 
          left: `${pos.x}mm`, 
          top: `${pos.y}mm`,
          fontSize: `${fontSize}px`
        }}
        dir={isRtl ? 'rtl' : 'ltr'}
        onMouseDown={(e) => handleDragStart(e, field)}
        onTouchStart={(e) => handleTouchStart(e, field)}
        onClick={() => handleFieldEdit(field as keyof ReceiptLayout, content)}
      >
        {displayContent}
        {isDesigning && (
          <div className="absolute -top-6 left-0 text-[10px] font-bold bg-primary-600 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none uppercase tracking-tighter">
            {pos.x}mm , {pos.y}mm
          </div>
        )}
        {isEditingText && (
          <div className="absolute -bottom-4 right-0 text-[8px] font-bold bg-warning-600 text-white px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none uppercase">
            Edit
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className={`min-h-screen bg-neutral-100 print:bg-white flex flex-col items-center py-6 sm:py-16 print:py-0 print:block print:relative`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleBackgroundClick}
    >
      <style>{`
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @page { 
          size: auto; 
          margin: 0 !important; 
        }
        @media print {
          html, body { 
            display: block !important;
            width: 100% !important; 
            height: 100% !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            overflow: visible !important;
            background: white !important;
          }
          .print-container { 
            position: absolute !important; 
            top: 50% !important; 
            left: 0 !important; 
            transform: translateY(-50%) !important; 
            margin: 0 !important; 
            width: ${displayLayout.pageSize?.width || 165}mm !important; 
            height: ${displayLayout.pageSize?.height || 103}mm !important; 
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            page-break-after: avoid; 
            page-break-before: avoid; 
          }
          nav, header, aside, .designer-controls, .designer-overlay, .background-guide, .no-print { display: none !important; }
        }
        @media screen {
          .print-container { position: relative; width: ${displayLayout.pageSize?.width || 165}mm; height: ${displayLayout.pageSize?.height || 103}mm; background: white; margin: auto; border: 1px solid #d1d5db; shadow-sm; overflow: visible; z-index: 10; }
          .design-grid { position: absolute; inset: -200mm; background-size: 5mm 5mm; background-image: radial-gradient(circle, #e2e8f0 0.8px, transparent 0.8px); pointer-events: none; z-index: -1; }
        }
        .receipt-field { position: absolute; font-family: 'Times New Roman', serif; font-weight: bold; color: #1a1a1a; white-space: nowrap; }
        .moving-viewport { 
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100%;
            min-width: 100%;
            -webkit-overflow-scrolling: touch; 
            scrollbar-width: none; 
            overflow: auto !important; 
            padding: 60px 120px !important;
            scroll-behavior: smooth;
        }
        .designer-active-viewport {
            padding: 300px 500px !important;
        }
        @media (max-width: 640px) {
            .moving-viewport { padding: 40px 24px 120px 24px !important; }
            .designer-active-viewport { padding: 250px 350px 400px 350px !important; }
        }
        .moving-viewport::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Controls Overlay - Sticky to Screen */}
      <div 
        className={`fixed left-4 right-4 sm:left-auto sm:right-8 flex flex-col items-center sm:items-end gap-2 sm:gap-3 print:hidden z-50 designer-controls ${isRTL ? 'sm:flex-row-reverse' : ''}`}
        style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        {isDesigning ? (
          <div className={`flex flex-wrap items-center justify-center gap-1.5 sm:gap-3 bg-white/95 backdrop-blur p-2 rounded-2xl border border-neutral-200 shadow-xl max-w-full ${isRTL ? 'flex-row-reverse' : ''}`}>
            {/* Reset Button Cluster */}
            <div className="flex items-center gap-1.5">
              <Button 
                  onClick={handleResetLayout} 
                  variant="secondary" 
                  className="h-10 w-10 p-0 hover:bg-danger-50 hover:border-danger-100 transition-colors group"
                  title={t.receipt.resetLayout}
              >
                <RotateCcw style={{ color: '#dc2626' }} className="w-5 h-5 shrink-0 block group-hover:scale-110 transition-transform" strokeWidth={2.5} />
              </Button>
              <div className="h-6 w-px bg-neutral-200" />
              
              {/* Paper Size Editor */}
              <div className={`flex items-center gap-1.5 bg-neutral-50 px-2 py-1.5 rounded-xl border border-neutral-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
                 <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                   <input 
                      type="number" 
                      value={tempLayout?.pageSize?.width || 165} 
                      onChange={(e) => adjustSize('page', 'width', parseInt(e.target.value) - (tempLayout?.pageSize?.width || 165))}
                      style={{ color: '#0f172a' }}
                      className="w-10 bg-transparent text-center text-[10px] font-black outline-none"
                   />
                   <span className="text-neutral-400 mx-0.5 font-bold text-[10px]">x</span>
                   <input 
                      type="number" 
                      value={tempLayout?.pageSize?.height || 103} 
                      onChange={(e) => adjustSize('page', 'height', parseInt(e.target.value) - (tempLayout?.pageSize?.height || 103))}
                      style={{ color: '#0f172a' }}
                      className="w-10 bg-transparent text-center text-[10px] font-black outline-none"
                   />
                 </div>
              </div>
            </div>

            <div className="h-6 w-px bg-neutral-200 hidden sm:block" />

            {/* Template & Lock Cluster */}
            <div className="flex items-center gap-1.5">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleTemplateUpload} />
              <Button 
                  onClick={() => fileInputRef.current?.click()} 
                  variant="secondary" 
                  className="h-10 w-10 p-0 hover:text-primary-600"
                  title={t.receipt.uploadTemplate}
              >
                <FileImage style={{ color: '#1e293b' }} className="w-5 h-5 shrink-0 block" strokeWidth={2.5} />
              </Button>

              <Button 
                  onClick={() => {
                    setIsImageLocked(!isImageLocked);
                    if (!isImageLocked) setActiveField(null);
                  }} 
                  variant="secondary" 
                  className={`h-10 w-10 p-0 transition-all ${!isImageLocked ? 'bg-warning-50 border-warning-200 shadow-inner' : ''}`}
                  title={isImageLocked ? t.receipt.unlockBackground : t.receipt.lockBackground}
              >
                {isImageLocked ? <Lock style={{ color: '#475569' }} className="w-5 h-5 shrink-0 block" strokeWidth={2.5} /> : <Unlock style={{ color: '#d97706' }} className="w-5 h-5 shrink-0 block" strokeWidth={2.5} />}
              </Button>
            </div>

            <div className="h-10 w-px bg-neutral-200 hidden sm:block" />

            {/* Action Cluster */}
            <div className="flex items-center gap-1.5">
              <Button onClick={handleSaveLayout} className="bg-primary-600 hover:bg-primary-700 h-10 px-5 font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-primary-500/20 active:translate-y-0.5 transition-all text-white">
                 {t.receipt.applyLayout}
              </Button>
              <Button 
                onClick={() => { setIsDesigning(false); setTempLayout(null); setActiveField(null); setIsImageLocked(true); }} 
                variant="secondary" 
                className="h-10 w-10 p-0 transition-colors"
                title={t.common.cancel}
              >
                <CloseIcon style={{ color: '#64748b' }} className="w-5 h-5 shrink-0 block hover:text-red-600" strokeWidth={2.5} />
              </Button>
            </div>
          </div>
        ) : (
          <div className={`flex flex-wrap items-center justify-center gap-2 sm:gap-3 bg-white/95 backdrop-blur p-2 rounded-2xl border border-neutral-200 shadow-lg ${isRTL ? 'flex-row-reverse' : ''}`}>
            {!isReadOnly && (
              <>
                <Button 
                  onClick={() => { 
                    setTempLayout(currentLayout); 
                    setIsDesigning(true); 
                    setIsEditingText(false);
                  }} 
                  variant="secondary" 
                  className="bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600 h-10 px-4 sm:px-5 font-black uppercase tracking-widest text-[9px] sm:text-[10px] rounded-xl"
                >
                  <Edit3 className={`w-4 h-4 sm:w-5 sm:h-5 ${isRTL ? 'ml-1 sm:ml-2' : 'mr-1 sm:mr-2'}`} /> {t.receipt.designerMode}
                </Button>

                <Button 
                  onClick={() => setIsEditingText(!isEditingText)} 
                  variant="secondary" 
                  className={`h-10 px-4 sm:px-5 font-black uppercase tracking-widest text-[9px] sm:text-[10px] rounded-xl transition-all ${
                    isEditingText 
                    ? 'bg-warning-50 border-warning-200 text-warning-700 shadow-inner' 
                    : 'bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600'
                  }`}
                >
                  <Save className={`w-4 h-4 sm:w-5 sm:h-5 ${isRTL ? 'ml-1 sm:ml-2' : 'mr-1 sm:mr-2'}`} />
                  {isEditingText ? 'Stop Editing' : 'Edit Text'}
                </Button>
              </>
            )}
            
            <Button 
                onClick={() => setIsZoomed(!isZoomed)} 
                variant="secondary" 
                className={`h-10 w-10 sm:w-auto sm:px-4 p-0 bg-white border-neutral-200 sm:font-black sm:uppercase sm:tracking-widest sm:text-[10px] rounded-xl ${!isZoomed ? 'bg-primary-50/30' : ''}`}
                title={isZoomed ? "Switch to Fit Screen" : "Switch to Full Size"}
            >
              {isZoomed ? <Minimize style={{ color: '#475569' }} className="w-5 h-5 shrink-0" strokeWidth={2.5} /> : <Maximize style={{ color: '#1a5f9f' }} className="w-5 h-5 shrink-0" strokeWidth={2.5} />}
            </Button>

            <Button onClick={() => window.print()} className="bg-primary-600 hover:bg-primary-700 h-10 px-5 sm:px-6 font-black uppercase tracking-widest text-[10px] sm:text-xs shadow-md rounded-xl text-white">
              <Printer style={{ color: '#ffffff' }} className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 ${isRTL ? 'ml-1 sm:ml-2' : 'mr-1 sm:mr-2'}`} strokeWidth={2.5} /> {t.receipt.printDocument}
            </Button>
            <Button onClick={() => navigate(-1)} variant="secondary" className="h-10 w-10 p-0 transition-colors rounded-xl">
               <CloseIcon style={{ color: '#94a3b8' }} className="w-5 h-5 shrink-0" strokeWidth={2.5} />
            </Button>
          </div>
        )}
      </div>

      {/* Field Editor Overlay - Universal for PC & Mobile */}
      {isDesigning && (
        <div 
          className="fixed left-6 right-6 sm:left-auto sm:right-10 sm:w-80 sm:bottom-10 z-50 designer-overlay"
          style={{ bottom: 'max(calc(env(safe-area-inset-bottom) + 1.5rem), 2.5rem)' }}
        >
          <div className="bg-neutral-900 border border-white/10 text-white px-5 py-4 rounded-3xl shadow-2xl flex flex-col gap-4">
            <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
               <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Move className="w-4 h-4 text-primary-400" />
                  <p className="text-[10px] font-black uppercase tracking-widest leading-none">
                    {activeField ? t.receipt[activeField as keyof typeof t.receipt] || activeField.toString() : 'Select Field'}
                  </p>
               </div>
               <div className="flex gap-1">
                  <button onClick={() => adjustSize('current', 'font', 1)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-black text-xs">A+</button>
                  <button onClick={() => adjustSize('current', 'font', -1)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-black text-xs">A-</button>
               </div>
            </div>

            {activeField && activeField !== 'backgroundImage' && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[8px] font-black uppercase tracking-tighter text-neutral-400">
                   <span>Small</span>
                   <span>Precision Size Slider</span>
                   <span>Large</span>
                </div>
                <input 
                  type="range" 
                  min="8" 
                  max="48" 
                  value={(displayLayout[activeField as keyof ReceiptLayout] as LayoutPosition).fontSize || 14}
                  onChange={(e) => adjustSize('current', 'font', parseInt(e.target.value) - ((displayLayout[activeField as keyof ReceiptLayout] as LayoutPosition).fontSize || 14))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Preview Container - Scalable & Swipeable */}
      <div className={`w-full flex-1 flex flex-col items-center pt-16 sm:pt-4 ${!isZoomed && !isDesigning ? 'overflow-hidden' : ''}`}>
        {/* Sliding Viewport for Horizontal Support & Centering */}
        <div className={`w-full max-w-full moving-viewport ${isDesigning ? 'designer-active-viewport' : ''}`}>
          
          <div 
            className="print-container flex-shrink-0 transition-all duration-300 ease-out origin-top" 
            dir="ltr" 
            id="receipt-doc"
            ref={containerRef}
            style={{ 
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
              transform: isDesigning ? (isZoomed ? 'scale(1.05)' : `scale(${Math.min(1.02, viewportScale + 0.05)})`) : (isZoomed ? 'scale(1)' : `scale(${viewportScale})`),
              borderRadius: '2px', // Slight radius for card feel
            }}
          >
            {/* Background Image Layer - High Stability Guide */}
            <div 
                className={`absolute select-none overflow-hidden background-guide print:hidden ${isDesigning ? 'opacity-40' : 'opacity-25'}`}
                style={{
                    left: `${displayLayout.bgPosition?.x || 0}mm`,
                    top: `${displayLayout.bgPosition?.y || 0}mm`,
                    width: `${displayLayout.pageSize?.width || 165}mm`,
                    height: `${displayLayout.pageSize?.height || 103}mm`,
                    pointerEvents: isDesigning && !isImageLocked ? 'auto' : 'none',
                    cursor: isDesigning && !isImageLocked ? 'move' : 'default',
                    zIndex: isDesigning && !isImageLocked ? 10 : 0
                }}
                onMouseDown={(e: React.MouseEvent) => handleDragStart(e, 'backgroundImage')}
                onTouchStart={(e: React.TouchEvent) => handleTouchStart(e, 'backgroundImage')}
            >
              <img src={displayLayout.bgImage || '/kra.jpg'} alt="Template" className="w-full h-full object-fill" />
              
              {isDesigning && activeField === 'backgroundImage' && (
                <div className="absolute inset-0 ring-4 ring-warning-500/50 bg-warning-500/5 flex items-center justify-center">
                    <span className="text-[10px] font-black text-warning-700 bg-white/95 px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm">{t.receipt.templateUnlocked}</span>
                </div>
              )}
            </div>
            
            {isDesigning && <div className="design-grid pointer-events-none" />}

            {renderField('tenantName', tenant.nameAr || tenant.name, '', true)}
            {renderField('propertyAddress', property.addressAr || property.address, '', true)}
            {renderField('amountNumbers', payment.paidAmount ?? payment.amount)}
            {renderField('totalAmountNumbers', totalAmountValue)}
            {renderField('amountLetters', totalAmountValue > 0 ? numberToArabicWords(totalAmountValue) : '', '', true)}
            {renderField('monthYear', arabicMonthYear, '', true)}
            {renderField('periodStart', formatDateFR(safeStartDate))}
            {renderField('periodEnd', formatDateFR(safeEndDate))}
            {renderField('paymentDate', formatDateFR(safePaymentDate))}
            {renderField('paymentPlace', t.receipt.paymentPlacePlaceholder, '', true)}
            {renderField('propertyType', (() => {
              const type = String(property.type || 'Apartment');
              const mapping: Record<string, string> = {
                'Apartment': 'شقة',
                'Villa': 'فيلا',
                'Garage': 'مرآب',
                'House': 'دار',
                'شقة': 'شقة',
                'فيلا': 'فيلا',
                'مرآب': 'مرآب',
                'دار': 'دار'
              };
              return mapping[type] || type;
            })(), '', true)}
            {renderField('tenantReceiptNumber', formatSequence(paymentList[0]?.receiptSequence || ((tenant?.lastReceiptSequence || 0) + 1)))}
          </div>
        </div>
        
        {/* Swipe Hint for Mobile */}
        {isZoomed && (
          <div className="sm:hidden flex flex-col items-center gap-2 opacity-30 mb-8">
             <div className="w-16 h-1 bg-neutral-300 rounded-full" />
             <p className="text-[8px] font-black uppercase tracking-[0.4em]">Swipe to View Details</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingField && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/20">
            <div className="bg-neutral-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-black uppercase tracking-widest text-xs">Manual Override</h3>
              <button onClick={() => setEditingField(null)} className="opacity-50 hover:opacity-100 transition-opacity">
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 pb-10 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                  {t.receipt[editingField as keyof typeof t.receipt] || editingField}
                </label>
                <textarea 
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-2xl px-5 py-4 font-bold text-neutral-900 focus:border-primary-500 focus:bg-white outline-none transition-all transition-duration-300 min-h-[120px] resize-none"
                  placeholder="Enter custom text..."
                  autoFocus
                />
              </div>

              <div className="flex gap-3 mt-2">
                <Button onClick={() => setEditingField(null)} variant="secondary" className="flex-1 h-12 uppercase tracking-widest font-black text-[10px] rounded-2xl">
                  {t.common.cancel}
                </Button>
                <Button onClick={saveCustomField} className="flex-2 h-12 bg-primary-600 hover:bg-primary-700 text-white uppercase tracking-widest font-black text-[10px] rounded-2xl shadow-lg shadow-primary-500/20 active:translate-y-0.5 transition-all">
                  Save Changes
                </Button>
              </div>
              
              <div className="flex items-center gap-2 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <AlertCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                <p className="text-[9px] text-neutral-500 font-bold leading-tight">
                  This edit only applies to this specific receipt. Global data remains unchanged.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Status Indicator - Bottom Left */}
      {isPaid && (
        <div className="fixed bottom-8 left-8 z-50 print:hidden pointer-events-none sm:pointer-events-auto">
          <div className="bg-white border-2 border-success-600 shadow-xl rounded-xl px-5 py-3 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-success-50 p-2 rounded-lg">
                <CheckCircle className="w-5 h-5 text-success-600" strokeWidth={3} />
             </div>
             <div className="flex flex-col border-l border-neutral-100 pl-4">
               <span className="text-success-900 font-black text-xs uppercase tracking-tight">
                 {t.receipt.paidStatus}
               </span>
               <span className="text-neutral-400 text-[9px] font-bold uppercase tracking-widest leading-none mt-1">
                 Official Audit Record
               </span>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
