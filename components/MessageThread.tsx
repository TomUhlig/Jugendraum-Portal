import type { ChatMessage } from '@/lib/data';

const fmtTs = (t: number) => new Date(t).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short' });

/** Nachrichtenverlauf. „mine“ bestimmt, welche Seite rechts steht (Bucher- oder Team-Ansicht). */
export function MessageThread({ messages, mine, empty }: { messages: ChatMessage[]; mine: 'booker' | 'team'; empty: string }) {
  if (!messages.length) return <p className="muted small">{empty}</p>;
  return (
    <ol className="thread">
      {messages.map((m) => (
        <li key={m.id} className={m.authorType === mine ? 'me' : 'them'}>
          <div className="bubble">{m.body}</div>
          <span className="meta-line">{m.authorType === 'team' ? `${m.authorName} · Orga-Team` : m.authorName} · {fmtTs(m.createdAt)}{mine === 'team' && m.authorType === 'booker' && !m.teamReadAt && <b> · neu</b>}</span>
        </li>
      ))}
    </ol>
  );
}
