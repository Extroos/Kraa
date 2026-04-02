import React, { useState } from 'react';
import { PaymentMethod } from '../types';
import { Modal, Button, Input, TextArea } from './ui';
import { APP_CONFIG } from '../config/constants';
import { useTranslation } from '../i18n';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (datePaid: string, method: PaymentMethod, paidAmount: number, notes: string, photo?: string) => void;
  tenantName: string;
  totalAmount?: number;
  monthCount?: number;
  privacyMode?: boolean;
}

import { startOfDay, parseISO } from 'date-fns';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNativeMobile } from '../utils/localImage';
import { Camera as CameraIcon, X as CloseIcon, Image as ImageIcon } from 'lucide-react';

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  tenantName,
  totalAmount,
  monthCount,
  privacyMode
}) => {
  const { t, isRTL } = useTranslation();
  const [datePaid, setDatePaid] = useState(new Date().toISOString().split('T')[0]);
  const [paidAmount, setPaidAmount] = useState<string>(totalAmount?.toString() || '');
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [notes, setNotes] = useState('');
  const [tempPhoto, setTempPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Update paidAmount if totalAmount changes (e.g. when opening for a new payment)
  React.useEffect(() => {
    if (totalAmount !== undefined) {
      setPaidAmount(totalAmount.toString());
    }
  }, [totalAmount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!method) return;
    
    // Normalize date to start of day for database consistency
    const normalizedDate = startOfDay(parseISO(datePaid)).toISOString();
    const finalPaidAmount = parseFloat(paidAmount) || 0;
    onConfirm(normalizedDate, method as PaymentMethod, finalPaidAmount, notes, tempPhoto || undefined);
    
    // Reset form
    setMethod('');
    setNotes('');
    setTempPhoto(null);
  };

  const handleCapturePhoto = async () => {
    if (!isNativeMobile()) return;
    
    setIsCapturing(true);
    try {
      const image = await Camera.getPhoto({
        quality: 70,
        width: 1200, // Medium resolution for local storage
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera, // Force camera
        saveToGallery: true // Save to phone gallery for the landlord
      });
      
      if (image.base64String) {
        setTempPhoto(`data:image/jpeg;base64,${image.base64String}`);
      }
    } catch (error) {
      console.error('Camera error:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  const footer = (
    <div className={`flex gap-3 w-full ${isRTL ? 'flex-row-reverse' : ''}`}>
      <Button variant="secondary" className="flex-1 h-11 uppercase tracking-widest text-[10px] font-bold" onClick={onClose}>
        {t.common.cancel}
      </Button>
      <Button type="submit" form="record-payment-form" className="flex-1 h-11 uppercase tracking-widest text-[10px] font-bold" disabled={!method}>
        {t.payments.confirmDeposit}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.payments.transactionEntry}
      footer={footer}
      maxWidth="max-w-md"
    >
      <form id="record-payment-form" onSubmit={handleSubmit} className={`space-y-5 ${isRTL ? 'text-right' : 'text-left'}`}>
        <div>
          <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
            {t.payments.selectedOccupant}
          </label>
          <div className="p-3.5 bg-neutral-50 rounded border border-neutral-200 text-neutral-900 font-bold uppercase tracking-tight text-sm">
            {tenantName}
          </div>
        </div>

        {totalAmount && monthCount && monthCount > 1 && (
          <div className="p-4 bg-primary-50 rounded border border-primary-100 flex flex-col gap-2">
            <div className={`flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="text-[10px] font-bold text-primary-900 uppercase tracking-widest">{t.payments.consolidatedSummary}</span>
              <span className="px-2 py-0.5 bg-primary-600 text-white rounded-sm text-[9px] font-bold uppercase tracking-wider">{monthCount} {t.payments.cycles}</span>
            </div>
            <div className={`flex justify-between items-baseline mt-1 pt-2 border-t border-primary-100/50 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="text-[10px] text-primary-700 font-bold uppercase tracking-tight">{t.payments.totalReceivable}</span>
              <span className="text-xl font-black text-primary-900 tabular-nums">
                {privacyMode ? '*****' : totalAmount.toLocaleString()} 
                {!privacyMode && <span className={`text-xs font-bold text-primary-600 uppercase ${isRTL ? 'mr-1' : 'ml-1'}`}>{APP_CONFIG.CURRENCY}</span>}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
              {t.payments.settlementMethod}
            </label>
            <select
              required
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className={`w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded text-xs font-bold uppercase tracking-wider focus:border-primary-500 outline-none transition-colors cursor-pointer ${isRTL ? 'text-right' : 'text-left'}`}
            >
              <option value="" disabled>{t.payments.selectMethod}</option>
              <option value="cash">{t.payments.cash}</option>
              <option value="bank_transfer">{t.payments.bank}</option>
              <option value="cheque">{t.payments.cheque}</option>
            </select>
          </div>

          <Input
            label={t.payments.effectiveDate}
            type="date"
            required
            value={datePaid}
            onChange={(e) => setDatePaid(e.target.value)}
          />

          <Input
            label={t.tenantProfile.paymentAmount}
            type="number"
            required
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            placeholder="0.00"
          />

          {method === 'cheque' && (
            <div className="p-3 bg-neutral-50 rounded border border-neutral-200 border-dashed space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-none">
                  {t.payments.chequePhoto || 'Cheque Evidence'} (Local Only)
                </span>
                {tempPhoto && (
                  <button 
                    type="button"
                    onClick={() => setTempPhoto(null)}
                    className="text-danger-500 hover:text-danger-700 transition-colors"
                  >
                    <CloseIcon size={14} />
                  </button>
                )}
              </div>
              
              {!tempPhoto ? (
                <Button 
                  type="button"
                  variant="secondary" 
                  className="w-full h-10 gap-2 text-[10px] font-bold uppercase tracking-widest border-neutral-300"
                  onClick={handleCapturePhoto}
                  disabled={isCapturing}
                >
                  <CameraIcon size={16} />
                  {isCapturing ? t.common.loading : t.payments.captureCheque || 'Capture Cheque'}
                </Button>
              ) : (
                <div className="relative group">
                  <img 
                    src={tempPhoto} 
                    alt="Cheque" 
                    className="w-full h-32 object-cover rounded border border-neutral-200"
                  />
                  <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                    <ImageIcon size={24} className="text-white drop-shadow-md" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <TextArea
          label={t.payments.transactionNotes}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t.payments.notesPlaceholder}
          rows={3}
        />
      </form>
    </Modal>
  );
};

