import React from 'react';
import { Modal, Button } from './ui';
import { useTranslation } from '../i18n';
import { Folder, Inbox, Check } from 'lucide-react';
import { Property, PropertyFolder } from '../types';

interface MoveToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (propertyId: string, folderId: string | null) => Promise<void>;
  property: Property;
  folders: PropertyFolder[];
}

export const MoveToFolderModal: React.FC<MoveToFolderModalProps> = ({ 
  isOpen, 
  onClose, 
  onAssign, 
  property,
  folders
}) => {
  const { t, isRTL } = useTranslation();

  const handleAssign = async (folderId: string | null) => {
    try {
      await onAssign(property.id, folderId);
      onClose();
    } catch (error) {
      console.error("Failed to move property:", error);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.properties.moveToFolder}
      maxWidth="max-w-sm"
    >
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
        {/* All Assets / Unassigned Option */}
        <button
          onClick={() => handleAssign(null)}
          className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${
            !property.folderId ? 'bg-neutral-900 text-white shadow-lg' : 'hover:bg-neutral-50 text-neutral-600'
          }`}
        >
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Inbox size={20} className={!property.folderId ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-900'} />
            <span className="font-bold uppercase tracking-widest text-[11px]">{t.properties.allAssets}</span>
          </div>
          {!property.folderId && <Check size={18} className="text-white" />}
        </button>

        {/* Existing Folders */}
        {folders.map(folder => (
          <button
            key={folder.id}
            onClick={() => handleAssign(folder.id)}
            className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${
              property.folderId === folder.id ? 'bg-neutral-900 text-white shadow-lg' : 'hover:bg-neutral-50 text-neutral-600'
            }`}
          >
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Folder size={20} className={property.folderId === folder.id ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-900'} />
              <span className="font-bold uppercase tracking-widest text-[11px] truncate max-w-[200px]">{folder.name}</span>
            </div>
            {property.folderId === folder.id && <Check size={18} className="text-white" />}
          </button>
        ))}

        {folders.length === 0 && (
          <div className="py-8 text-center bg-neutral-50/50 rounded-2xl border border-dashed border-neutral-100">
             <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t.properties.noFolders}</p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <Button
          variant="secondary"
          onClick={onClose}
          className="w-full h-11 uppercase font-black tracking-widest text-[10px] rounded-xl"
        >
          {t.common.cancel}
        </Button>
      </div>
    </Modal>
  );
};
