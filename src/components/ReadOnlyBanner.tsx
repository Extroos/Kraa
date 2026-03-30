import React from 'react';
import { useAuth } from '../store/AuthContext';
import { ShieldAlert } from 'lucide-react';

const ReadOnlyBanner: React.FC = () => {
  const { isReadOnly, ownerEmail } = useAuth();

  if (!isReadOnly) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 sticky top-0 z-60 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-x-3 gap-y-1 text-amber-600 text-[11px] font-bold uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <ShieldAlert size={20} className="text-amber-500" />
          <span>وضع العرض فقط</span>
        </div>
        {ownerEmail && (
          <span className="opacity-60 hidden sm:inline">•</span>
        )}
        {ownerEmail && (
          <span className="text-amber-600/80">
            الحساب مملوك لـ: {ownerEmail}
          </span>
        )}
      </div>
    </div>
  );
};

export default ReadOnlyBanner;
