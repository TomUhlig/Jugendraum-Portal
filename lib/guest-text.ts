import type { Lang } from './i18n';

export const GUEST_TX: Record<Lang, {
  kicker: string; invited: string; when: string; where: string; map: string; toCal: string; toGoogle: string; rules: string; rulesList: string[]; share: string; until: string; cancelled: string;
}> = {
  de: { kicker: 'Einladung', invited: 'Du bist eingeladen', when: 'Wann', where: 'Wo', map: 'Route öffnen', toCal: 'In den Kalender', toGoogle: 'Google Kalender', rules: 'Damit es ein schöner Abend wird',
    rulesList: ['Ab 22 Uhr draußen bitte leise sein, die Nachbarn danken es.', 'Rauchen nur draußen, keine Pyrotechnik und kein Konfetti.', 'Müll bitte mitnehmen oder in die bereitgestellten Säcke.'], share: 'Einladung weiterleiten', until: 'bis', cancelled: 'Dieser Termin findet nicht statt.' },
  en: { kicker: 'Invitation', invited: 'You are invited', when: 'When', where: 'Where', map: 'Open route', toCal: 'Add to calendar', toGoogle: 'Google Calendar', rules: 'For a great evening',
    rulesList: ['Please keep quiet outside after 10 pm, the neighbours will thank you.', 'Smoking outside only, no fireworks and no confetti.', 'Please take your rubbish with you or use the bags provided.'], share: 'Forward invitation', until: 'until', cancelled: 'This event will not take place.' },
  tr: { kicker: 'Davet', invited: 'Davetlisin', when: 'Ne zaman', where: 'Nerede', map: 'Rotayı aç', toCal: 'Takvime ekle', toGoogle: 'Google Takvim', rules: 'Güzel bir akşam için',
    rulesList: ['Saat 22.00’den sonra dışarıda lütfen sessiz olun, komşular teşekkür eder.', 'Sigara yalnızca dışarıda, havai fişek ve konfeti yok.', 'Çöplerinizi lütfen götürün veya verilen torbalara atın.'], share: 'Daveti ilet', until: '–', cancelled: 'Bu etkinlik gerçekleşmeyecek.' },
};
