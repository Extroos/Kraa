import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useAppContext } from '../hooks/useAppContext';
import { Search, Filter, Calendar, MapPin, History, Trash2, AlertCircle, X } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { Card, Button, Input } from '../components/ui';
import { ConfirmModal } from '../components/ConfirmModal';
import { useTranslation } from '../i18n';

export const ArchivedTenants: React.FC = () => {
  const navigate = useNavigate();
  const { isReadOnly } = useAuth();
  const { getTenantsWithStatus, properties, updateLandlordActivity, deleteTenant } = useAppContext();
  const { t, isRTL } = useTranslation();

  useEffect(() => {
    updateLandlordActivity(t.tenantProfile.historicalArchive);
  }, [updateLandlordActivity, t.tenantProfile.historicalArchive]);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<string | null>(null);

  const handleDeleteClick = (tenantId: string) => {
    setTenantToDelete(tenantId);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (tenantToDelete) {
      await deleteTenant(tenantToDelete);
    }
    setDeleteModalOpen(false);
    setTenantToDelete(null);
  };

  const allTenants = getTenantsWithStatus(true);
  const archivedTenants = allTenants.filter(t => t.tenantStatus === 'archived');
  const location = useLocation();

  const [searchTerm, setSearchTerm] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const propertyId = params.get('propertyId');
    if (propertyId) {
      setPropertyFilter(propertyId);
    }
  }, [location.search]);

  const filteredTenants = archivedTenants.filter(t => {
    const nameStr = t.name || '';
    const propNameStr = t.property?.name || '';
    const matchesSearch = nameStr.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          propNameStr.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProperty = propertyFilter === 'all' || t.propertyId === propertyFilter;
    return matchesSearch && matchesProperty;
  });

  return (
    <div className={`space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
        <div className={isRTL ? 'text-right' : ''}>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">{t.archive.leaseArchive}</h1>
          <p className="text-xs text-neutral-500 font-bold uppercase tracking-wider mt-1">{t.archive.historicalAudit}</p>
        </div>
      </div>

      {/* Filters */}
      <Card className={`flex flex-col sm:flex-row gap-4 bg-white shadow-sm border-neutral-200 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
        <div className="relative flex-1">
          <Search size={16} className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 shrink-0 text-neutral-400`} />
          <Input
            placeholder={t.archive.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${isRTL ? 'pr-10 text-right' : 'pl-10 text-left'} h-10 text-sm font-medium border-neutral-200 focus:border-primary-500 transition-colors`}
          />
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Filter size={16} className="shrink-0 text-neutral-400" />
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className={`h-10 px-4 bg-neutral-50 border border-neutral-200 rounded text-xs font-bold uppercase tracking-wider text-neutral-600 outline-none focus:border-primary-500 cursor-pointer appearance-none min-w-[160px] ${isRTL ? 'text-right' : 'text-left'}`}
          >
            <option value="all">{t.archive.allProperties}</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Spreadsheet View (PC ONLY) */}
      <Card padding={false} className="hidden md:block shadow-sm overflow-hidden border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y divide-neutral-100 ${isRTL ? 'text-right' : 'text-left'}`}>
            <thead className="bg-neutral-50/50">
              <tr className={isRTL ? 'flex-row-reverse' : ''}>
                <th scope="col" className={`px-6 py-4 ${isRTL ? 'text-right' : 'text-left'} text-[11px] font-bold text-neutral-500 uppercase tracking-widest`}>{t.archive.tenantDetails}</th>
                <th scope="col" className={`px-6 py-4 ${isRTL ? 'text-right' : 'text-left'} text-[11px] font-bold text-neutral-500 uppercase tracking-widest`}>{t.archive.propertyLocation}</th>
                <th scope="col" className={`px-6 py-4 ${isRTL ? 'text-right' : 'text-left'} text-[11px] font-bold text-neutral-500 uppercase tracking-widest`}>{t.archive.tenancyPeriod}</th>
                <th scope="col" className={`px-6 py-4 ${isRTL ? 'text-right' : 'text-left'} text-[11px] font-bold text-neutral-500 uppercase tracking-widest`}>{t.archive.archivedOn}</th>
                <th scope="col" className={`px-6 py-4 ${isRTL ? 'text-left' : 'text-right'} text-[11px] font-bold text-neutral-500 uppercase tracking-widest`}>{t.archive.quickActions}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-50">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <History size={40} className="text-neutral-200 mx-auto mb-4 shrink-0" />
                    <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">{t.archive.emptyArchive}</h3>
                    <p className="text-xs text-neutral-400 mt-1 font-medium">{t.archive.emptyArchiveDesc}</p>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.id} className={`hover:bg-neutral-50/50 transition-colors group ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`flex flex-col ${isRTL ? 'items-end' : ''}`}>
                        <span className="text-sm font-bold text-neutral-900 tracking-tight">{tenant.name}</span>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mt-0.5">{tenant.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <MapPin size={14} className="shrink-0 text-neutral-300" />
                        <span className="text-xs font-bold text-neutral-600 uppercase tracking-tight">{tenant.property?.name || '---'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-bold text-neutral-900 tabular-nums">
                        {(() => {
                          const d = parseISO(tenant.startDate);
                          return isValid(d) ? format(d, 'MMM d, yyyy') : '---';
                        })()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-bold text-primary-600 tabular-nums bg-primary-50 px-2 py-0.5 rounded">
                        {(() => {
                          if (!tenant.archiveDate) return '---';
                          const d = parseISO(tenant.archiveDate);
                          return isValid(d) ? format(d, 'MMM d, yyyy') : '---';
                        })()}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isRTL ? 'text-left' : 'text-right'}`}>
                      <div className={`flex items-center justify-end gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Button
                          variant="secondary"
                          size="sm"
                          as={Link}
                          to={`/tenants/${tenant.id}`}
                          className="h-10 px-5 text-[11px] font-bold uppercase tracking-widest bg-white border-neutral-200 hover:bg-neutral-50 shadow-sm"
                        >
                          <Calendar size={18} className={`shrink-0 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                          {t.archive.viewArchive}
                        </Button>
                        {!isReadOnly && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDeleteClick(tenant.id)}
                            className="w-10 h-10 p-0 border-neutral-200 text-danger-400 hover:text-danger-600 hover:border-danger-300 hover:bg-danger-50 shadow-sm"
                            title={t.archive.deleteTenant}
                          >
                            <Trash2 size={24} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile Card View (PHONE ONLY) */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {filteredTenants.length === 0 ? (
          <Card className="col-span-2 flex flex-col items-center justify-center py-10 text-center border-dashed border-neutral-100 bg-neutral-50/20">
            <History size={32} className="text-neutral-200 mx-auto mb-2 shrink-0" />
            <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-wider">{t.archive.emptyArchive}</h3>
          </Card>
        ) : (
          filteredTenants.map((tenant) => (
            <Card 
              key={tenant.id} 
              padding={false} 
              className="bg-white shadow-sm border-neutral-100 rounded-lg flex flex-col h-full overflow-hidden relative"
              onClick={() => navigate(`/tenants/${tenant.id}`)}
            >
              {!isReadOnly && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteClick(tenant.id); }}
                  className="absolute top-1.5 right-1.5 z-10 w-5 h-5 flex items-center justify-center text-neutral-300 hover:text-danger-500 transition-colors rounded-full hover:bg-danger-50 rtl:right-auto rtl:left-1.5"
                >
                  <X size={14} strokeWidth={3} />
                </button>
              )}

              <div className="p-3 flex-1 flex flex-col">
                <div className="mb-2 rtl:text-right pr-4 rtl:pr-0 rtl:pl-4">
                   <h3 className="text-xs font-bold text-neutral-900 tracking-tight leading-none mb-1 truncate">{tenant.name}</h3>
                   <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wide opacity-70">{tenant.phone}</span>
                </div>
                
                <div className={`flex items-center gap-1.5 mb-2 opacity-80 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <MapPin size={10} className="shrink-0 text-neutral-300" />
                  <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-tight truncate">{tenant.property?.name || '---'}</span>
                </div>

                <div className="mt-auto pt-2 border-t border-neutral-50">
                  <div className={`flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">{t.archive.archivedOn}</span>
                    <span className="text-[9px] font-bold text-primary-600 tabular-nums">
                      {tenant.archiveDate ? format(parseISO(tenant.archiveDate), 'MMM yyyy') : '---'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onCancel={() => { setDeleteModalOpen(false); setTenantToDelete(null); }}
        onConfirm={confirmDelete}
        title={t.archive.permanentDeletion}
        message={t.archive.deleteConfirmation}
        confirmText={t.archive.confirmDeletion}
        cancelText={t.common.cancel}
      />
    </div>
  );
};

