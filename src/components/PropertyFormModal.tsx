import React, { useState, useEffect } from 'react';
import { Property } from '../types';
import { Modal, Button, Input, TextArea } from './ui';
import { useTranslation } from '../i18n';

interface PropertyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any, imageFile?: File | null) => void;
  editingProperty: Property | null;
}

export const PropertyFormModal: React.FC<PropertyFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingProperty,
}) => {
  const { t, isRTL } = useTranslation();
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'Apartment' as any,
    address: '',
    addressAr: '',
    city: '',
    notes: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (editingProperty) {
      setFormData({
        name: editingProperty.name,
        type: editingProperty.type || 'Apartment',
        address: editingProperty.address,
        addressAr: editingProperty.addressAr || '',
        city: editingProperty.city,
        notes: editingProperty.notes || '',
      });
      setImagePreview(editingProperty.imageUrl || null);
    } else {
      setFormData({ name: '', type: 'Apartment', address: '', addressAr: '', city: '', notes: '' });
      setImagePreview(null);
    }
  }, [editingProperty, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData, imageFile);
  };

  const footer = (
    <div className="flex gap-3 w-full rtl:flex-row-reverse">
      <Button variant="secondary" className="flex-1 h-11 uppercase tracking-widest text-[10px] font-bold" onClick={onClose}>
        {t.common.cancel}
      </Button>
      <Button type="submit" form="property-form" className="flex-1 h-11 uppercase tracking-widest text-[10px] font-bold">
        {t.properties.registerUnit}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingProperty ? t.properties.modifyAsset : t.properties.registerAsset}
      footer={footer}
      maxWidth="max-w-xl"
    >
      <form id="property-form" onSubmit={handleSubmit} className={`space-y-5 ${isRTL ? 'text-right' : 'text-left'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t.properties.internalName}
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={t.properties.namePlaceholder}
          />
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
              {t.properties.assetType}
            </label>
            <select
              required
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full h-10 px-3 bg-neutral-50 border border-neutral-200 rounded text-sm font-medium focus:border-primary-500 outline-none transition-colors cursor-pointer appearance-none"
            >
              <option value="Apartment">{t.properties.apartment}</option>
              <option value="Villa">{t.properties.villa}</option>
              <option value="Garage">{t.properties.garage}</option>
              <option value="House">{t.properties.house}</option>
            </select>
          </div>
        </div>

        <div className="space-y-4 pt-2 border-t border-neutral-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t.properties.address}
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder={t.properties.addressPlaceholder}
            />
            <Input
              label={t.properties.city}
              required
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder={t.properties.cityPlaceholder}
            />
          </div>
          <Input
            label={t.properties.addressAr}
            placeholder={t.properties.addressArPlaceholder}
            value={formData.addressAr}
            onChange={(e) => setFormData({ ...formData, addressAr: e.target.value })}
            dir="rtl"
          />
        </div>

        <TextArea
          label={t.properties.notes}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          placeholder={t.properties.notesPlaceholder}
        />
      </form>
    </Modal>
  );
};

