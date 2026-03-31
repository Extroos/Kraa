import React, { useState, useMemo } from 'react';
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
  FolderPlus,
  Folder,
  Filter,
  Inbox,
  MoreVertical,
  LayoutGrid
} from 'lucide-react';
import { Property, PropertyFolder } from '../types';
import { PropertyFormModal } from '../components/PropertyFormModal';
import { FolderFormModal } from '../components/FolderFormModal';
import { MoveToFolderModal } from '../components/MoveToFolderModal';
import { useAuth } from '../store/AuthContext';
import { useAppContext } from '../hooks/useAppContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { Link, useNavigate } from 'react-router-dom';
import { APP_CONFIG } from '../config/constants';
import { useTranslation } from '../i18n';

// Helper to get the correct professional image based on property type
const getPropertyImage = (type?: string, customImage?: string) => {
  if (customImage) return customImage;
  
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
  const { t, isRTL } = useTranslation();
  const { isReadOnly } = useAuth();
  const { 
    properties, 
    tenants, 
    folders,
    addProperty, 
    updateProperty, 
    deleteProperty, 
    addFolder,
    updateFolder,
    deleteFolder,
    assignPropertyToFolder,
    updateFolderWithProperties,
    privacyMode, 
    getTenantsWithStatus 
  } = useAppContext();
  const navigate = useNavigate();

  // Modals state
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | undefined>(undefined);
  
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<PropertyFolder | undefined>(undefined);
  
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [propertyToMove, setPropertyToMove] = useState<Property | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<{ id: string; name: string } | null>(null);

  const [folderDeleteModalOpen, setFolderDeleteModalOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<PropertyFolder | null>(null);

  // Filter state
  const [selectedFolderId, setSelectedFolderId] = useState<string | 'all'>('all');

  const tenantsWithStatus = getTenantsWithStatus();

  const filteredProperties = useMemo(() => {
    if (selectedFolderId === 'all') return properties;
    return properties.filter(p => p.folderId === selectedFolderId);
  }, [properties, selectedFolderId]);

  const handleOpenPropertyModal = (property?: Property) => {
    setEditingProperty(property);
    setIsPropertyModalOpen(true);
  };

  const handleOpenFolderModal = (folder?: PropertyFolder) => {
    setEditingFolder(folder);
    setIsFolderModalOpen(true);
  };

  const handleOpenMoveModal = (property: Property) => {
    setPropertyToMove(property);
    setIsMoveModalOpen(true);
  };

  const handleSaveProperty = async (data: any, imageFile?: File) => {
    try {
      if (editingProperty) {
        await updateProperty(editingProperty.id, data, imageFile);
      } else {
        await addProperty(data, imageFile);
      }
      setIsPropertyModalOpen(false);
    } catch (err) {
      console.error("Failed to save property:", err);
    }
  };

  const handleSaveFolder = async (name: string, propertyIds: string[]) => {
    try {
      await updateFolderWithProperties(editingFolder?.id || null, name, propertyIds);
      setIsFolderModalOpen(false);
    } catch (err) {
      console.error("Failed to save folder:", err);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setPropertyToDelete({ id, name });
    setDeleteModalOpen(true);
  };

  const handleFolderDeleteClick = (folder: PropertyFolder) => {
    setFolderToDelete(folder);
    setFolderDeleteModalOpen(true);
  };

  const confirmDeleteProperty = async () => {
    if (propertyToDelete) {
      await deleteProperty(propertyToDelete.id);
      setDeleteModalOpen(false);
    }
  };

  const confirmDeleteFolder = async () => {
    if (folderToDelete) {
      await deleteFolder(folderToDelete.id);
      if (selectedFolderId === folderToDelete.id) setSelectedFolderId('all');
      setFolderDeleteModalOpen(false);
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
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500 pb-12">
      <div className={`flex flex-col lg:flex-row gap-8 ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
        
        {/* Sidebar - Collections */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="bg-white border border-neutral-100 rounded-3xl p-6 shadow-sm sticky top-24">
            <div className={`flex items-center justify-between mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Filter className="w-5 h-5 text-neutral-900" />
                <h2 className="text-sm font-black uppercase tracking-widest text-neutral-900">{t.properties.collections}</h2>
              </div>
              {!isReadOnly && (
                <button 
                  onClick={() => handleOpenFolderModal()}
                  className="p-1.5 hover:bg-neutral-50 rounded-lg text-neutral-400 hover:text-neutral-900 transition-all"
                  title={t.properties.newFolder}
                >
                  <FolderPlus size={18} />
                </button>
              )}
            </div>

            <nav className="space-y-1.5">
              <button
                onClick={() => setSelectedFolderId('all')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all group ${
                  selectedFolderId === 'all' 
                    ? 'bg-neutral-900 text-white shadow-xl shadow-neutral-900/10' 
                    : 'hover:bg-neutral-50 text-neutral-500'
                }`}
              >
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Inbox size={18} className={selectedFolderId === 'all' ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-900'} />
                  <span className="font-bold uppercase tracking-widest text-[10px]">{t.properties.allAssets}</span>
                </div>
                <span className={`text-[10px] font-black tabular-nums ${selectedFolderId === 'all' ? 'text-white/60' : 'text-neutral-300'}`}>
                  {properties.length}
                </span>
              </button>

              <div className="pt-4 pb-2">
                <div className={`h-px bg-neutral-50 w-full mb-4`} />
              </div>

              {folders.map(folder => {
                const count = properties.filter(p => p.folderId === folder.id).length;
                return (
                  <div key={folder.id} className="relative group">
                    <button
                      onClick={() => setSelectedFolderId(folder.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${
                        selectedFolderId === folder.id 
                          ? 'bg-neutral-900 text-white shadow-xl shadow-neutral-900/10' 
                          : 'hover:bg-neutral-50 text-neutral-500'
                      }`}
                    >
                      <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''} overflow-hidden`}>
                        <Folder size={18} className={selectedFolderId === folder.id ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-900'} />
                        <span className="font-bold uppercase tracking-widest text-[10px] truncate">{folder.name}</span>
                      </div>
                      <span className={`text-[10px] font-black tabular-nums ${selectedFolderId === folder.id ? 'text-white/60' : 'text-neutral-300'}`}>
                        {count}
                      </span>
                    </button>
                    {!isReadOnly && (
                      <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleOpenFolderModal(folder); }}
                          className={`p-1 rounded hover:bg-white/10 ${selectedFolderId === folder.id ? 'text-white/50' : 'text-neutral-300'}`}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleFolderDeleteClick(folder); }}
                          className={`p-1 rounded hover:bg-danger-500/10 ${selectedFolderId === folder.id ? 'text-danger-400' : 'text-neutral-300 hover:text-danger-500'}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {folders.length === 0 && (
                <div className="py-8 text-center bg-neutral-50/20 rounded-2xl border border-dashed border-neutral-100 p-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 leading-tight">
                    {t.properties.noFolders}
                  </p>
                </div>
              )}
            </nav>
          </div>
        </div>

        {/* Main Content - Grid */}
        <div className="flex-1 space-y-8">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-2 rtl:flex-row-reverse">
            <div className="rtl:text-right">
              <h1 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight leading-none mb-2">
                {selectedFolderId === 'all' 
                  ? t.properties.title 
                  : folders.find(f => f.id === selectedFolderId)?.name}
              </h1>
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-[0.25em]">
                {selectedFolderId === 'all' ? t.properties.subtitle : `${filteredProperties.length} ${t.nav.properties}`}
              </p>
            </div>
            {!isReadOnly && (
              <Button 
                onClick={() => handleOpenPropertyModal()} 
                className="bg-neutral-900 text-white hover:bg-black px-6 h-11 rounded-xl shadow-lg flex items-center gap-2 transition-transform active:scale-95"
              >
                <Plus size={20} /> 
                <span className="font-bold uppercase tracking-widest text-[11px]">{t.properties.addAsset}</span>
              </Button>
            )}
          </div>

          {filteredProperties.length === 0 ? (
            <Card className="text-center py-20 bg-white border border-neutral-100 rounded-3xl shadow-sm">
              <div className="w-16 h-16 bg-neutral-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-neutral-300">
                <LayoutGrid size={32} />
              </div>
              <h2 className="text-xl font-black text-neutral-900 uppercase tracking-widest mb-3">{t.properties.noProperties}</h2>
              <p className="text-sm font-medium text-neutral-400 mb-8 max-w-sm mx-auto">{t.properties.noPropertiesDesc}</p>
              {!isReadOnly && (
                <Button onClick={() => handleOpenPropertyModal()} className="px-8 h-11 rounded-xl shadow-lg">
                  <Plus className="w-5 h-5 rtl:ml-3 ltr:mr-3" /> {t.properties.addProperty}
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
              {filteredProperties.map((property) => {
                const activeTenant = getActiveTenantForProperty(property.id);
                const archivedCount = getArchivedTenantsForProperty(property.id);
                const totalRent = calculateTotalPropertyRent(property.id);

                return (
                  <Card 
                    key={property.id} 
                    className="group border border-neutral-100 shadow-sm bg-white rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col h-full hover:shadow-xl transition-all duration-300"
                    padding={false}
                  >
                    {/* Visual Header - Hidden on mobile for compact view */}
                    <div className="relative hidden sm:block sm:h-56 overflow-hidden bg-neutral-100">
                      <img 
                        src={getPropertyImage(property.type, property.imageUrl)} 
                        alt={property.name}
                        className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-105"
                      />
                      
                      {/* Property Type Badge */}
                      <div className="absolute top-4 right-4 z-10 rtl:right-auto rtl:left-4">
                        <span className="bg-white/80 backdrop-blur-md border border-white/20 text-neutral-900 px-3 py-1 rounded-full shadow-lg text-[9px] font-black uppercase tracking-widest">
                          {t.expenses[property.type as keyof typeof t.expenses] || property.type || t.nav.asset}
                        </span>
                      </div>

                      {/* Quick Actions overlay */}
                      <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 rtl:left-auto rtl:right-4 z-10">
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleOpenPropertyModal(property); }}
                          className="w-10 h-10 p-0 rounded-xl bg-black/60 backdrop-blur-md text-white border border-white/10 shadow-xl hover:bg-black transition-all transform hover:scale-110"
                        >
                          <Edit2 size={20} className="text-white" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleOpenMoveModal(property); }}
                          className="w-10 h-10 p-0 rounded-xl bg-black/60 backdrop-blur-md text-white border border-white/10 shadow-xl hover:bg-black transition-all transform hover:scale-110"
                          title={t.properties.moveToFolder}
                        >
                          <Folder size={20} className="text-white" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(property.id, property.name); }}
                          className="w-10 h-10 p-0 rounded-xl bg-danger-600/90 backdrop-blur-md text-white border border-danger-400/20 shadow-xl hover:bg-danger-700 transition-all transform hover:scale-110"
                        >
                          <Trash2 size={20} className="text-white" />
                        </Button>
                      </div>

                      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                      
                      <div className="absolute bottom-5 left-5 right-5 text-white rtl:text-right">
                        <h2 className="text-xl font-black leading-tight tracking-tight uppercase line-clamp-1 mb-1 shadow-sm">{property.name}</h2>
                        <div className="flex items-center gap-2 opacity-90 rtl:flex-row-reverse">
                          <MapPin size={14} className="shrink-0 text-white" />
                          <span className="text-[10px] font-bold uppercase tracking-widest truncate">{property.address}</span>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Title Bar (only visible on mobile) */}
                    <div className="block sm:hidden p-2.5 border-b border-neutral-50 bg-neutral-50/30">
                       <div className="flex items-center justify-between gap-2 rtl:flex-row-reverse">
                        <h2 className="text-[10px] font-black leading-tight tracking-tight uppercase truncate flex-1">{property.name}</h2>
                        <div className="flex gap-1 shrink-0">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenPropertyModal(property); }}
                            className="p-1.5 bg-white rounded-lg border border-neutral-100 text-neutral-400 shadow-sm active:bg-neutral-50 transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenMoveModal(property); }}
                            className="p-1.5 bg-white rounded-lg border border-neutral-100 text-neutral-400 shadow-sm active:bg-neutral-50 transition-colors"
                          >
                            <Folder size={12} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(property.id, property.name); }}
                            className="p-1.5 bg-white rounded-lg border border-neutral-100 text-danger-500 shadow-sm active:bg-danger-50 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                       </div>
                    </div>

                    {/* Information Body */}
                    <div className="p-2.5 sm:p-6 flex-1 flex flex-col">
                      <div className="flex-1">
                        {/* Yield/Locality Grid - Stacked on mobile for clarity */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-6 mb-3 sm:mb-6">
                          <div className="space-y-0.5 sm:space-y-1 rtl:text-right">
                            <span className="text-[7px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-widest block opacity-60 leading-none">{t.properties.monthlyYield}</span>
                            <div className="flex items-baseline gap-0.5 sm:gap-1 rtl:flex-row-reverse">
                              <span className="text-xs sm:text-xl font-black text-neutral-900 tabular-nums tracking-tighter">
                                {privacyMode ? '*****' : `${totalRent.toLocaleString()}`}
                              </span>
                              <span className="text-[6px] sm:text-[9px] font-black text-neutral-400 uppercase opacity-60 ml-0.5 sm:ml-0">{APP_CONFIG.CURRENCY}</span>
                            </div>
                          </div>
                          <div className="space-y-0.5 sm:space-y-1 text-left sm:text-right rtl:text-right sm:rtl:text-left">
                            <span className="text-[7px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-widest block opacity-60 leading-none">{t.properties.locality}</span>
                            <span className="text-[9px] sm:text-base font-black text-neutral-800 uppercase truncate block leading-tight">{property.city || '---'}</span>
                          </div>
                        </div>

                        <div className="space-y-1 sm:space-y-2 pt-2 sm:pt-4 border-t border-neutral-50 mt-1 sm:mt-2">
                          <span className="text-[7px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-widest block rtl:text-right opacity-50">{t.properties.currentResident}</span>
                          {activeTenant ? (
                            <div 
                              onClick={() => navigate(`/tenants/${activeTenant.id}`)}
                              className="flex items-center justify-between bg-neutral-50/50 rounded-lg sm:rounded-2xl border border-neutral-100 p-1 sm:p-4 hover:border-neutral-900 transition-all cursor-pointer group/resident rtl:flex-row-reverse"
                            >
                              <div className="flex items-center gap-1.5 sm:gap-4 rtl:flex-row-reverse overflow-hidden">
                                <div className="w-5 h-5 sm:w-10 sm:h-10 bg-white rounded-md sm:rounded-xl border border-neutral-100 flex items-center justify-center text-neutral-400 shadow-sm shrink-0">
                                  <Users size={10} className="sm:w-4 sm:h-4" />
                                </div>
                                <div className="rtl:text-right overflow-hidden">
                                   <span className="block font-black text-[8px] sm:text-sm tracking-tight uppercase truncate">{activeTenant.name}</span>
                                </div>
                              </div>
                              <ChevronRight size={10} className="text-neutral-300 rtl:rotate-180 transition-transform group-hover/resident:translate-x-1 rtl:group-hover/resident:-translate-x-1 shrink-0" />
                            </div>
                          ) : (
                            <div className="text-[7px] sm:text-[10px] font-black text-neutral-400 bg-neutral-50/20 rounded-lg sm:rounded-2xl py-1.5 sm:py-5 border border-neutral-100 border-dashed text-center uppercase tracking-widest">
                              {t.properties.noOccupancy}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-2 sm:p-4 bg-neutral-50/50 border-t border-neutral-100 flex items-center gap-1 sm:gap-2 rtl:flex-row-reverse">
                      {!isReadOnly && (
                        <Button 
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate('/tenants', { state: { prefillPropertyId: property.id, openAddModal: true } })}
                          className="flex-1 bg-white border border-neutral-100 h-7 sm:h-10 rounded-lg sm:rounded-xl hover:border-neutral-900 transition-all shadow-sm px-0"
                        >
                          <UserPlus size={10} className="sm:w-3.5 sm:h-3.5 mr-1 sm:mr-2 rtl:ml-1 sm:rtl:ml-2 text-neutral-400" />
                          <span className="uppercase text-[7px] sm:text-[10px] font-black tracking-widest">{t.nav.tenants}</span>
                        </Button>
                      )}
                      {archivedCount > 0 && (
                        <Link 
                          to={`/archived-tenants?propertyId=${property.id}`}
                          className="w-7 h-7 sm:w-10 sm:h-10 bg-white border border-neutral-100 rounded-lg sm:rounded-xl flex items-center justify-center text-neutral-300 hover:text-neutral-900 hover:border-neutral-900 transition-all shadow-sm shrink-0"
                          title={`${t.nav.archive} (${archivedCount})`}
                        >
                          <HistoryIcon size={12} className="sm:w-4.5 sm:h-4.5" />
                        </Link>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {isPropertyModalOpen && (
        <PropertyFormModal
          isOpen={isPropertyModalOpen}
          onClose={() => setIsPropertyModalOpen(false)}
          onSave={handleSaveProperty}
          editingProperty={editingProperty}
        />
      )}

      {isFolderModalOpen && (
        <FolderFormModal
          isOpen={isFolderModalOpen}
          onClose={() => setIsFolderModalOpen(false)}
          onSave={handleSaveFolder}
          editingFolder={editingFolder}
          allProperties={properties}
        />
      )}

      {propertyToMove && (
        <MoveToFolderModal
          isOpen={isMoveModalOpen}
          onClose={() => setIsMoveModalOpen(false)}
          onAssign={assignPropertyToFolder}
          property={propertyToMove}
          folders={folders}
        />
      )}

      {deleteModalOpen && (
        <ConfirmModal
          isOpen={deleteModalOpen}
          onCancel={() => setDeleteModalOpen(false)}
          onConfirm={confirmDeleteProperty}
          title={t.properties.archiveAsset}
          message={t.properties.archiveAssetConfirm.replace('{name}', propertyToDelete?.name || '')}
          confirmText={t.common.confirmDelete}
          isDestructive={true}
        />
      )}

      {folderDeleteModalOpen && folderToDelete && (
        <ConfirmModal
          isOpen={folderDeleteModalOpen}
          onCancel={() => setFolderDeleteModalOpen(false)}
          onConfirm={confirmDeleteFolder}
          title={t.properties.deleteFolder}
          message={t.properties.confirmDeleteFolder}
          confirmText={t.common.delete}
          isDestructive={true}
        />
      )}
    </div>
  );
};


