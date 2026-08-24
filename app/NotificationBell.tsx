'use client';

import { useDropdownCoordinator } from './Dropdown';

type Notification = { id: number; orderId: number | null; title: string; body: string; seen: boolean; createdAt: string };

type NotificationBellProps = {
  notifications: Notification[];
  unseenNotifCount: number;
  markNotificationsSeen: () => void;
  pushEnabled: boolean;
  enablePushNotifications: () => void;
  darkMode: boolean;
  cardBg: string;
  cardBorder: string;
  subtleText: string;
};

export default function NotificationBell({
  notifications, unseenNotifCount, markNotificationsSeen, pushEnabled, enablePushNotifications,
  darkMode, cardBg, cardBorder, subtleText,
}: NotificationBellProps) {
  const { isOpen, toggle, close } = useDropdownCoordinator('notifications');

  const handleToggle = () => {
    const willOpen = !isOpen;
    toggle();
    if (willOpen && unseenNotifCount > 0) markNotificationsSeen();
  };

  return (
    <div className="relative" onMouseLeave={close}>
      <button onClick={handleToggle} className="relative w-10 h-10 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform text-2xl">
        🔔
        {unseenNotifCount > 0 && (<span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unseenNotifCount}</span>)}
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className={`absolute right-0 mt-2 w-80 ${cardBg} border ${cardBorder} rounded-2xl shadow-lg overflow-hidden z-50 max-h-96 overflow-y-auto [&::-webkit-scrollbar]:hidden`} style={{ scrollbarWidth: 'none' }}>
            <div className={`px-4 py-3 border-b ${cardBorder} flex items-center justify-between`}>
              <p className="font-semibold text-sm">Notifications</p>
              {!pushEnabled && (
                <button onClick={enablePushNotifications} className="text-[11px] text-sky-500 hover:text-sky-600 font-medium">Enable push</button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className={`text-sm ${subtleText} text-center py-8 px-4`}>No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`px-4 py-3 border-b ${cardBorder} last:border-b-0 ${!n.seen ? (darkMode ? 'bg-white/5' : 'bg-lime-50') : ''}`}>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className={`text-xs ${subtleText} mt-0.5`}>{n.body}</p>
                  <p className={`text-[10px] ${subtleText} mt-1`}>{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
