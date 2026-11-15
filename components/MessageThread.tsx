import type { ChatMessage } from '@/lib/data';
import { LOCALE, t, type Lang } from '@/lib/i18n';

const fmtTs = (ts: number, lang: Lang) => new Date(ts).toLocaleString(LOCALE[lang], { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short' });

/** Nachrichtenverlauf. „mine“ bestimmt, welche Seite rechts steht (Bucher- oder Team-Ansicht). */
export function MessageThread({ messages, mine, empty, lang = 'de' }: { messages: ChatMessage[]; mine: 'booker' | 'team'; empty: string; lang?: Lang }) {
  if (!messages.length) return <p className="muted small">{empty}</p>;
  return (
    <ol className="thread">
      {messages.map((m) => (
        <li key={m.id} className={m.authorType === mine ? 'me' : 'them'}>
          <div className="bubble">{m.body}</div>
          <span className="meta-line">{m.authorType === 'team' ? `${m.authorName} · ${t(lang).booker.orgaTeam}` : m.authorName} · {fmtTs(m.createdAt, lang)}{mine === 'team' && m.authorType === 'booker' && !m.teamReadAt && <b> · neu</b>}</span>
        </li>
      ))}
    </ol>
  );
}
