import assert from 'node:assert/strict';
import { calculate, clock } from './time.mjs';
const base = {
  start: '10:00',
  lunch: '12:30',
  back: '13:30',
  end: '17:00',
  target: 360,
  pause: 60,
};
assert.equal(calculate(base).worked, 360);
assert.equal(clock(calculate(base).returnAt), '13:30');
assert.equal(clock(calculate(base).exitAt), '17:00');
assert.equal(calculate({ ...base, end: '17:45' }).worked - 360, 45);
assert.equal(calculate({ ...base, end: '16:30' }).worked - 360, -30);
assert.equal(
  clock(calculate({ ...base, back: '14:00', end: '' }).exitAt),
  '17:30',
);
assert.equal(calculate({ ...base, end: '' }).worked, null);
assert.ok(calculate({ ...base, back: '', end: '17:00' }).error);
assert.ok(calculate({ ...base, back: '12:00' }).error);
assert.equal(
  calculate({ ...base, lunch: '', back: '', end: '16:00' }).worked,
  360,
);
assert.ok(calculate({ ...base, target: 0 }).error);
console.log('11 verificações de cálculo passaram.');


