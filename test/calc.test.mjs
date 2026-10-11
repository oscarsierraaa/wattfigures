/*
  Unit tests for the CSP-safe formula engine in assets/calc.js.
  calc.js runs an IIFE that, when no `document` exists (Node), exposes its
  internals on globalThis.__calc instead of booting the DOM.
  Run: node --test
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(path.join(here, '..', 'assets', 'calc.js')).href);
const { tokenize, toRpn, evalRpn } = globalThis.__calc;

// Compile + evaluate a formula string with a variable map.
function calc(src, vars = {}) {
  return evalRpn(toRpn(tokenize(src)), vars);
}

test('basic arithmetic and precedence', () => {
  assert.equal(calc('2+3*4'), 14);
  assert.equal(calc('(2+3)*4'), 20);
  assert.equal(calc('2^3^2'), 512);        // right-associative
  assert.equal(calc('10%3'), 1);
});

test('unary minus', () => {
  assert.equal(calc('-5+2'), -3);
  assert.equal(calc('3*-2'), -6);
  assert.equal(calc('-(2+3)'), -5);
});

test('variables resolve from the map', () => {
  assert.equal(calc('watts/1000*hours*price', { watts: 1000, hours: 3, price: 0.17 }), 0.51);
});

test('EU comma decimals are an input concern, dot in formulas', () => {
  // formula literals use dots; the widget converts input commas before eval
  assert.equal(calc('x*1.5', { x: 2 }), 3);
});

test('whitelisted functions', () => {
  assert.equal(calc('min(3,5)'), 3);
  assert.equal(calc('max(3,5)'), 5);
  assert.equal(calc('abs(-7)'), 7);
  assert.equal(calc('floor(3.9)'), 3);
  assert.equal(calc('ceil(3.1)'), 4);
  assert.equal(calc('round(3.14159,2)'), 3.14);
  assert.equal(calc('sqrt(16)'), 4);
});

test('nested functions and expressions as arguments', () => {
  assert.equal(calc('max(0, a-b)', { a: 3, b: 10 }), 0);   // savings floored at 0
  assert.equal(calc('round(min(a,b)/2, 1)', { a: 7, b: 4 }), 2);
});

test('invalid input yields NaN, never throws', () => {
  assert.ok(Number.isNaN(calc('1/0')));                 // div by zero
  assert.ok(Number.isNaN(calc('5%0')));                 // mod by zero
  assert.ok(Number.isNaN(calc('unknownvar')));          // missing variable
  assert.ok(Number.isNaN(calc('nope(2)')));             // unknown function → tokenize null
  assert.ok(Number.isNaN(calc('2+')));                  // dangling operator
  assert.ok(Number.isNaN(calc('(2+3')));                // unbalanced parens
  assert.ok(Number.isNaN(calc('2,3')));                 // comma outside a function
  assert.ok(Number.isNaN(calc('min(3)')));             // arity mismatch
});

test('tokenize rejects unknown characters', () => {
  assert.equal(tokenize('2 & 3'), null);
});
