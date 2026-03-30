import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../hooks/useAppContext';
import { useAuth } from '../store/AuthContext';
import { 
  UserPlus, 
  Trash2, 
  Mail, 
  ShieldCheck, 
  ShieldAlert,
  AlertTriangle, 
  ArrowLeft, 
  Clock, 
  Eye, 
  Calendar,
  Activity,
  History,
  Shield,
  LayoutDashboard,
  Settings,
  LogOut
} from 'lucide-react';
import { Button, Card, Input } from '../components/ui';
import { ConfirmModal } from '../components/ConfirmModal';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { useTranslation } from '../i18n';

export const LandlordManager: React.FC = () => {
  const { 
    authorizedLandlords, 
    authorizeLandlord, 
    revokeLandlord, 
    updateLandlordPermissions,
    canManageAccess,
    tenants 
  } = useAppContext();
  const { role, isAdmin, canViewDashboard, ownerEmail, user, accessAccounts, switchActiveAccount } = useAuth();
  const navigate = useNavigate();
  const { t, isRTL } = useTranslation();
  
  const [newEmail, setNewEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [revokeConfirm, setRevokeConfirm] = useState<{ id: string, email: string } | null>(null);
  const [viewLogsUser, setViewLogsUser] = useState<string | null>(null);

  // Fetch all logs for this owner
  useEffect(() => {
    if (!user || (!canManageAccess && role !== 'owner')) return;
    
    // For guests, we only see logs for the active owner
    // For owners, we see all logs
    const q = query(
      collection(db, 'activity_logs'),
      where('ownerId', '==', role === 'owner' ? user.uid : (ownerEmail || '')),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [user, role, canManageAccess, ownerEmail]);

  // Security: Only owners or guests with dashboard permission can see this page
  if (role !== 'owner' && !canViewDashboard) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 bg-danger-50 text-danger-600 rounded-full flex items-center justify-center mb-6 border border-danger-100">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 mb-2 mt-4 tracking-tight uppercase">{t.landlords.accessRestricted}</h2>
        <p className="text-sm text-neutral-500 font-medium mb-8 max-w-md leading-relaxed">
          {t.landlords.ownerOnly}
        </p>
        <Button onClick={() => navigate('/')} variant="secondary">{t.landlords.returnToDashboard}</Button>
      </div>
    );
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    
    setIsSubmitting(true);
    try {
      await authorizeLandlord(newEmail);
      setNewEmail('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmRevoke = async () => {
    if (!revokeConfirm) return;
    try {
      setIsSubmitting(true);
      await revokeLandlord(revokeConfirm.email, revokeConfirm.id);
      setRevokeConfirm(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatLastActive = (dateStr?: string) => {
    if (!dateStr) return t.landlords.never;
    const date = parseISO(dateStr);
    if (!isValid(date)) return 'Invalid date';
    return formatDistanceToNow(date, { addSuffix: true });
  };

  return (
    <div className={`max-w-6xl mx-auto space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
        <div className={isRTL ? 'text-right' : ''}>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">{t.landlords.accessManagement}</h1>
          <p className="text-xs text-neutral-500 font-bold uppercase tracking-wider mt-1">{t.landlords.controlLogs}</p>
        </div>
      </div>

      {canManageAccess && (
        <Card padding={false} className="bg-white shadow-sm border-neutral-200">
          <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 py-4 px-4 md:px-6 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
            
            {/* Performance KPI Group */}
            <div className={`flex items-center gap-4 shrink-0 w-full md:w-auto ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <div className="w-12 h-12 rounded-full bg-neutral-50 flex items-center justify-center border border-neutral-100 shrink-0">
                <ShieldCheck size={24} className="text-neutral-500" />
              </div>
              <div className={isRTL ? 'text-right' : ''}>
                 <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{t.landlords.totalDelegates}</div>
                 <div className="text-xl font-black text-neutral-900 leading-none mt-1">{authorizedLandlords.length} {t.landlords.accounts}</div>
              </div>
            </div>
            
            {/* Classic Vertical Divider (PC Only) */}
            <div className="hidden md:block w-px h-10 bg-neutral-200 shrink-0 mx-2" />
            
            {/* Form Tools */}
            <form onSubmit={handleAdd} className={`flex flex-col sm:flex-row items-center gap-3 w-full md:max-w-xl ${isRTL ? 'sm:flex-row-reverse md:justify-start' : 'md:justify-end'}`}>
              <div className="grow w-full">
                <Input 
                  type="email" 
                  placeholder={t.landlords.googleEmailPlaceholder}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className={`w-full text-xs font-bold ${isRTL ? 'text-right' : 'text-left'}`}
                  required
                />
              </div>
              <Button 
                type="submit" 
                disabled={isSubmitting || !newEmail}
                className="h-10 w-full sm:w-auto px-5 font-black uppercase tracking-widest text-[10px] shadow-sm bg-neutral-900 hover:bg-black text-white shrink-0"
              >
                {isSubmitting ? t.landlords.granting : t.landlords.grantAccess}
              </Button>
            </form>
          </div>
        </Card>
      )}

      {/* Guest Personal Dashboard Mini View */}
      {role === 'landlord' && (
        <Card className={`flex items-center justify-between bg-neutral-50 border-neutral-200 shadow-sm ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
          <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="w-10 h-10 rounded bg-white border border-neutral-200 flex items-center justify-center">
              <Shield size={20} className="text-neutral-600" />
            </div>
            <div className={isRTL ? 'text-right' : ''}>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{t.landlords.activePermissions}</p>
              <p className="text-sm font-black text-neutral-900 mt-0.5">{isAdmin ? t.landlords.adminRights : t.landlords.readOnlyViewer}</p>
            </div>
          </div>
          <div className={isRTL ? 'text-left' : 'text-right'}>
             <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{t.landlords.propertyManager}</p>
             <p className="text-xs font-bold text-neutral-700 mt-0.5">{ownerEmail}</p>
          </div>
        </Card>
      )}

      {/* Strict Tabular Delegate List (PC ONLY) */}
      <Card padding={false} className="hidden md:block shadow-sm border-neutral-200 bg-white">
        <div className="overflow-x-auto min-h-[300px]">
          <table className={`min-w-full divide-y divide-neutral-100 ${isRTL ? 'text-right' : 'text-left'}`}>
            <thead className="bg-neutral-50/50">
              <tr className={isRTL ? 'flex-row-reverse' : ''}>
                <th scope="col" className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'} text-[10px] font-black text-neutral-500 uppercase tracking-widest border-b border-neutral-200 whitespace-nowrap`}>{t.landlords.registeredAccount}</th>
                <th scope="col" className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'} text-[10px] font-black text-neutral-500 uppercase tracking-widest border-b border-neutral-200 whitespace-nowrap`}>{t.landlords.currentStatus}</th>
                <th scope="col" className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'} text-[10px] font-black text-neutral-500 uppercase tracking-widest border-b border-neutral-200 whitespace-nowrap`}>{t.landlords.privilegeRole}</th>
                <th scope="col" className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'} text-[10px] font-black text-neutral-500 uppercase tracking-widest border-b border-neutral-200 whitespace-nowrap`}>{t.landlords.domainRestriction}</th>
                <th scope="col" className={`px-4 py-3 ${isRTL ? 'text-left' : 'text-right'} text-[10px] font-black text-neutral-500 uppercase tracking-widest border-b border-neutral-200 whitespace-nowrap`}>{t.tenants.actions}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-50">
              {authorizedLandlords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-neutral-400 text-xs font-bold uppercase tracking-widest">
                    {t.landlords.noLandlords}
                  </td>
                </tr>
              ) : (
                authorizedLandlords.map((record) => (
                  <tr key={record.id} className={`hover:bg-neutral-50/30 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className="w-8 h-8 rounded bg-neutral-100 flex items-center justify-center text-neutral-400 shrink-0">
                          <UserPlus size={14} />
                        </div>
                        <div className={`flex flex-col ${isRTL ? 'items-end' : ''}`}>
                          <span className="text-sm font-bold text-neutral-900 tracking-tight">{record.landlordEmail}</span>
                          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">{t.landlords.visits}: {record.accessCount || 0}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {record.isCurrentlyViewing ? (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-900 border border-neutral-900 w-fit ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                          <span className="text-[9px] font-black uppercase text-white tracking-widest">{t.landlords.active}</span>
                        </div>
                      ) : (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-50 border border-neutral-200 w-fit ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 shrink-0" />
                          <span className="text-[9px] font-black uppercase text-neutral-500 tracking-widest">{formatLastActive(record.lastActive)}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                        {canManageAccess ? (
                          <select
                            value={record.isAdmin ? 'admin' : 'viewer'}
                            onChange={(e) => updateLandlordPermissions(record.id, { isAdmin: e.target.value === 'admin' })}
                            disabled={!!record.restrictedTenantId}
                            className={`h-8 px-2 w-28 text-[10px] font-bold bg-white border outline-none rounded uppercase tracking-wider transition-colors ${record.isAdmin ? 'border-primary-500 text-primary-700 bg-primary-50/20' : 'border-neutral-200 text-neutral-700 focus:border-neutral-900'} ${record.restrictedTenantId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <option value="viewer">{t.landlords.viewer}</option>
                            <option value="admin">{t.landlords.admin}</option>
                          </select>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">{record.isAdmin ? t.landlords.admin : t.landlords.viewer}</span>
                        )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                       {canManageAccess ? (
                          <select
                            value={record.restrictedTenantId || ''}
                            onChange={(e) => {

                                const tenantId = e.target.value;
                                if (!tenantId) {
                                  updateLandlordPermissions(record.id, { 
                                    restrictedTenantId: undefined, 
                                    restrictedTenantName: undefined,
                                    isReadOnly: false, 
                                    isAdmin: record.isAdmin 
                                  });
                                } else {
                                  const tenant = tenants.find(t => t.id === tenantId);
                                  updateLandlordPermissions(record.id, { 
                                    restrictedTenantId: tenantId, 
                                    restrictedTenantName: tenant?.name,
                                    isReadOnly: true, 
                                    isAdmin: false,   
                                    canViewDashboard: false 
                                  });
                                }
                            }}
                            className={`h-8 px-2 w-36 text-[10px] font-bold bg-white border outline-none rounded uppercase tracking-wider transition-colors ${!record.restrictedTenantId ? 'border-neutral-200 text-neutral-700 focus:border-neutral-900 cursor-pointer' : 'border-warning-500 text-warning-700 bg-warning-50/20 cursor-pointer'}`}
                          >
                            <option value="">{t.landlords.globalNetwork}</option>
                            <optgroup label={t.landlords.restrictScope}>
                              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </optgroup>
                          </select>
                       ) : (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">{record.restrictedTenantName || t.landlords.globalNetwork}</span>
                       )}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap ${isRTL ? 'text-left' : 'text-right'}`}>
                       <div className={`flex items-center justify-end gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                         <Button
                            variant="secondary"
                            onClick={() => setViewLogsUser(record.landlordEmail)}
                            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-neutral-200 text-neutral-600 hover:text-neutral-900 shadow-sm"
                         >
                           <Activity size={14} className={isRTL ? 'ml-1.5' : 'mr-1.5'} /> {t.landlords.logs}
                         </Button>
                         {canManageAccess && (
                           <Button
                             variant="secondary"
                             onClick={() => setRevokeConfirm({ id: record.id, email: record.landlordEmail })}
                             className="w-9 h-9 p-0 border-neutral-200 text-danger-400 hover:bg-danger-50 hover:border-danger-300 hover:text-danger-600 shadow-sm"
                             title={t.landlords.revokeControl}
                           >
                             <Trash2 size={16} />
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

      {/* Mobile Delegate Cards (PHONE ONLY) */}
      <div className="flex flex-col gap-4 md:hidden">
        {authorizedLandlords.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-10 text-center border-dashed border-neutral-200 bg-neutral-50/50">
            <ShieldCheck size={32} className="text-neutral-400 mb-2" />
            <h3 className="text-sm font-bold text-neutral-900">{t.landlords.noGuests}</h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">{t.landlords.inviteDelegates}</p>
          </Card>
        ) : (
          authorizedLandlords.map((record) => (
            <Card key={record.id} padding={false} className="bg-white shadow-sm border-neutral-200">
              <div className="p-4 flex flex-col gap-4">
                
                {/* Header: User Info & Status */}
                <div className={`flex items-start justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-3 w-full overflow-hidden ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                    <div className="w-10 h-10 rounded bg-neutral-100 flex items-center justify-center text-neutral-400 shrink-0">
                      <UserPlus size={16} />
                    </div>
                    <div className={`flex flex-col overflow-hidden w-full ${isRTL ? 'text-right' : ''}`}>
                      <span className="text-sm font-bold text-neutral-900 truncate">{record.landlordEmail}</span>
                      <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">{t.landlords.visits}: {record.accessCount || 0}</span>
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  {record.isCurrentlyViewing ? (
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-900 border border-neutral-900 shrink-0 mt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                      <span className="text-[9px] font-black uppercase text-white tracking-widest">{t.landlords.active}</span>
                    </div>
                  ) : (
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-50 border border-neutral-200 shrink-0 mt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 shrink-0" />
                      <span className="text-[9px] font-black uppercase text-neutral-500 tracking-widest">{formatLastActive(record.lastActive)}</span>
                    </div>
                  )}
                </div>

                {/* Config: Privilege & Domain */}
                <div className="flex flex-col gap-3 bg-neutral-50/50 border border-neutral-100 rounded-lg p-3">
                   <div className={isRTL ? 'text-right' : ''}>
                      <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">{t.landlords.privilegeRole}</div>
                      {canManageAccess ? (
                        <select
                          value={record.isAdmin ? 'admin' : 'viewer'}
                          onChange={(e) => updateLandlordPermissions(record.id, { isAdmin: e.target.value === 'admin' })}
                          disabled={!!record.restrictedTenantId}
                          className={`h-10 px-3 w-full text-xs font-bold bg-white border outline-none rounded-md uppercase tracking-wider transition-colors ${isRTL ? 'text-right' : 'text-left'} ${record.isAdmin ? 'border-primary-500 text-primary-700 bg-primary-50/20' : 'border-neutral-200 text-neutral-700 focus:border-neutral-900'} ${record.restrictedTenantId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <option value="viewer">{t.landlords.viewer}</option>
                          <option value="admin">{t.landlords.admin}</option>
                        </select>
                      ) : (
                        <div className={`h-10 px-3 w-full flex items-center bg-white border border-neutral-200 rounded-md ${isRTL ? 'justify-end' : ''}`}>
                          <span className="text-xs font-bold uppercase tracking-widest text-neutral-600">{record.isAdmin ? t.landlords.admin : t.landlords.viewer}</span>
                        </div>
                      )}
                   </div>

                   <div className={isRTL ? 'text-right' : ''}>
                      <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">{t.landlords.networkRestriction}</div>
                      {canManageAccess ? (
                        <select
                          value={record.restrictedTenantId || ''}
                          onChange={(e) => {
                              const tenantId = e.target.value;
                              if (!tenantId) {
                                updateLandlordPermissions(record.id, { 
                                  restrictedTenantId: null,
                                  restrictedTenantName: null
                                });
                              } else {
                                const tenant = tenants.find(t => t.id === tenantId);
                                updateLandlordPermissions(record.id, { 
                                  restrictedTenantId: tenantId, 
                                  restrictedTenantName: tenant?.name || null
                                });
                              }
                          }}
                          className={`h-10 px-3 w-full text-xs font-bold bg-white border outline-none rounded-md uppercase tracking-wider transition-colors ${isRTL ? 'text-right' : 'text-left'} ${!record.restrictedTenantId ? 'border-neutral-200 text-neutral-700 focus:border-neutral-900 cursor-pointer' : 'border-warning-500 text-warning-700 bg-warning-50/20 cursor-pointer'}`}
                        >
                          <option value="">{t.landlords.globalNetwork}</option>
                          <optgroup label={t.landlords.restrictScope}>
                            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </optgroup>
                        </select>
                      ) : (
                        <div className={`h-10 px-3 w-full flex items-center bg-white border border-neutral-200 rounded-md ${isRTL ? 'justify-end' : ''}`}>
                           <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 truncate">{record.restrictedTenantName || t.landlords.globalNetwork}</span>
                        </div>
                      )}
                   </div>
                </div>

                {/* Actions Footer */}
                <div className={`flex items-center gap-2 pt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                   <Button
                      variant="secondary"
                      onClick={() => setViewLogsUser(record.landlordEmail)}
                      className="flex-1 h-10 px-0 flex justify-center text-[10px] font-black uppercase tracking-widest gap-2 bg-neutral-50 hover:bg-neutral-100 border-neutral-200"
                    >
                      <Activity size={14} className="text-neutral-500" />
                      {t.landlords.logs}
                   </Button>
                   {canManageAccess && (
                      <Button
                        variant="danger"
                        onClick={() => setRevokeConfirm({ id: record.id, email: record.landlordEmail })}
                        className="flex-1 h-10 px-0 flex justify-center text-[10px] font-black uppercase tracking-widest gap-2"
                      >
                        <Trash2 size={14} />
                        {t.landlords.revoke}
                      </Button>
                   )}
                </div>

              </div>
            </Card>
          ))
        )}
      </div>

      {/* Revoke Modal */}
      <ConfirmModal
        isOpen={!!revokeConfirm}
        onCancel={() => setRevokeConfirm(null)}
        onConfirm={confirmRevoke}
        title={t.landlords.revokeAuthority}
        message={t.landlords.revokeMessage.replace('{email}', revokeConfirm?.email || '')}
        confirmText={t.landlords.confirmRevocation}
        cancelText={t.common.cancel}
        isDestructive={true}
      />

      {/* Activity Logs Modal */}
      {viewLogsUser && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center bg-neutral-900/60 backdrop-blur-[2px] p-4 text-left">
          <div className="w-full max-w-lg bg-white rounded shadow-xl flex flex-col max-h-[90vh]">
            <div className={`px-5 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
               <div className={isRTL ? 'text-right' : ''}>
                  <h3 className="text-sm font-black uppercase tracking-widest text-neutral-900">{t.landlords.operationsFeed}</h3>
                  <p className="text-[10px] font-bold text-neutral-400 mt-1 uppercase tracking-widest">{viewLogsUser}</p>
               </div>
               <button onClick={() => setViewLogsUser(null)} className="p-2 text-neutral-400 hover:text-neutral-900 bg-neutral-50 rounded">
                 <ArrowLeft size={16} className={isRTL ? 'rotate-180' : ''} />
               </button>
            </div>
            <div className="p-0 overflow-y-auto flex-1 bg-neutral-50 custom-scrollbar">
               {allLogs.filter(l => l.landlordEmail === viewLogsUser).length === 0 ? (
                 <div className="p-10 text-center">
                   <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{t.landlords.noLogs}</p>
                 </div>
               ) : (
                 <div className="divide-y divide-neutral-100 bg-white">
                   {allLogs.filter(l => l.landlordEmail === viewLogsUser).map(log => (
                     <div key={log.id} className={`p-4 hover:bg-neutral-50 transition-colors ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className="text-xs font-bold text-neutral-800 leading-tight">{log.details}</div>
                        <div className={`text-[10px] font-black text-neutral-400 uppercase tracking-wider mt-1 flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Clock size={10} />
                          {formatDistanceToNow(parseISO(log.timestamp), { addSuffix: true })}
                        </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

