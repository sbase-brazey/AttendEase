const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addMinutesToTime,
  getAttendanceStatus,
  getEffectiveNow,
  getScheduledStart,
  hasPassedAbsenceCutoff,
  isValidTime,
} = require('./attendanceSchedule.cjs');

const start = getScheduledStart('2026-11-16', '08:00');

test('validates 24-hour schedule times', () => {
  assert.equal(isValidTime('08:00'), true);
  assert.equal(isValidTime('23:59'), true);
  assert.equal(isValidTime('24:00'), false);
  assert.equal(isValidTime('8:00'), false);
});

test('classifies on-time arrival as Present and arrivals through 15 minutes as Late', () => {
  assert.equal(getAttendanceStatus(new Date('2026-11-16T08:00:00'), start), 'Present');
  assert.equal(getAttendanceStatus(new Date('2026-11-16T08:01:00'), start), 'Late');
  assert.equal(getAttendanceStatus(new Date('2026-11-16T08:15:00'), start), 'Late');
});

test('classifies arrival after the 15-minute grace period as Absent', () => {
  assert.equal(getAttendanceStatus(new Date('2026-11-16T08:15:01'), start), 'Absent');
  assert.equal(hasPassedAbsenceCutoff(new Date('2026-11-16T08:15:00'), start), false);
  assert.equal(hasPassedAbsenceCutoff(new Date('2026-11-16T08:15:01'), start), true);
});

test('test clock overrides only the local time and adjusts across midnight', () => {
  const actualNow = new Date(2026, 10, 16, 9, 30);
  const testNow = getEffectiveNow({ enabled: true, time: '08:15' }, actualNow);
  assert.equal(testNow.getFullYear(), 2026);
  assert.equal(testNow.getMonth(), 10);
  assert.equal(testNow.getDate(), 16);
  assert.equal(testNow.getHours(), 8);
  assert.equal(testNow.getMinutes(), 15);
  assert.equal(addMinutesToTime('23:58', 5), '00:03');
});
