import React, { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CalendarScreen from './screens/CalendarScreen';
import ClassAttendanceScreen from './screens/ClassAttendanceScreen';
import LoginScreen from './screens/LoginScreen';
import QRScannerScreen from './screens/QRScannerScreen';
import StudentHome from './screens/StudentHome';
import TeacherDashboard from './screens/TeacherDashboard';
import TeacherSchedule from './screens/TeacherSchedule';
import { colors } from './theme';
import { getSupabaseClient } from './utils/supabase';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (error) {
      console.error('Supabase authentication is not configured:', error);
      return undefined;
    }

    if (Platform.OS === 'web') return undefined;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();

    return () => {
      subscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TeacherDashboard" component={TeacherDashboard} options={{ title: 'Overview' }} />
        <Stack.Screen name="TeacherSchedule" component={TeacherSchedule} options={{ title: 'Class schedule' }} />
        <Stack.Screen name="Scanner" component={QRScannerScreen} options={{ title: 'Scan attendance' }} />
        <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Attendance records' }} />
        <Stack.Screen name="ClassAttendance" component={ClassAttendanceScreen} options={{ title: 'Subject records' }} />
        <Stack.Screen name="StudentHome" component={StudentHome} options={{ title: 'My dashboard' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
