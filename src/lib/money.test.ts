/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, minorToInput, parseAmount } from './money.ts';

test('formatMoney uses Indian grouping for INR', () => {
  assert.equal(formatMoney(300000, 'INR'), '₹3,000');
  assert.equal(formatMoney(123456789, 'INR'), '₹12,34,567.89');
  assert.equal(formatMoney(3334, 'INR'), '₹33.34');
  assert.equal(formatMoney(-50, 'INR'), '-₹0.50');
  assert.equal(formatMoney(123456700, 'USD'), '$1,234,567');
});

test('parseAmount', () => {
  assert.equal(parseAmount('1,234.5'), 123450);
  assert.equal(parseAmount('3000'), 300000);
  assert.equal(parseAmount('.5'), 50);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('12.345'), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount(''), null);
});

test('minorToInput round-trips', () => {
  for (const v of [100, 123450, 3334, 50]) assert.equal(parseAmount(minorToInput(v)), v);
});
