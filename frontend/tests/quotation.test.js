import test from 'node:test';
import assert from 'node:assert/strict';
import { newQuotation, newItem, lineTotal, totals, signedCurrency, quoteValidityDate, updateQuotationField } from '../src/lib/quotation.js';
import { addDays } from '../src/lib/calendar.js';
import { amountInWords } from '../src/lib/amountInWords.js';

test('quotation amount in words uses Indian numbering', () => {
  assert.equal(amountInWords(0), 'Zero Rupees Only');
  assert.equal(amountInWords(1712), 'One Thousand Seven Hundred Twelve Rupees Only');
  assert.equal(amountInWords(12345678), 'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees Only');
  assert.equal(amountInWords(100.05), 'One Hundred Rupees and Five Paise Only');
});

test('discount precedes item tax and freight is added once', () => {
  const quote = newQuotation();
  quote.items = [{ ...newItem(), quantity: 2, price: 1000, discount: 10, tax: 18 }];
  quote.freightCharges = 100;
  assert.equal(lineTotal(quote.items[0]), 2124);
  const sum = totals(quote);
  assert.equal(sum.subtotal, 2000);
  assert.equal(sum.discount, 200);
  assert.equal(sum.taxable, 1800);
  assert.equal(sum.tax, 324);
  assert.equal(sum.freight, 100);
  assert.equal(sum.total, 2224);
});

test('mixed tax rates are rounded per item', () => {
  const quote = newQuotation();
  quote.items = [0, 0.1, 5, 12, 18].map(tax => ({ ...newItem(), price: 100, tax }));
  assert.equal(totals(quote).tax, 35.1);
  assert.equal(totals(quote).unroundedTotal, 535.1);
  assert.equal(totals(quote).roundOff, -.1);
  assert.equal(totals(quote).total, 535);
});

test('new quotations and addresses do not share mutable data', () => {
  const first = newQuotation();
  const second = newQuotation();
  first.billTo.name = 'Billing customer';
  first.items[0].name = 'Custom item';
  assert.equal(first.shipTo.name, '');
  assert.equal(second.billTo.name, '');
  assert.equal(second.items[0].name, '');
});

test('validity defaults to fifteen calendar days and follows quotation date changes', () => {
  const fresh = newQuotation();
  assert.equal(fresh.validity, addDays(fresh.date, 15));
  assert.equal(addDays('2026-11-05', 15), '2026-11-20');
  assert.equal(addDays('2026-12-25', 15), '2027-01-09');
  assert.equal(addDays('2024-02-20', 15), '2024-03-06');
  assert.equal(quoteValidityDate({date: '2026-11-05', validity: '30 days'}), '2026-11-20');
  const updated = updateQuotationField({date: '2026-11-05', validity: '2026-11-20'}, 'date', '2026-11-10');
  assert.equal(updated.validity, '2026-11-25');
  const custom = updateQuotationField(updated, 'validity', '2026-12-10');
  assert.equal(updateQuotationField(custom, 'date', '2026-11-15').validity, '2026-12-10');
});

test('Tamil Nadu splits selected rates; other states apply IGST at 18%', () => {
  const quote = newQuotation();
  quote.items = [{ ...newItem(), price: 1000, tax: 12 }];
  for (const state of ['Tamil Nadu', 'TN', ' tamil nadu ']) {
    quote.billTo.state = state;
    assert.equal(totals(quote).cgst, 60);
    assert.equal(totals(quote).sgst, 60);
    assert.equal(totals(quote).igst, 0);
    assert.deepEqual(totals(quote).taxBreakdown, [{ label: 'CGST @ 6%', amount: 60 }, { label: 'SGST @ 6%', amount: 60 }]);
  }
  quote.billTo.state = 'Karnataka';
  assert.equal(totals(quote).igst, 180);
  assert.equal(totals(quote).cgst, 0);
  assert.equal(totals(quote).sgst, 0);
  assert.equal(lineTotal(quote.items[0], quote.billTo.state), 1180);
  assert.deepEqual(totals(quote).taxBreakdown, [{ label: 'IGST @ 18%', amount: 180 }]);
  quote.billTo.state = 'Tamil Nadu';
  assert.equal(totals(quote).total, 1120);
});

test('CGST and SGST round separately and match the line total', () => {
  const quote = newQuotation();
  quote.billTo.state = 'Tamil Nadu';
  quote.items = [{ ...newItem(), price: 10, tax: .1 }];
  assert.equal(totals(quote).cgst, .01);
  assert.equal(totals(quote).sgst, .01);
  assert.equal(totals(quote).unroundedTotal, 10.02);
  assert.equal(totals(quote).roundOff, -.02);
  assert.equal(totals(quote).total, 10);
  assert.equal(lineTotal(quote.items[0], quote.billTo.state), 10.02);
});

test('grand total rounds to a rupee with a signed adjustment, including freight', () => {
  for (const [price, expected, adjustment] of [[.95, 1, .05], [1.24, 1, -.24], [1.5, 2, .5], [2, 2, 0], [0, 0, 0]]) {
    const quote = newQuotation();
    quote.items = [{ ...newItem(), price, tax: 0 }];
    const sum = totals(quote);
    assert.equal(sum.total, expected);
    assert.equal(sum.roundOff, adjustment);
    assert.equal(roundToPaise(sum.unroundedTotal + sum.roundOff), sum.total);
  }
  const quote = newQuotation();
  quote.items = [{ ...newItem(), price: 10, tax: 0 }];
  quote.freightCharges = .95;
  assert.equal(totals(quote).total, 11);
  assert.equal(totals(quote).roundOff, .05);
  assert.ok(signedCurrency(.05).startsWith('+'));
  assert.ok(signedCurrency(-.05).startsWith('−'));
  assert.equal(signedCurrency(0), signedCurrency(-0));
});

function roundToPaise(value) { return Math.round(value * 100) / 100; }
