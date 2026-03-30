import React from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { 
  Calendar, 
  CreditCard, 
  Download, 
  MapPin,
  Clock,
  History as HistoryIcon
} from 'lucide-react';
import { Card, Button } from '../components/ui';
import { format, parseISO } from 'date-fns';
import { APP_CONFIG } from '../config/constants';
import { useTranslation } from '../i18n';

export const TenantPortal: React.FC = () => {
  const { tenants, properties, payments, generateReceipt } = useAppContext();
  const { t, isRTL } = useTranslation();
  
  const tenant = tenants[0];
  const property = properties[0];

  if (!tenant || !property) {
    return (
      <div className={`min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-neutral-50 rounded-lg ${isRTL ? 'rtl' : ''}`}>
        <Clock className="text-neutral-300 mb-4" size={48} />
        <h2 className="text-lg font-semibold text-neutral-800 tracking-tight">
          {t.tenantPortal.loading}
        </h2>
        <p className="text-neutral-500 mt-2 text-sm font-medium">{t.tenantPortal.syncing}</p>
      </div>
    );
  }

  const handleDownloadReceipt = async (paymentId: string) => {
    try {
      await generateReceipt(paymentId);
      window.open(`/receipt/${paymentId}`, '_blank');
    } catch (error) {
      console.error("Receipt generation failed:", error);
    }
  };

  const nextDueDateLabel = tenant.startDate ? format(parseISO(tenant.startDate), 'MMMM do') : 'N/A';

  const getPropertyImage = (property: any) => {
    if (property.imageUrl) return property.imageUrl;
    
    switch (property.type) {
      case 'فيلا': return '/properties/villa.png';
      case 'مرآب': return '/properties/garage.png';
      case 'دار': return '/properties/house.png';
      case 'شقة': 
      default: return '/properties/apartment.png';
    }
  };

  const paidPayments = payments
    .filter(p => p.datePaid)
    .sort((a, b) => new Date(b.datePaid!).getTime() - new Date(a.datePaid!).getTime());

  return (
    <div className={`container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-6 md:py-10 space-y-8 ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Property Hero Section - Redesigned for mobile stability */}
      <Card padding={false} className="border-neutral-200 shadow-md">
        <div className="flex flex-col">
          <div className="relative h-44 sm:h-52 md:h-72 overflow-hidden">
            <img 
              src={getPropertyImage(property)} 
              alt={property.nameAr || property.name}
              className="w-full h-full object-cover"
            />
            {/* Darker Desktop Overlay */}
            <div className="hidden md:block absolute inset-0 bg-linear-to-t from-neutral-900/90 via-neutral-900/40 to-transparent" />
            <div className={`hidden md:flex absolute bottom-0 ${isRTL ? 'right-0 text-right' : 'left-0 text-left'} p-8 text-white flex-col w-full`}>
              <span className={`px-2 py-0.5 rounded bg-white/20 backdrop-blur-md border border-white/30 text-[9px] font-bold uppercase tracking-[0.15em] w-fit mb-3 ${isRTL ? 'mr-0 ml-auto' : ''}`}>
                {property.type || 'Residential'}
              </span>
              <h1 className="text-3xl lg:text-4xl font-black tracking-tight mb-2 truncate">
                {property.nameAr || property.name}
              </h1>
              <div className={`flex items-center gap-2 text-neutral-200 text-sm font-medium opacity-90 truncate ${isRTL ? 'flex-row-reverse' : ''}`}>
                <MapPin size={16} strokeWidth={2.5} className="text-blue-400" />
                {property.addressAr || property.address}
              </div>
            </div>
          </div>
          
          {/* Mobile Info Overlay (Solid background for perfect contrast) */}
          <div className="md:hidden p-5 bg-white border-t border-neutral-100">
            <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="px-2 py-0.5 rounded bg-neutral-900 text-white text-[9px] font-bold uppercase tracking-widest">
                {property.type || 'Residential'}
              </span>
            </div>
            <h1 className="text-xl font-bold text-neutral-900 mb-1 truncate">
              {property.nameAr || property.name}
            </h1>
            <div className={`flex items-center gap-1.5 text-neutral-600 text-xs font-semibold truncate ${isRTL ? 'flex-row-reverse' : ''}`}>
              <MapPin size={16} strokeWidth={2.5} className="text-blue-600" />
              {property.addressAr || property.address}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          {/* Quick Stats Grid - More stable stacking */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card padding={false} className="bg-white border-neutral-200 shadow-sm">
              <div className={`p-5 flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center shrink-0">
                  <Calendar className="text-white" size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t.tenantPortal.dueDate}</span>
                  <p className="text-lg font-black text-neutral-900 truncate">{nextDueDateLabel}</p>
                </div>
              </div>
            </Card>
            
            <Card padding={false} className="bg-white border-neutral-200 shadow-sm">
              <div className={`p-5 flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <div className="w-12 h-12 bg-success-600 rounded-xl flex items-center justify-center shrink-0">
                  <CreditCard className="text-white" size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">{t.tenantPortal.agreementRent}</span>
                  <p className="text-lg font-black text-neutral-900 truncate">
                    {tenant.rentAmount.toLocaleString()} <span className="text-xs text-neutral-500 font-bold">{APP_CONFIG.CURRENCY}</span>
                  </p>
                </div>
              </div>
            </Card>
          </div>
          {/* Payment History - Optimized for Phone Stability */}
          <Card padding={false} className="border-neutral-200 shadow-sm bg-white overflow-hidden">
             <div className={`px-6 py-5 border-b border-neutral-100 flex items-center bg-neutral-50/50 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 bg-neutral-200 rounded-lg flex items-center justify-center ${isRTL ? 'ml-3' : 'mr-3'}`}>
                  <HistoryIcon size={16} className="text-neutral-700" />
                </div>
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-widest">{t.tenantPortal.paymentHistory}</h3>
             </div>
             
             {/* Desktop Table View */}
             <div className="hidden md:block">
               <table className={`w-full ${isRTL ? 'text-right' : 'text-left'}`}>
                 <thead>
                   <tr className={`bg-neutral-50/30 border-b border-neutral-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
                     <th className={`px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-[0.15em] ${isRTL ? 'text-right' : 'text-left'}`}>{t.tenantPortal.billingPeriod}</th>
                     <th className={`px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-[0.15em] ${isRTL ? 'text-right' : 'text-left'}`}>{t.tenantPortal.recordedOn}</th>
                     <th className={`px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-[0.15em] ${isRTL ? 'text-left' : 'text-right'}`}>{t.expenses.totalAmount}</th>
                     <th className="px-6 py-4"></th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-neutral-100">
                   {paidPayments.map((p) => (
                     <tr key={p.id} className={`hover:bg-neutral-50/30 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
                       <td className="px-6 py-4">
                         <p className="text-sm font-bold text-neutral-900">
                           {format(parseISO(p.periodStart), 'MMMM yyyy')}
                         </p>
                       </td>
                       <td className="px-6 py-4">
                         <p className="text-xs font-semibold text-neutral-600">
                           {p.datePaid ? format(parseISO(p.datePaid), 'MMM d, yyyy') : 'N/A'}
                         </p>
                       </td>
                       <td className={`px-6 py-4 ${isRTL ? 'text-left' : 'text-right'}`}>
                         <p className="text-sm font-black text-neutral-900">
                           {p.amount.toLocaleString()} <span className="text-[10px] text-neutral-500">{APP_CONFIG.CURRENCY}</span>
                         </p>
                       </td>
                       <td className={`px-6 py-4 ${isRTL ? 'text-left' : 'text-right'}`}>
                         <Button 
                           variant="secondary" 
                           size="sm" 
                           className={`h-8 px-4 text-[10px] font-bold border-neutral-200 ${isRTL ? 'flex-row-reverse' : ''}`}
                           onClick={() => handleDownloadReceipt(p.id)}
                         >
                           <Download size={20} className={isRTL ? 'ml-1.5' : 'mr-1.5'} />
                           {t.tenantPortal.receipt}
                         </Button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>

             {/* Mobile Card List View (Rock Solid for Phones) */}
             <div className="md:hidden divide-y divide-neutral-100">
                {paidPayments.map((p) => (
                  <div key={p.id} className="p-5 flex flex-col gap-3">
                    <div className={`flex justify-between items-start ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                      <div>
                        <p className="text-xs font-bold text-neutral-900 mb-0.5">
                          {format(parseISO(p.periodStart), 'MMMM yyyy')}
                        </p>
                        <p className="text-[10px] font-semibold text-neutral-500">
                          {t.tenantPortal.recordedOn}: {p.datePaid ? format(parseISO(p.datePaid), 'MMM d, yyyy') : 'N/A'}
                        </p>
                      </div>
                      <p className="text-sm font-black text-neutral-900">
                        {p.amount.toLocaleString()} <span className="text-[10px] text-neutral-500 font-bold">{APP_CONFIG.CURRENCY}</span>
                      </p>
                    </div>
                    <Button 
                      variant="secondary" 
                      className={`w-full h-10 text-[10px] font-bold border-neutral-200 ${isRTL ? 'flex-row-reverse' : ''}`}
                      onClick={() => handleDownloadReceipt(p.id)}
                    >
                      <Download size={20} className={isRTL ? 'ml-2' : 'mr-2'} />
                      {t.tenantPortal.downloadReceipt}
                    </Button>
                  </div>
                ))}
             </div>

             {paidPayments.length === 0 && (
              <div className="py-20 text-center">
                <HistoryIcon size={32} className="text-neutral-200 mx-auto mb-3" />
                <p className="text-sm font-bold text-neutral-400">{t.tenantPortal.noHistory}</p>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6 md:space-y-8">
          {/* Agreement Summary Widget */}
          <Card padding={false} className="bg-white border-neutral-200 shadow-sm">
             <div className="p-6">
                <div className="space-y-4">
                   <h4 className={`text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4 ${isRTL ? 'text-right' : ''}`}>{t.tenantPortal.agreementTerms}</h4>
                   <div className={`flex justify-between items-center bg-neutral-50/50 p-3 rounded-lg border border-neutral-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
                     <span className="text-xs font-bold text-neutral-600 uppercase">{t.tenantPortal.monthlyPrice}</span>
                     <span className="text-sm font-black text-neutral-900">{tenant.rentAmount.toLocaleString()} {APP_CONFIG.CURRENCY}</span>
                   </div>
                   <div className={`flex justify-between items-center bg-neutral-50/50 p-3 rounded-lg border border-neutral-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
                     <span className="text-xs font-bold text-neutral-600 uppercase">{t.tenantPortal.paymentDay}</span>
                     <span className="text-sm font-black text-neutral-900">{t.tenantPortal.firstOfMonth}</span>
                   </div>
                </div>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
