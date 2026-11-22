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
  uk: { title: 'Контрольний список', hint: 'Для ваших позначок. Команда бачить, що вже зроблено.', before: 'До', after: 'Після', done: (a, b) => `Виконано ${a} з ${b}`,
    items: { key: 'Передачу ключа узгоджено з контактною особою', guests: 'Кількість гостей визначено (у межах дозволеної)', neighbours: 'Сусідів попереджено',
    food: 'Їжу та напої організовано', trash: 'Мішки для сміття та засоби для прибирання заплановано', deposit: 'Плату та заставу сплачено', cleanteam: 'Команду для прибирання визначено',
    clean: 'Приміщення підметено, кухня чиста, сміття винесено', lock: 'Вікна зачинено, світло вимкнено, опалення зменшено, замкнено', return: 'Ключ повернуто' } },
  ar: { title: 'قائمة المهام', hint: 'لتضع علامة عليها. يرى فريق التنظيم ما تم إنجازه.', before: 'قبل', after: 'بعد', done: (a, b) => `تم ${a} من ${b}`,
    items: { key: 'تم الاتفاق على تسليم المفتاح مع الشخص المسؤول', guests: 'عدد الضيوف محدد (ضمن الحد المسموح)', neighbours: 'تم إبلاغ الجيران',
    food: 'تم تنظيم الطعام والمشروبات', trash: 'أكياس القمامة ومواد التنظيف جاهزة', deposit: 'تم دفع الرسوم والتأمين', cleanteam: 'تم تحديد فريق التنظيف',
    clean: 'القاعة مكنوسة والمطبخ نظيف والقمامة أُخذت', lock: 'النوافذ مغلقة والأنوار مطفأة والتدفئة منخفضة والباب مقفل', return: 'تم إرجاع المفتاح' } },
};
/** Punkte, die für diese Buchung gelten (Feier-Punkte nur bei Feiern, Kautions-Punkt nur bei Kosten). */
export const itemsFor = (isParty: boolean, hasFees: boolean) => CHECKLIST.filter((i) => (!i.party || isParty) && (i.id !== 'deposit' || hasFees));
