import type { Lang } from './i18n';

/** Hausordnung, an einer Stelle gepflegt: Seite „Raum & Regeln“ und Nutzungsvereinbarung zum Ausdrucken. */
export function hausordnung(capacity: number, lang: Lang = 'de'): string[] {
  if (lang === 'en') return [
    `A maximum of ${capacity} people in the room.`,
    'Quiet outside from 10 pm; music only with windows and doors closed.',
    'Smoking outside only. No fireworks, no confetti, no open flames except at the barbecue.',
    'Leave the room swept clean: wipe the tables, sweep the floor, clean the kitchen and dishes, take your rubbish with you.',
    'When leaving: close the windows, switch off the lights, turn down the heating, lock up.',
    'Please report any damage immediately. The person who booked is liable for damage during use and responsible for all guests.',
    'At events with minors, the German Youth Protection Act (Jugendschutzgesetz) applies.',
  ];
  if (lang === 'tr') return [
    `Salonda en fazla ${capacity} kişi bulunabilir.`,
    'Saat 22.00’den sonra dışarıda sessizlik; müzik yalnızca pencere ve kapılar kapalıyken.',
    'Sigara yalnızca dışarıda. Havai fişek, konfeti ve mangal dışında açık ateş yasaktır.',
    'Salonu süpürülmüş bırakın: masaları silin, yeri süpürün, mutfağı ve bulaşıkları temizleyin, çöpleri götürün.',
    'Çıkarken: pencereleri kapatın, ışıkları söndürün, kaloriferi kısın, kapıyı kilitleyin.',
    'Hasarları lütfen hemen bildirin. Rezervasyonu yapan kişi kullanım sırasındaki hasarlardan ve tüm misafirlerden sorumludur.',
    'Reşit olmayanların katıldığı etkinliklerde Alman Gençliği Koruma Yasası (Jugendschutzgesetz) geçerlidir.',
  ];
  return [
    `Höchstens ${capacity} Personen im Raum.`,
    'Ab 22 Uhr draußen Ruhe, Musik nur bei geschlossenen Fenstern und Türen.',
    'Rauchen nur draußen. Keine Pyrotechnik, kein Konfetti, keine offenen Flammen außer am Grill.',
    'Raum besenrein verlassen: Tische abwischen, Boden fegen, Küche und Geschirr sauber, Müll mitnehmen.',
    'Beim Gehen: Fenster schließen, Licht aus, Heizung runter, abschließen.',
    'Schäden bitte sofort melden. Wer bucht, haftet für Schäden während der Nutzung und ist verantwortlich für alle Gäste.',
    'Bei Veranstaltungen mit Minderjährigen gilt das Jugendschutzgesetz.',
  ];
}
export const SCHLUESSELREGELN = [
  'Der Schlüssel wird nach Absprache übergeben und darf nicht an Dritte weitergegeben werden.',
  'Bei Übergabe und Rückgabe werden Zustand des Raums und Stromzähler festgehalten.',
  'Ein verlorener Schlüssel muss sofort gemeldet werden. Die Kosten für den Ersatz trägt, wer gebucht hat.',
];
export const KEY_RULES: Record<Lang, string[]> = {
  de: [
    'Den Schlüssel bekommst du nach Absprache von deiner Ansprechperson. Er darf nicht an Dritte weitergegeben werden.',
    'Bei Übergabe und Rückgabe wird der Zustand des Raums und der Stromzähler kurz festgehalten.',
    'Ein verlorener Schlüssel muss sofort gemeldet werden. Die Kosten für den Ersatz trägt, wer gebucht hat.',
  ],
  en: [
    'You get the key from your contact person by arrangement. It must not be passed on to third parties.',
    'At handover and return, the condition of the room and the electricity meter are briefly recorded.',
    'A lost key must be reported immediately. The person who booked pays for the replacement.',
  ],
  tr: [
    'Anahtarı, görüşmeye göre iletişim kişinizden alırsınız. Anahtar üçüncü kişilere verilemez.',
    'Teslim ve iade sırasında salonun durumu ve elektrik sayacı kısaca kaydedilir.',
    'Kaybolan bir anahtar hemen bildirilmelidir. Yenisinin masrafını rezervasyonu yapan kişi öder.',
  ],
};
