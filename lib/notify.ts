import 'server-only';
import { Booking, checkExisting, getCategories, notifyRecipients } from './data';
import { mails, teamMails } from './mail';

/** Mails dürfen eine bereits gespeicherte Aktion nie abbrechen: Fehler werden nur protokolliert. */
async function safe(label: string, fn: () => Promise<unknown>) {
  try { await fn(); } catch (e) { console.error(`Benachrichtigung „${label}“ fehlgeschlagen:`, e); }
}
const categoryOf = async (b: Booking) => (await getCategories()).find((c) => c.id === b.categoryId);

/** Nach der E-Mail-Bestätigung: Bucher und Orga-Team informieren. */
export async function afterVerified(b: Booking) {
  await safe('verified', async () => {
    const cat = await categoryOf(b);
    const team = await notifyRecipients();
    if (b.status === 'confirmed') {
      await mails.confirmed(b, cat);
      await teamMails.autoConfirmed(team, b, cat);
    } else {
      await mails.received(b, cat);
      const conflicts = (await checkExisting(b)).messages.map((m) => m.text).join(' ');
      await teamMails.newRequest(team, b, cat, conflicts || undefined);
    }
  });
}

export async function afterDecision(b: Booking) {
  await safe('decision', async () => {
    const cat = await categoryOf(b);
    if (b.status === 'confirmed') await mails.confirmed(b, cat);
    if (b.status === 'rejected') await mails.rejected(b, cat);
    if (b.status === 'cancelled') await mails.cancelled(b, cat);
  });
}

export async function afterBookerCancel(b: Booking) {
  await safe('booker-cancel', async () => {
    const cat = await categoryOf(b);
    await mails.cancelled(b, cat);
    await teamMails.cancelled(await notifyRecipients(), b, cat);
  });
}
