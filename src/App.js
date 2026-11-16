import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import TeacherSchedule from './screens/TeacherSchedule';
import LoginScreen from './screens/LoginScreen';
import TeacherDashboard from './screens/TeacherDashboard';
import QRScannerScreen from './screens/QRScannerScreen';
import CalendarScreen from './screens/CalendarScreen';
import StudentHome from './screens/StudentHome';
import {
  getEffectiveNow,
  getLocalDateKey,
  getScheduledStart,
  hasPassedAbsenceCutoff,
} from './utils/attendanceSchedule.cjs';
import { getAttendanceSchedule, syncAutomaticAbsences } from './utils/attendance';
import { getTestClock } from './utils/testClock';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    let interval;
    let appStateSubscription;
    let isSyncing = false;
    let lastProcessedSchedule = '';

    const processScheduledAbsences = async (reconcileScheduleChange = false) => {
      if (isSyncing) return;

      isSyncing = true;
      try {
        const [schedule, testClock] = await Promise.all([
          getAttendanceSchedule(),
          getTestClock(),
        ]);
        if (!schedule?.startTime) {
          lastProcessedSchedule = '';
          return;
        }

        const now = getEffectiveNow(testClock);
        const date = getLocalDateKey(now);
        const cutoffPassed = hasPassedAbsenceCutoff(
          now,
          getScheduledStart(date, schedule.startTime)
        );
        if (!reconcileScheduleChange && !cutoffPassed) return;

        const scheduleKey = [
          date,
          schedule.startTime,
          testClock.enabled,
          testClock.time,
          cutoffPassed,
        ].join('|');
        if (lastProcessedSchedule === scheduleKey) return;

        await syncAutomaticAbsences(date, schedule.startTime, now, testClock.enabled);
        lastProcessedSchedule = scheduleKey;
      } catch (error) {
        console.error('Unable to update scheduled absences:', error);
      } finally {
        isSyncing = false;
      }
    };

    void processScheduledAbsences(true);
    interval = setInterval(processScheduledAbsences, 15000);
    appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void processScheduledAbsences(true);
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TeacherDashboard" component={TeacherDashboard} options={{ title: 'Dashboard' }} />
        <Stack.Screen name="TeacherSchedule" component={TeacherSchedule} options={{ title: 'Class Schedule' }} />
        <Stack.Screen name="Scanner" component={QRScannerScreen} options={{ title: 'Scan Student' }} />
        <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Records' }} />
        <Stack.Screen name="StudentHome" component={StudentHome} options={{ title: 'My QR Code' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
