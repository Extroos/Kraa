import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-md',
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-1000 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-neutral-900/60 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`relative bg-white rounded-xl border border-neutral-200 shadow-xl w-full ${maxWidth} overflow-hidden flex flex-col max-h-[90vh]`}
          >
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center shrink-0 bg-white">
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-widest">{title}</h2>
              <button
                onClick={onClose}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 rounded transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto min-h-0 flex-1 custom-scrollbar">
              {children}
            </div>

            {footer && (
              <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/50 flex gap-3 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
