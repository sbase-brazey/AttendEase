import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidTime } from './attendanceSchedule.cjs';

const TEST_CLOCK_KEY = '@attendease/attendance-test-clock';

export async function getTestClock() {
  const value = await AsyncStorage.getItem(TEST_CLOCK_KEY);
  if (!value) {
    const now = new Date();
    return {
      enabled: false,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    };
  }

  const testClock = JSON.parse(value);
  if (typeof testClock.enabled !== 'boolean' || !isValidTime(testClock.time)) {
    throw new Error('Saved test clock settings are invalid. Reset the test clock and try again.');
  }
  return testClock;
}

export async function saveTestClock(testClock) {
  if (typeof testClock.enabled !== 'boolean' || !isValidTime(testClock.time)) {
    throw new Error('Use a valid test clock time in HH:MM format.');
  }
  await AsyncStorage.setItem(TEST_CLOCK_KEY, JSON.stringify(testClock));
}
