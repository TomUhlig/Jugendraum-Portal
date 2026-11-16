/** Telefonnummer für wa.me: nur deutsche Handynummern (015x, 016x, 017x), Ländervorwahl ohne +. */
export function waNumber(phone: string): string | null {
  let d = phone.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '49' + d.slice(1);
  return d.length >= 11 && d.length <= 14 && /^491[5-7]/.test(d) ? d : null;
}
/** Für tel:-Links nur Ziffern und führendes Plus. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
