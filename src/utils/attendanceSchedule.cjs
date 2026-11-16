const GRACE_PERIOD_MINUTES = 15;
const GRACE_PERIOD_MS = GRACE_PERIOD_MINUTES * 60 * 1000;

function isValidTime(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return false;
  }
  return true;
}

function getScheduledStart(date, time) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !isValidTime(time)) {
    throw new Error('Use a valid date and a start time in HH:MM format.');
  }

  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const scheduledStart = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (
    scheduledStart.getFullYear() !== year ||
    scheduledStart.getMonth() !== month - 1 ||
    scheduledStart.getDate() !== day
  ) {
    throw new Error('The schedule date is invalid.');
  }

  return scheduledStart;
}

function getAttendanceStatus(arrivedAt, scheduledStart) {
  const difference = arrivedAt.getTime() - scheduledStart.getTime();
  if (difference <= 0) return 'Present';
  if (difference <= GRACE_PERIOD_MS) return 'Late';
  return 'Absent';
}

function hasPassedAbsenceCutoff(now, scheduledStart) {
  return now.getTime() > scheduledStart.getTime() + GRACE_PERIOD_MS;
}

function getLocalDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getEffectiveNow(testClock, actualNow = new Date()) {
  if (!testClock?.enabled) return actualNow;
  if (!isValidTime(testClock.time)) {
    throw new Error('The test clock time is invalid. Use HH:MM format.');
  }

  const [hours, minutes] = testClock.time.split(':').map(Number);
  const simulatedNow = new Date(actualNow);
  simulatedNow.setHours(hours, minutes, 0, 0);
  return simulatedNow;
}

function addMinutesToTime(time, minutesToAdd) {
  if (!isValidTime(time)) throw new Error('Use a valid time in HH:MM format.');
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = (hours * 60 + minutes + minutesToAdd + 1440) % 1440;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

module.exports = {
  GRACE_PERIOD_MINUTES,
  addMinutesToTime,
  getAttendanceStatus,
  getEffectiveNow,
  getLocalDateKey,
  getScheduledStart,
  hasPassedAbsenceCutoff,
  isValidTime,
};
