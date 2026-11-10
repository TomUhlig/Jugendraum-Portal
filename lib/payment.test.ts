import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { epcPayload, formatIban, isValidIban, paypalLink, stripeForm, verifyStripeSignature } from './payment';

describe('Bezahlung', () => {
  it('prüft IBANs', () => {
    expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true);
    expect(isValidIban('DE89370400440532013001')).toBe(false);
    expect(isValidIban('DE8937040044053201300')).toBe(false);
    expect(formatIban('de89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00');
  });
  it('baut den GiroCode-Inhalt nach EPC-Standard', () => {
    expect(epcPayload({ holder: 'SV Heepen e. V.', iban: 'DE89 3704 0044 0532 0130 00', amount: 150, text: 'JR-2026-0042 Kaution' }))
      .toBe('BCD\n002\n1\nSCT\n\nSV Heepen e. V.\nDE89370400440532013000\nEUR150.00\n\n\nJR-2026-0042 Kaution\n');
  });
  it('baut PayPal.me-Links', () => {
    expect(paypalLink('svheepen', 50)).toBe('https://paypal.me/svheepen/50EUR');
    expect(paypalLink('https://www.paypal.me/svheepen', 12.5)).toBe('https://paypal.me/svheepen/12.50EUR');
  });
  it('prüft Stripe-Signaturen', () => {
    const body = '{"id":"evt_1"}', secret = 'whsec_test', t = 1_700_000_000;
    const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
    expect(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, t * 1000)).toBe(true);
    expect(verifyStripeSignature(body + ' ', `t=${t},v1=${sig}`, secret, t * 1000)).toBe(false);
    expect(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, (t + 600) * 1000)).toBe(false);
  });
  it('kodiert verschachtelte Felder für Stripe', () => {
    expect(stripeForm({ mode: 'payment', line_items: { 0: { quantity: 1, price_data: { currency: 'eur', unit_amount: 5000 } } } }))
      .toBe('mode=payment&line_items%5B0%5D%5Bquantity%5D=1&line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=eur&line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=5000');
  });
});
