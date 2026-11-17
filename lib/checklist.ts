import type { Lang } from './i18n';

/** Checkliste für Bucher: was vor und nach dem Termin zu erledigen ist. Gespeichert werden nur die IDs der erledigten Punkte. */
export type ChecklistItem = { id: string; party?: boolean; when: 'before' | 'after' };
export const CHECKLIST: ChecklistItem[] = [
  { id: 'key', when: 'before' }, { id: 'guests', when: 'before' }, { id: 'neighbours', when: 'before', party: true },
  { id: 'food', when: 'before', party: true }, { id: 'trash', when: 'before' }, { id: 'deposit', when: 'before' },
  { id: 'cleanteam', when: 'before', party: true }, { id: 'clean', when: 'after' }, { id: 'lock', when: 'after' }, { id: 'return', when: 'after' },
];
export const CHECKLIST_TEXT: Record<Lang, { title: string; hint: string; before: string; after: string; done: (a: number, b: number) => string; items: Record<string, string> }> = {
  de: { title: 'Checkliste', hint: 'Zum Abhaken für euch. Das Orga-Team sieht, was schon erledigt ist.', before: 'Vorher', after: 'Danach', done: (a, b) => `${a} von ${b} erledigt`,
    items: { key: 'Schlüsselübergabe mit der Ansprechperson abgesprochen', guests: 'Gästezahl steht (höchstens erlaubte Personenzahl)', neighbours: 'Nachbarn informiert',
    food: 'Essen und Getränke organisiert', trash: 'Müllsäcke und Putzzeug eingeplant', deposit: 'Entgelt und Kaution bezahlt', cleanteam: 'Aufräumteam für danach eingeteilt',
    clean: 'Raum besenrein, Küche sauber, Müll mitgenommen', lock: 'Fenster zu, Licht aus, Heizung runter, abgeschlossen', return: 'Schlüssel zurückgegeben' } },
  en: { title: 'Checklist', hint: 'For you to tick off. The organising team can see what is done.', before: 'Before', after: 'Afterwards', done: (a, b) => `${a} of ${b} done`,
    items: { key: 'Key handover arranged with your contact person', guests: 'Number of guests fixed (within the maximum)', neighbours: 'Neighbours informed',
    food: 'Food and drinks organised', trash: 'Bin bags and cleaning supplies planned', deposit: 'Fee and deposit paid', cleanteam: 'Clean-up team arranged',
    clean: 'Room swept, kitchen clean, rubbish taken away', lock: 'Windows closed, lights off, heating down, locked', return: 'Key returned' } },
  tr: { title: 'Kontrol listesi', hint: 'Sizin için işaretlemek üzere. Organizasyon ekibi neyin yapıldığını görür.', before: 'Öncesi', after: 'Sonrası', done: (a, b) => `${b} maddeden ${a} tamam`,
    items: { key: 'Anahtar teslimi irtibat kişisiyle konuşuldu', guests: 'Misafir sayısı belli (izin verilen en fazla)', neighbours: 'Komşular bilgilendirildi',
    food: 'Yiyecek ve içecek ayarlandı', trash: 'Çöp torbası ve temizlik malzemesi planlandı', deposit: 'Ücret ve depozito ödendi', cleanteam: 'Sonrası için temizlik ekibi belirlendi',
    clean: 'Salon süpürüldü, mutfak temiz, çöpler götürüldü', lock: 'Pencereler kapalı, ışıklar kapalı, kalorifer kısık, kilitlendi', return: 'Anahtar iade edildi' } },
};
/** Punkte, die für diese Buchung gelten (Feier-Punkte nur bei Feiern, Kautions-Punkt nur bei Kosten). */
export const itemsFor = (isParty: boolean, hasFees: boolean) => CHECKLIST.filter((i) => (!i.party || isParty) && (i.id !== 'deposit' || hasFees));
