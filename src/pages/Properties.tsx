import React, { useState } from 'react';
import { Card, Button } from '../components/ui';
import { 
  Home, 
  MapPin, 
  Users, 
  UserPlus, 
  Receipt, 
  History as HistoryIcon, 
  Plus, 
  Edit2, 
  Trash2,
  ChevronRight,
  Building2,
  Warehouse,
  HomeIcon,
  Tent
} from 'lucide-react';
import { Property } from '../types';
import { PropertyFormModal } from '../components/PropertyFormModal';
import { useAuth } from '../store/AuthContext';
import { useAppContext } from '../hooks/useAppContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { Link, useNavigate } from 'react-router-dom';
import { APP_CONFIG } from '../config/constants';
import { useTranslation } from '../i18n';

// Helper to get the correct professional image based on property type
const getPropertyImage = (type?: string, customImage?: string) => {
  if (customImage) return customImage;
  
  // Note: These keys might be in Arabic (historical) or English (new)
  switch (type) {
    case 'شقة':
    case 'Apartment':
    case 'Appartement': 
      return '/properties/apartment.png';
    case 'فيلا':
    case 'Villa': 
      return '/properties/villa.png';
    case 'مرآب':
    case 'Garage': 
      return '/properties/garage.png';
    case 'دار':
    case 'House':
    case 'Maison': 
      return '/properties/house.png';
    default: return '/kra.jpg';
  }
};

