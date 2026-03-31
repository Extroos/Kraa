import React, { useState, useEffect } from 'react';
import { Modal, Button } from './ui';
import { useTranslation } from '../i18n';
import { Folder, CheckCircle2, Circle, Home } from 'lucide-react';
import { Property, PropertyFolder } from '../types';

interface FolderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, propertyIds: string[]) => Promise<void>;
  editingFolder?: PropertyFolder;
  allProperties: Property[];
}

export const FolderFormModal: React.FC<FolderFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  editingFolder,
  allProperties
}) => {
  const { t, isRTL } = useTranslation();
  const [name, setName] = useState('');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingFolder) {
      setName(editingFolder.name);
      const folderProps = allProperties
        .filter(p => p.folderId === editingFolder.id)
        .map(p => p.id);
      setSelectedPropertyIds(folderProps);
    } else {
      setName('');
      setSelectedPropertyIds([]);
    }
  }, [editingFolder, isOpen, allProperties]);

  const toggleProperty = (id: string) => {
    setSelectedPropertyIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave(name, selectedPropertyIds);
      onClose();
    } catch (error) {
      console.error("Failed to save folder:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingFolder ? t.properties.editFolder : t.properties.newFolder}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className={`block text-[10px] font-black uppercase tracking-widest text-neutral-400 ${isRTL ? 'text-right' : ''}`}>
             {t.properties.folderName}
          </label>
          <div className="relative group">
            <div className={`absolute inset-y-0 ${isRTL ? 'right-4' : 'left-4'} flex items-center pointer-events-none text-neutral-400 group-focus-within:text-neutral-900 transition-colors`}>
              <Folder size={18} strokeWidth={2.5} />
            </div>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.properties.folderName}
              className={`w-full h-12 ${isRTL ? 'pr-12' : 'pl-12'} bg-neutral-50 border border-neutral-100 rounded-xl focus:bg-white focus:border-neutral-900 focus:outline-none font-bold text-neutral-900 transition-all shadow-sm`}
              required
            />
          </div>
        </div>

        {/* Property Selector */}
        <div className="space-y-3">
          <label className={`block text-[10px] font-black uppercase tracking-widest text-neutral-400 ${isRTL ? 'text-right' : ''}`}>
             {t.properties.addAssets}
          </label>
          <div className="bg-neutral-50 rounded-2xl border border-neutral-100 overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 space-y-1">
              {allProperties.map(property => {
                const isSelected = selectedPropertyIds.includes(property.id);
                const isInOtherFolder = property.folderId && (!editingFolder || property.folderId !== editingFolder.id);

                return (
                  <button
                    key={property.id}
                    type="button"
                    onClick={() => toggleProperty(property.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                      isSelected ? 'bg-white shadow-sm border border-neutral-100' : 'hover:bg-white/50 text-neutral-500'
                    }`}
                  >
                    <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''} overflow-hidden`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                         isSelected ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-400'
                      }`}>
                        <Home size={14} />
                      </div>
                      <div className={`text-left overflow-hidden ${isRTL ? 'text-right' : ''}`}>
                        <span className={`block text-[11px] font-black uppercase tracking-tight truncate ${isSelected ? 'text-neutral-900' : ''}`}>
                          {property.name}
                        </span>
                        {isInOtherFolder && (
                          <span className="block text-[8px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">
                            {t.properties.inOtherFolder}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 size={18} className="text-neutral-900 shrink-0" />
                    ) : (
                      <Circle size={18} className="text-neutral-200 shrink-0" />
                    )}
                  </button>
                );
              })}
              
              {allProperties.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t.properties.noProperties}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1 h-11 uppercase font-black tracking-widest text-[10px] rounded-xl"
          >
            {t.common.cancel}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="flex-1 h-11 bg-neutral-900 text-white hover:bg-black uppercase font-black tracking-widest text-[10px] rounded-xl shadow-lg active:scale-95 transition-all"
          >
            {isSubmitting ? t.common.loading : t.common.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
