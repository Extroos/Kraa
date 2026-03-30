import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal, Button } from './ui';
import { useTranslation } from '../i18n';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  isDestructive = true,
}) => {
  const { t, isRTL } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await onConfirm();
    } catch (err) {
      let errorMessage = 'Security exception or data integrity error';
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          errorMessage = parsed.error || err.message;
        } catch {
          errorMessage = err.message;
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const footer = (
    <div className={`flex gap-3 w-full ${isRTL ? 'flex-row-reverse' : ''}`}>
      <Button
        variant="secondary"
        onClick={onCancel}
        disabled={isLoading}
        className="flex-1 h-10 uppercase tracking-widest text-[10px] font-bold bg-white border-neutral-200"
      >
        {cancelText || t.common.cancel}
      </Button>
      <Button
        onClick={handleConfirm}
        disabled={isLoading}
        variant={isDestructive ? 'danger' : 'primary'}
        className="flex-1 h-10 uppercase tracking-widest text-[10px] font-bold shadow-sm"
      >
        {isLoading && <Loader2 className={`w-5 h-5 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}
        {confirmText || (isDestructive ? t.common.delete : t.common.confirm)}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={t.common.systemConfirmation}
      footer={footer}
      maxWidth="max-w-md"
    >
      <div className={`flex flex-col items-center text-center py-2 ${isRTL ? 'rtl' : ''}`}>
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-6 border ${
          isDestructive ? 'bg-danger-50 text-danger-600 border-danger-100' : 'bg-primary-50 text-primary-600 border-primary-100'
        }`}>
          <AlertTriangle className="w-10 h-10" />
        </div>
        
        <h3 className="text-base font-bold text-neutral-900 uppercase tracking-tight mb-2">
          {title}
        </h3>
        
        <p className="text-sm text-neutral-500 font-medium leading-relaxed max-w-[280px]">
          {message}
        </p>
        
        {error && (
          <div className="mt-6 w-full p-4 bg-danger-50 border border-danger-100 text-danger-700 rounded text-[10px] font-bold uppercase tracking-wider leading-relaxed">
             Error: {error}
          </div>
        )}
      </div>
    </Modal>
  );
};