export const Properties: React.FC = () => {
  const { t } = useTranslation();
  const { isReadOnly } = useAuth();
  const { properties, tenants, addProperty, updateProperty, deleteProperty, privacyMode, getTenantsWithStatus } = useAppContext();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | undefined>(undefined);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<{ id: string; name: string } | null>(null);

  const tenantsWithStatus = getTenantsWithStatus();

  const handleOpenModal = (property?: Property) => {
    setEditingProperty(property);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingProperty(undefined);
    setIsModalOpen(false);
  };

  const handleSaveProperty = async (data: any, imageFile?: File) => {
    try {
      if (editingProperty) {
        await updateProperty(editingProperty.id, data, imageFile);
      } else {
        await addProperty(data, imageFile);
      }
      handleCloseModal();
    } catch (err) {
      console.error("Failed to save property:", err);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setPropertyToDelete({ id, name });
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (propertyToDelete) {
      await deleteProperty(propertyToDelete.id);
      setDeleteModalOpen(false);
      setPropertyToDelete(null);
    }
  };

  const getActiveTenantForProperty = (propertyId: string) => {
    return tenantsWithStatus.find(t => t.propertyId === propertyId && t.tenantStatus !== 'archived');
  };

  const getArchivedTenantsForProperty = (propertyId: string) => {
    return tenants.filter(t => t.propertyId === propertyId && t.tenantStatus === 'archived').length;
  };

  const calculateTotalPropertyRent = (propertyId: string) => {
    return tenants
      .filter(t => t.propertyId === propertyId && t.tenantStatus !== 'archived')
      .reduce((sum, t) => sum + (t.rentAmount || 0), 0);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-neutral-200 pb-8 rtl:flex-row-reverse">
        <div className="rtl:text-right">
          <h1 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight leading-none mb-2">{t.properties.title}</h1>
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-[0.25em]">{t.properties.subtitle}</p>
        </div>
        {!isReadOnly && (
          <Button 
            onClick={() => handleOpenModal()} 
            className="bg-neutral-900 text-white hover:bg-black px-6 h-11 rounded-lg shadow-sm flex items-center gap-2 transition-transform active:scale-95"
          >
            <Plus size={20} /> 
            <span className="font-bold uppercase tracking-widest text-[11px]">{t.properties.addAsset}</span>
          </Button>
        )}
      </div>

      {properties.length === 0 ? (
        <Card className="text-center py-16 bg-white border-2 border-dashed border-neutral-100 rounded-xl">
          <h2 className="text-xl font-black text-neutral-900 uppercase tracking-widest mb-3">{t.properties.noProperties}</h2>
          <p className="text-sm font-medium text-neutral-400 mb-8 max-w-sm mx-auto">{t.properties.noPropertiesDesc}</p>
          {!isReadOnly && (
            <Button onClick={() => handleOpenModal()} className="px-8 h-11 rounded-lg">
              <Plus className="w-5 h-5 rtl:ml-3 ltr:mr-3" /> {t.properties.addProperty}
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {properties.map((property) => {
            const activeTenant = getActiveTenantForProperty(property.id);
            const archivedCount = getArchivedTenantsForProperty(property.id);
            const totalRent = calculateTotalPropertyRent(property.id);

            return (
              <Card 
                key={property.id} 
                className="group border border-neutral-100 shadow-sm bg-white rounded-lg overflow-hidden flex flex-col h-full"
                padding={false}
              >
                {/* Visual Header - Hidden on Mobile */}
                <div className="relative h-32 lg:h-44 overflow-hidden bg-neutral-100 hidden sm:block">
                  <img 
                    src={getPropertyImage(property.type, property.imageUrl)} 
                    alt={property.name}
                    className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
                  />
                  
                  {/* Property Type Badge - Mature White/Black Design */}
                  <div className="absolute top-4 right-4 z-10 rtl:right-auto rtl:left-4">
                    <span className="bg-white/90 backdrop-blur-sm border border-neutral-200 text-neutral-900 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">
                      {t.expenses[property.type as keyof typeof t.expenses] || property.type || t.nav.asset}
                    </span>
                  </div>

                   {/* Quick Actions overlay - Classic Buttons */}
                    <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 rtl:left-auto rtl:right-4">
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(property); }}
                        className="w-10 h-10 p-0 rounded-lg bg-neutral-900 text-white shadow-sm hover:bg-black transition-colors"
                        title={t.common.edit}
                      >
                        <Edit2 size={24} className="text-white" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(property.id, property.name); }}
                        className="w-10 h-10 p-0 rounded-lg bg-danger-50 border border-danger-100 text-danger-400 hover:bg-danger-600 hover:text-white transition-all shadow-sm"
                        title={t.common.delete}
                      >
                        <Trash2 size={24} />
                      </Button>
                    </div>

                  <div className="absolute bottom-0 inset-x-0 h-1/2 bg-linear-to-t from-black/60 to-transparent pointer-events-none" />
                  
                  <div className="absolute bottom-3 left-3 text-white rtl:left-auto rtl:right-3 rtl:text-right">
                    <h2 className="text-sm font-bold leading-tight drop-shadow-md tracking-tight uppercase line-clamp-1">{property.name}</h2>
                    <div className="flex items-center gap-1 opacity-80 rtl:flex-row-reverse">
                      <MapPin size={10} className="shrink-0" />
                      <span className="text-[9px] font-bold uppercase tracking-wider truncate max-w-[150px] drop-shadow-sm">{property.address}</span>
                    </div>
                  </div>
                </div>

                {/* Information Body */}
                <div className="p-3 sm:p-5 flex-1 flex flex-col">
                  <div className="flex-1">
                    {/* Mobile Title Section */}
                    <div className="sm:hidden mb-2 flex items-start justify-between gap-1 rtl:flex-row-reverse">
                      <div className="min-w-0 rtl:text-right">
                        <h2 className="text-xs font-bold text-neutral-900 tracking-tight uppercase leading-tight truncate">{property.name}</h2>
                        <p className="text-[8px] text-neutral-400 font-bold uppercase tracking-wider truncate opacity-70">{property.address}</p>
                      </div>
                      {!isReadOnly && (
                        <div className="flex gap-1 shrink-0 px-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenModal(property); }}
                            className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(property.id, property.name); }}
                            className="w-7 h-7 flex items-center justify-center text-neutral-300 hover:text-danger-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-6 mb-3 sm:mb-6 items-baseline">
                      <div className="space-y-0.5 rtl:text-right text-left">
                        <span className="text-[8px] sm:text-[11px] font-bold text-neutral-400 uppercase tracking-widest block opacity-60 leading-none">{t.properties.monthlyYield}</span>
                        <div className="flex items-baseline gap-0.5 rtl:flex-row-reverse">
                          <span className="text-sm sm:text-2xl font-bold text-neutral-900 tabular-nums tracking-tighter">
                            {privacyMode ? '*****' : `${totalRent.toLocaleString()}`}
                          </span>
                          <span className="text-[8px] sm:text-xs font-bold text-neutral-400 uppercase opacity-60">{APP_CONFIG.CURRENCY}</span>
                        </div>
                      </div>
                      <div className="space-y-0.5 text-right rtl:text-left">
                        <span className="text-[8px] sm:text-[11px] font-bold text-neutral-400 uppercase tracking-widest block opacity-60 leading-none">{t.properties.locality}</span>
                        <span className="text-[11px] sm:text-xl font-bold text-neutral-800 tabular-nums uppercase truncate block leading-tight">{property.city || '---'}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-neutral-50 mt-2">
                      <span className="text-[8px] sm:text-[11px] font-bold text-neutral-400 uppercase tracking-widest block rtl:text-right opacity-50">{t.properties.currentResident}</span>
                      {activeTenant ? (
                        <div 
                          onClick={() => navigate(`/tenants/${activeTenant.id}`)}
                          className="flex items-center justify-between bg-neutral-50/50 rounded border border-neutral-100 p-1.5 sm:p-4 hover:border-neutral-900 transition-colors cursor-pointer group/resident rtl:flex-row-reverse"
                        >
                          <div className="flex items-center gap-2 sm:gap-4 rtl:flex-row-reverse">
                            <div className="w-7 h-7 sm:w-10 sm:h-10 bg-white rounded border border-neutral-100 flex items-center justify-center text-neutral-400 shrink-0">
                              <Users size={12} className="sm:w-4 sm:h-4" />
                            </div>
                            <div className="rtl:text-right overflow-hidden">
                               <span className="block font-bold text-[10px] sm:text-base tracking-tight uppercase truncate max-w-[60px] sm:max-w-full">{activeTenant.name}</span>
                               <span className="block text-[7px] sm:text-[11px] font-medium uppercase tracking-widest text-neutral-400 opacity-60 leading-none">{t.properties.tenantActive}</span>
                            </div>
                          </div>
                          <ChevronRight size={12} className="text-neutral-300 rtl:rotate-180 shrink-0" />
                        </div>
                      ) : (
                        <div className="text-[9px] sm:text-[12px] font-bold text-neutral-400 bg-neutral-50/20 rounded py-2 sm:py-4 border border-neutral-100 border-dashed text-center uppercase tracking-widest">
                          {t.properties.noOccupancy}
                        </div>
                      )}
                    </div>
                  </div>

                  {property.notes && (
                    <div className="mt-3 pt-3 border-t border-neutral-50">
                       <p className="text-neutral-400 font-bold text-[8px] sm:text-xs leading-tight italic bg-neutral-50/50 p-2 rounded border border-neutral-100 rtl:text-right line-clamp-2">
                        "{property.notes}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Professional Action Bar - Strictly Row-Based for 2-column view */}
                <div className="p-2 sm:p-4 bg-white border-t border-neutral-100 flex items-center gap-1 sm:gap-2 rtl:flex-row-reverse">
                  {!isReadOnly && (
                    <>
                      <Button 
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate('/tenants', { state: { prefillPropertyId: property.id, openAddModal: true } })}
                        className="flex-1 bg-white border border-neutral-100 h-8 sm:h-10 rounded hover:border-neutral-900 transition-colors px-0 sm:px-3"
                      >
                        <UserPlus size={14} className="sm:mr-1.5 rtl:sm:ml-1.5 text-neutral-400" />
                        <span className="hidden sm:inline uppercase text-[10px] font-bold tracking-widest">{t.nav.tenants}</span>
                      </Button>
                      <Button 
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate('/expenses', { state: { prefillPropertyId: property.id, openAddModal: true } })}
                        className="flex-1 bg-white border border-neutral-100 h-8 sm:h-10 rounded hover:border-neutral-900 transition-colors px-0 sm:px-3"
                      >
                        <Receipt size={14} className="sm:mr-1.5 rtl:sm:ml-1.5 text-neutral-400" />
                        <span className="hidden sm:inline uppercase text-[10px] font-bold tracking-widest">{t.nav.expenses}</span>
                      </Button>
                    </>
                  )}
                  {archivedCount > 0 && (
                    <Link 
                      to={`/archived-tenants?propertyId=${property.id}`}
                      className="w-8 h-8 sm:w-10 sm:h-10 bg-neutral-50 border border-neutral-100 rounded flex items-center justify-center text-neutral-300 hover:text-neutral-900 hover:bg-white transition-all shrink-0"
                      title={`${t.nav.archive} (${archivedCount} ${t.nav.historyRecords})`}
                    >
                      <HistoryIcon size={14} className="sm:w-5 sm:h-5" />
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <PropertyFormModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveProperty}
          editingProperty={editingProperty}
        />
      )}

      {deleteModalOpen && (
        <ConfirmModal
          isOpen={deleteModalOpen}
          onCancel={() => {
            setDeleteModalOpen(false);
            setPropertyToDelete(null);
          }}
          onConfirm={confirmDelete}
          title={t.properties.archiveAsset}
          message={t.properties.archiveAssetConfirm.replace('{name}', propertyToDelete?.name || '')}
          confirmText={t.common.confirmDelete}
          isDestructive={true}
        />
      )}
    </div>
  );
};

