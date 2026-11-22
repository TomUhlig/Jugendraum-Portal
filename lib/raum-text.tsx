import type { Lang } from './i18n';

type V = { capacity: number; fromH: number; untilH: string; latest: string; lead: number; whole: boolean };

/** Texte der Seite „Raum & Regeln“ in drei Sprachen. */
export function raumText(lang: Lang, v: V) {
  if (lang === 'en' || lang === 'uk' || lang === 'ar') return {
    title: 'Room & rules', kicker: 'Youth room of SV Heepen', intro: 'To keep the youth room usable for everyone, a few rules apply. By making a request, you accept them.',
    toc: ['The room', 'How booking works', 'Parties', 'Preparation times', 'Costs', 'Key, handover, return', 'House rules', 'Cancellations and changes', 'Privacy'],
    capacity: `up to ${v.capacity} people`, capacitySub: 'maximum permitted', party: '1 party per weekend', partySub: `Fri ${v.fromH}:00 to Mon ${v.untilH}:00`,
    latest: `Parties until ${v.latest}`, latestSub: 'then clean-up', lead: `${v.lead} days’ notice`, leadSub: 'for parties',
    fixed: 'Fixed times when booking is not possible', onlyParties: ' (parties only)', equipment: 'Equipment:', equipmentTail: 'You can say what you need in your request.',
    steps: [
      <>Agree the use in advance with <b>Michael Grieswelle</b> or <b>Sigrid Brodig</b>. Without this agreement a booking is invalid.</>,
      <>Make the request online and confirm your email address via the link in our email. Unconfirmed requests expire after 24 hours.</>,
      <>The organising team reviews the request and replies by email. Meetings and team meetings of club members are entered directly.</>,
      <>You receive a confirmation with a calendar entry and reminders three days and one day before.</>,
    ],
    partiesText: `There is at most one party per weekend in the youth room. This protects the room and the neighbourhood.${v.whole ? ' On a weekend with a party, the room is also closed for other bookings.' : ' Other bookings are still possible on the same weekend.'} Please request parties at least ${v.lead} days in advance. They end at ${v.latest} at the latest; outside, quiet hours apply from 10 pm.`,
    bufferText: 'Time for setup and clean-up is kept free before and after each booking. If two bookings follow each other, the longer of the two times applies.',
    kind: 'Type', before: 'before', after: 'after', min: 'min',
    feeHead: ['', 'Usage fee', 'Deposit'], feeRows: ['Not a club member', 'Members, private party', 'Club events'], free: 'free of charge',
    noFees: 'Club events are free of charge. Whether a usage fee or deposit applies to private parties is clarified during the prior agreement.',
    depositText: 'The deposit is due at key handover and refunded after inspection. It may be kept in full or in part for damage or missing cleaning.',
    cancelText: 'You can cancel at any time yourself via the link in your confirmation email. Please cancel as early as possible so others can use the slot. For changes to the date or time, contact your contact person. The organising team can move bookings; you will then be informed by email.',
    privacy: (op: { name: string; address: string; email: string }) => [
      <><b>Controller</b> for the processing of your data: {op.name ? `${op.name}, ${op.address.replace(/\n/g, ', ')}, email ${op.email}` : 'the operator named in the legal notice'}.</>,
      <><b>Which data and why:</b> name, email, phone, team, date, occasion and your message. We use them only to process the request, inform you and remind you of the date (Art. 6(1)(b) GDPR). Only the people who manage the youth room have access.</>,
      <><b>Public calendar:</b> it only shows that a time is booked, never your name or occasion.</>,
      <><b>Retention:</b> personal data is deleted automatically 12 months after the date. Unconfirmed requests expire after 24 hours.</>,
      <><b>Service providers:</b> the site and database run with hosting providers on servers in the EU (Frankfurt am Main). An email service is used to send emails. No tracking or advertising cookies are set; only the admin login and your choice of light/dark mode and language are stored.</>,
      <><b>Your rights:</b> you can request access, correction and deletion of your data and object to processing. Contact {op.email || 'the operator'}. You can also complain to a data protection authority; in North Rhine-Westphalia this is the LDI NRW.</>,
    ],
    note: 'Note: template text; the German version is authoritative.',
  };
  if (lang === 'tr') return {
    title: 'Salon ve kurallar', kicker: 'SV Heepen gençlik salonu', intro: 'Gençlik salonunun herkes için kullanılabilir kalması için bazı kurallar geçerlidir. Talepte bulunarak bunları kabul etmiş olursunuz.',
    toc: ['Salon', 'Rezervasyon nasıl işler', 'Kutlamalar', 'Hazırlık süreleri', 'Ücretler', 'Anahtar, teslim, iade', 'Kullanım kuralları', 'İptal ve değişiklikler', 'Gizlilik'],
    capacity: `en fazla ${v.capacity} kişi`, capacitySub: 'izin verilen üst sınır', party: 'hafta sonu başına 1 kutlama', partySub: `Cuma ${v.fromH}:00 – Pazartesi ${v.untilH}:00`,
    latest: `Kutlamalar en geç ${v.latest}`, latestSub: 'sonra toplama', lead: `${v.lead} gün önceden`, leadSub: 'kutlamalar için',
    fixed: 'Rezervasyon yapılamayan sabit zamanlar', onlyParties: ' (yalnızca kutlamalar)', equipment: 'Donanım:', equipmentTail: 'İhtiyacınız olanı talepte belirtebilirsiniz.',
    steps: [
      <>Kullanımı önceden <b>Michael Grieswelle</b> veya <b>Sigrid Brodig</b> ile görüşün. Bu görüşme olmadan rezervasyon geçersizdir.</>,
      <>Talebi çevrimiçi yapın ve e-postamızdaki bağlantıyla e-posta adresinizi onaylayın. Onaylanmayan talepler 24 saat sonra geçersiz olur.</>,
      <>Organizasyon ekibi talebi inceler ve e-posta ile dönüş yapar. Kulüp üyelerinin toplantıları doğrudan kaydedilir.</>,
      <>Takvim kaydıyla birlikte bir onay ve üç gün ile bir gün önce hatırlatmalar alırsınız.</>,
    ],
    partiesText: `Gençlik salonunda hafta sonu başına en fazla bir kutlama yapılır. Bu, salonu ve komşuları korur.${v.whole ? ' Kutlama olan bir hafta sonunda salon diğer rezervasyonlara da kapalıdır.' : ' Aynı hafta sonunda diğer rezervasyonlar yine de mümkündür.'} Lütfen kutlamaları en az ${v.lead} gün önceden talep edin. Kutlamalar en geç saat ${v.latest}’da biter; dışarıda saat 22.00’den itibaren sessizlik geçerlidir.`,
    bufferText: 'Her rezervasyondan önce ve sonra hazırlık ve toplama için zaman ayrılır. İki rezervasyon art arda ise iki süreden uzun olanı geçerlidir.',
    kind: 'Tür', before: 'önce', after: 'sonra', min: 'dk.',
    feeHead: ['', 'Kullanım ücreti', 'Depozito'], feeRows: ['Kulüp üyesi değil', 'Üyeler, özel kutlama', 'Kulüp etkinlikleri'], free: 'ücretsiz',
    noFees: 'Kulüp etkinlikleri ücretsizdir. Özel kutlamalar için kullanım ücreti veya depozito olup olmadığı ön görüşmede konuşulur.',
    depositText: 'Depozito anahtar tesliminde ödenir ve kontrolden sonra iade edilir. Hasar veya eksik temizlik durumunda tamamen ya da kısmen alıkonulabilir.',
    cancelText: 'Onay e-postanızdaki bağlantıyla istediğiniz zaman kendiniz iptal edebilirsiniz. Başkalarının kullanabilmesi için lütfen mümkün olduğunca erken iptal edin. Tarih veya saat değişiklikleri için iletişim kişinize başvurun. Organizasyon ekibi rezervasyonları kaydırabilir; bu durumda e-posta ile bilgilendirilirsiniz.',
    privacy: (op: { name: string; address: string; email: string }) => [
      <><b>Veri sorumlusu:</b> {op.name ? `${op.name}, ${op.address.replace(/\n/g, ', ')}, e-posta ${op.email}` : 'künyede belirtilen işletmeci'}.</>,
      <><b>Hangi veriler ve neden:</b> ad, e-posta, telefon, takım, tarih, etkinlik ve mesajınız. Bunları yalnızca talebi işlemek, sizi bilgilendirmek ve tarihi hatırlatmak için kullanırız (GVKY/DSGVO md. 6/1-b). Yalnızca gençlik salonunu yöneten kişiler erişebilir.</>,
      <><b>Herkese açık takvim:</b> yalnızca bir zamanın dolu olduğu görünür, adınız veya etkinliğiniz asla görünmez.</>,
      <><b>Saklama süresi:</b> kişisel veriler tarihten 12 ay sonra otomatik olarak silinir. Onaylanmayan talepler 24 saat sonra geçersiz olur.</>,
      <><b>Hizmet sağlayıcılar:</b> site ve veritabanı AB’deki (Frankfurt am Main) sunucularda çalışır. E-posta göndermek için bir e-posta hizmeti kullanılır. İzleme veya reklam çerezi kullanılmaz; yalnızca yönetim girişi ile açık/koyu mod ve dil tercihiniz saklanır.</>,
      <><b>Haklarınız:</b> verilerinize erişim, düzeltme ve silme talep edebilir, işlemeye itiraz edebilirsiniz. Bunun için {op.email || 'işletmeciye'} başvurun. Ayrıca bir veri koruma denetim makamına şikâyette bulunabilirsiniz; Kuzey Ren-Vestfalya’da bu LDI NRW’dir.</>,
    ],
    note: 'Not: Örnek metindir; Almanca sürüm esastır.',
  };
  return {
    title: 'Raum & Regeln', kicker: 'Jugendraum des SV Heepen', intro: 'Damit der Jugendraum für alle gut nutzbar bleibt, gelten ein paar Regeln. Mit deiner Anfrage erkennst du sie an.',
    toc: ['Der Raum', 'So läuft eine Buchung', 'Feiern', 'Vorbereitungszeiten', 'Kosten', 'Schlüssel, Übergabe, Rückgabe', 'Hausordnung', 'Absagen und Änderungen', 'Datenschutz'],
    capacity: `bis ${v.capacity} Personen`, capacitySub: 'zugelassene Höchstzahl', party: '1 Feier pro Wochenende', partySub: `Fr ${v.fromH}:00 bis Mo ${v.untilH}:00`,
    latest: `Feiern bis ${v.latest} Uhr`, latestSub: 'danach Aufräumen', lead: `${v.lead} Tage Vorlauf`, leadSub: 'für Feiern',
    fixed: 'Feste Zeiten, in denen nicht gebucht werden kann', onlyParties: ' (nur Feiern)', equipment: 'Ausstattung:', equipmentTail: 'Was du brauchst, kannst du bei der Anfrage angeben.',
    steps: [
      <>Sprich die Nutzung vorher mit <b>Michael Grieswelle</b> oder <b>Sigrid Brodig</b> ab. Ohne diese Absprache ist eine Buchung ungültig.</>,
      <>Stell die Anfrage online und bestätige deine E-Mail-Adresse über den Link in unserer Mail. Unbestätigte Anfragen verfallen nach 24 Stunden.</>,
      <>Das Orga-Team prüft die Anfrage und meldet sich per Mail. Besprechungen und Mannschaftssitzungen von Mitgliedern werden direkt eingetragen.</>,
      <>Du bekommst eine Bestätigung mit Kalendereintrag sowie Erinnerungen drei Tage und einen Tag vorher.</>,
    ],
    partiesText: `Pro Wochenende findet höchstens eine Feier im Jugendraum statt. Das schont Raum und Nachbarschaft.${v.whole ? ' An einem Wochenende mit Feier ist der Raum auch für andere Termine gesperrt.' : ' Andere Termine sind am selben Wochenende weiterhin möglich.'} Feiern bitte mindestens ${v.lead} Tage vorher anfragen. Sie enden spätestens um ${v.latest} Uhr, ab 22 Uhr gilt draußen Nachtruhe.`,
    bufferText: 'Vor und nach jedem Termin bleibt Zeit für Auf- und Abbau. Liegen zwei Termine hintereinander, gilt die längere der beiden Zeiten.',
    kind: 'Art', before: 'vorher', after: 'nachher', min: 'Min.',
    feeHead: ['', 'Nutzungsentgelt', 'Kaution'], feeRows: ['Nicht im Verein', 'Mitglieder, private Feier', 'Vereinstermine'], free: 'kostenfrei',
    noFees: 'Vereinstermine sind kostenfrei. Ob für private Feiern ein Nutzungsentgelt oder eine Kaution anfällt, klärst du bei der Absprache.',
    depositText: 'Die Kaution wird bei der Schlüsselübergabe fällig und nach der Abnahme erstattet. Für Schäden oder fehlende Reinigung kann sie ganz oder teilweise einbehalten werden.',
    cancelText: 'Absagen kannst du jederzeit selbst über den Link in deiner Bestätigungsmail. Bitte sag so früh wie möglich ab, damit andere den Termin nutzen können. Für Änderungen an Datum oder Uhrzeit melde dich bei deiner Ansprechperson. Das Orga-Team kann Termine verschieben, du wirst dann per Mail informiert.',
    privacy: (op: { name: string; address: string; email: string }) => [
      <><b>Verantwortlich</b> für die Verarbeitung deiner Daten ist {op.name ? `${op.name}, ${op.address.replace(/\n/g, ', ')}, E-Mail ${op.email}` : 'der im Impressum genannte Betreiber'}.</>,
      <><b>Welche Daten und wofür:</b> Name, E-Mail, Telefon, Mannschaft, Termin, Anlass und deine Nachricht. Wir nutzen sie nur, um die Anfrage zu bearbeiten, dich zu informieren und an den Termin zu erinnern (Art. 6 Abs. 1 lit. b DSGVO). Zugriff haben nur die Personen, die den Jugendraum verwalten.</>,
      <><b>Öffentlicher Kalender:</b> Dort steht nur, dass ein Zeitraum belegt ist, nie dein Name oder Anlass.</>,
      <><b>Speicherdauer:</b> Personenbezogene Angaben werden 12 Monate nach dem Termin automatisch gelöscht. Unbestätigte Anfragen verfallen nach 24 Stunden.</>,
      <><b>Dienstleister:</b> Die Seite und die Datenbank laufen bei Hosting-Anbietern mit Servern in der EU (Frankfurt am Main). Für den Versand von E-Mails wird ein E-Mail-Dienst genutzt. Es werden keine Tracking- oder Werbe-Cookies gesetzt; gespeichert werden nur die Anmeldung der Verwaltung sowie deine Wahl von Darstellung und Sprache.</>,
      <><b>Deine Rechte:</b> Du kannst Auskunft, Berichtigung und Löschung deiner Daten verlangen sowie der Verarbeitung widersprechen. Wende dich dafür an {op.email || 'den Betreiber'}. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren, in NRW bei der LDI NRW.</>,
    ],
    note: 'Hinweis: Mustertext, bitte vor der Veröffentlichung prüfen lassen.',
  };
}
