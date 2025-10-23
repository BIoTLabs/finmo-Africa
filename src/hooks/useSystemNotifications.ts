import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SystemNotification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  created_at: string;
  expires_at: string | null;
  priority: number;
}

export const useSystemNotifications = () => {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();

    // Set up realtime subscription
    const channel = supabase
      .channel('system_notifications_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_notifications'
        },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('system_notifications')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const activeNotifications = data?.filter(n => {
        if (!n.expires_at) return true;
        return new Date(n.expires_at) > new Date();
      }) || [];

      setNotifications(activeNotifications);
      
      // Get read notifications from localStorage
      const readIds = JSON.parse(localStorage.getItem('readNotifications') || '[]');
      const unread = activeNotifications.filter(n => !readIds.includes(n.id)).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = (notificationId: string) => {
    const readIds = JSON.parse(localStorage.getItem('readNotifications') || '[]');
    if (!readIds.includes(notificationId)) {
      readIds.push(notificationId);
      localStorage.setItem('readNotifications', JSON.stringify(readIds));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    localStorage.setItem('readNotifications', JSON.stringify(allIds));
    setUnreadCount(0);
  };

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications
  };
};
