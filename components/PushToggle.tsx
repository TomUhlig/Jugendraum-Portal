'use client';
import { Bell, BellOff } from 'lucide-react';
import { useEffect, useState } from 'react';

const toKey = (b64: string) => { const p = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(p), (c) => c.charCodeAt(0)); };
const deviceName = () => { const ua = navigator.userAgent; return /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Gerät'; };

/** Push-Benachrichtigungen auf diesem Gerät an- und abschalten. */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on'>('loading');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setState(ios && !standalone ? 'ios-install' : 'unsupported');
      if (Notification.permission === 'denied') return setState('denied');
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
  }, []);
  async function enable() {
    setMsg('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState(perm === 'denied' ? 'denied' : 'off'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
      const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'subscribe', subscription: sub.toJSON(), device: deviceName() }) });
      if (!res.ok) throw new Error();
      setState('on'); setMsg('Aktiviert. Du solltest gleich eine Test-Benachrichtigung sehen.');
    } catch { setMsg('Aktivieren hat nicht geklappt. Bitte erlaube Benachrichtigungen für diese Seite in den Browser-Einstellungen.'); }
  }
  async function disable() {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
    setState('off'); setMsg('Auf diesem Gerät ausgeschaltet.');
  }
  async function test() {
    const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test' }) });
    setMsg(r.ok ? 'Test gesendet.' : 'Test konnte nicht zugestellt werden.');
  }
  return (
    <div className="stack-sm">
      {state === 'loading' && <span className="muted small">Prüfe …</span>}
      {state === 'unsupported' && <p className="muted small">Dieser Browser unterstützt keine Push-Benachrichtigungen. Auf dem Handy klappt es mit Chrome (Android) oder Safari (iPhone).</p>}
      {state === 'ios-install' && <p className="small">Auf dem iPhone geht Push nur, wenn die Seite als App installiert ist: in Safari unten auf <b>Teilen</b> → <b>Zum Home-Bildschirm</b>, dann die App öffnen, anmelden und hier aktivieren.</p>}
      {state === 'denied' && <p className="small">Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den Browser-Einstellungen (Website-Einstellungen → Benachrichtigungen) und lade die Seite neu.</p>}
      {state === 'off' && <button type="button" className="btn btn-primary" onClick={enable} style={{ justifySelf: 'start' }}><Bell className="icon-sm" />Auf diesem Gerät aktivieren</button>}
      {state === 'on' && <div className="inline"><span className="badge b-ok">auf diesem Gerät aktiv</span><button type="button" className="btn btn-sm" onClick={test}>Test senden</button><button type="button" className="btn btn-sm btn-ghost" onClick={disable}><BellOff className="icon-sm" />Ausschalten</button></div>}
      {msg && <p className="muted small" role="status">{msg}</p>}
    </div>
  );
}
