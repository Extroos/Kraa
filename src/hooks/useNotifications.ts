import { useEffect } from 'react';
import { useAppContext } from './useAppContext';
import { isToday, isBefore, addDays, parseISO, startOfDay, isValid } from 'date-fns';
import { APP_CONFIG } from '../config/constants';
import { useTranslation } from '../i18n';

export const useNotifications = () => {
  const { getTenantsWithStatus } = useAppContext();
  const { t } = useTranslation();

  useEffect(() => {
    // Request permission for browser notifications
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkNotifications = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      const tenants = getTenantsWithStatus();
      const today = startOfDay(new Date());
      
      // Check if we already notified today to avoid spamming
      const lastNotified = localStorage.getItem('lastNotifiedDate');
      const todayStr = today.toISOString();
      if (lastNotified === todayStr) return;

      const lateTenants: string[] = [];
      const dueTodayTenants: string[] = [];
      const dueSoonTenants: string[] = [];

      tenants.forEach(tenant => {
        const parsedDue = parseISO(tenant.nextDueDate);
        if (!isValid(parsedDue)) return;
        const nextDueDate = startOfDay(parsedDue);

        if (isBefore(nextDueDate, today)) {
          lateTenants.push(tenant.name);
        } else if (nextDueDate.getTime() === today.getTime()) {
          dueTodayTenants.push(tenant.name);
        } else if (isBefore(nextDueDate, addDays(today, 4))) {
          dueSoonTenants.push(tenant.name);
        }
      });

      // Batching Logic
      const totalCount = lateTenants.length + dueTodayTenants.length + dueSoonTenants.length;
      if (totalCount === 0) return;

      let title = t.notifications?.summaryTitle || 'KRA Portfolio Update';
      let bodyText = '';

      if (lateTenants.length > 0) {
        bodyText += `[!] ${lateTenants.length} ${t.dashboard.overdue}: ${lateTenants.slice(0, 3).join(', ')}${lateTenants.length > 3 ? '...' : ''}\n`;
      }
      if (dueTodayTenants.length > 0) {
        bodyText += `[•] ${dueTodayTenants.length} ${t.dashboard.dueSoon}: ${dueTodayTenants.slice(0, 3).join(', ')}${dueTodayTenants.length > 3 ? '...' : ''}\n`;
      }
      if (dueSoonTenants.length > 0 && lateTenants.length === 0) {
        bodyText += `[*] ${dueSoonTenants.length} ${t.dashboard.dueSoon}: ${dueSoonTenants.slice(0, 3).join(', ')}${dueSoonTenants.length > 3 ? '...' : ''}`;
      }

      new Notification(title, {
        body: bodyText.trim(),
        icon: '/K.png',
        tag: 'kra-daily-summary' // Replaces existing notifications for the same day
      });

      localStorage.setItem('lastNotifiedDate', todayStr);
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 120 * 60 * 1000); // Check every 2 hours
    return () => clearInterval(interval);
  }, [getTenantsWithStatus, t]);
};
