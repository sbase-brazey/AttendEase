const GRACE_PERIOD_MINUTES = 15;
const GRACE_PERIOD_MS = GRACE_PERIOD_MINUTES * 60 * 1000;

function isValidTime(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return false;
  }
  return true;
}

function isValidTimeRange(startTime, endTime) {
  if (!isValidTime(startTime) || !isValidTime(endTime)) return false;
  return endTime > startTime;
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

function getAttendanceStatus(arrivedAt, scheduledStart, scheduledEnd) {
  const difference = arrivedAt.getTime() - scheduledStart.getTime();
  if (difference <= GRACE_PERIOD_MS) return 'Present';
  if (arrivedAt.getTime() <= scheduledEnd.getTime()) return 'Late';
  return 'Absent';
}

function hasPassedAbsenceCutoff(now, scheduledEnd) {
  return now.getTime() > scheduledEnd.getTime();
}

function getLocalDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

module.exports = {
  GRACE_PERIOD_MINUTES,
  getAttendanceStatus,
  getLocalDateKey,
  getScheduledStart,
  hasPassedAbsenceCutoff,
  isValidTime,
  isValidTimeRange,
};
