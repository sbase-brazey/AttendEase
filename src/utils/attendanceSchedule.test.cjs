const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getAttendanceStatus,
  getScheduledStart,
  hasPassedAbsenceCutoff,
  isValidTime,
  isValidTimeRange,
} = require('./attendanceSchedule.cjs');

const start = getScheduledStart('2026-11-16', '08:00');
const end = getScheduledStart('2026-11-16', '09:00');

test('validates 24-hour schedule times', () => {
  assert.equal(isValidTime('08:00'), true);
  assert.equal(isValidTime('23:59'), true);
  assert.equal(isValidTime('24:00'), false);
  assert.equal(isValidTime('8:00'), false);
  assert.equal(isValidTimeRange('08:00', '09:00'), true);
  assert.equal(isValidTimeRange('09:00', '08:00'), false);
  assert.equal(isValidTimeRange('08:00', '08:00'), false);
});

test('marks arrival within the first 15 minutes as Present', () => {
  assert.equal(getAttendanceStatus(start, start), 'Present');
  assert.equal(getAttendanceStatus(new Date(start.getTime() + 1), start, end), 'Present');
  assert.equal(
    getAttendanceStatus(new Date(start.getTime() + 15 * 60 * 1000), start, end),
    'Present'
  );
});

test('marks arrival after the grace period but before class end Late', () => {
  const afterGrace = new Date(start.getTime() + 15 * 60 * 1000 + 1);
  assert.equal(getAttendanceStatus(afterGrace, start, end), 'Late');
  assert.equal(getAttendanceStatus(end, start, end), 'Late');
});

test('marks arrival after class end Absent and uses class end for automatic absences', () => {
  const afterEnd = new Date(end.getTime() + 1);
  assert.equal(getAttendanceStatus(afterEnd, start, end), 'Absent');
  assert.equal(hasPassedAbsenceCutoff(end, end), false);
  assert.equal(hasPassedAbsenceCutoff(afterEnd, end), true);
});
