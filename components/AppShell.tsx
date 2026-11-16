'use client';
import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/** Registriert den Service Worker (Offline-Ansicht, Push) und zeigt einen Hinweis, wenn keine Verbindung besteht. */
export function AppShell({ offlineText }: { offlineText: string }) {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if ('serviceWorker' in navigator && location.hostname !== '127.0.0.1') navigator.serviceWorker.register('/sw.js').catch(() => {});
    const on = () => setOffline(!navigator.onLine);
    on();
    window.addEventListener('online', on); window.addEventListener('offline', on);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on); };
  }, []);
  if (!offline) return null;
  return <div className="offline-bar" role="status"><WifiOff className="icon-sm" />{offlineText}</div>;
}
