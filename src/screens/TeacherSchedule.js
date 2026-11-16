import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  addMinutesToTime,
  getEffectiveNow,
  getLocalDateKey,
  isValidTime,
} from '../utils/attendanceSchedule.cjs';
import {
  clearTestAttendanceForDate,
  getAttendanceSchedule,
  markAttendance,
  saveAttendanceSchedule,
  syncAutomaticAbsences,
} from '../utils/attendance';
import { getTestClock, saveTestClock } from '../utils/testClock';
import { STUDENTS } from '../students';

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function TeacherSchedule() {
  const [className, setClassName] = useState('');
  const [savedClassName, setSavedClassName] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [savedStartTime, setSavedStartTime] = useState('');
  const [testClock, setTestClock] = useState({ enabled: false, time: getCurrentTime() });
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingTestClock, setSavingTestClock] = useState(false);
  const [simulatingStudentId, setSimulatingStudentId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;

    Promise.all([getAttendanceSchedule(), getTestClock()])
      .then(([schedule, savedTestClock]) => {
        if (!active) return;
        if (schedule?.startTime) {
          setStartTime(schedule.startTime);
          setSavedStartTime(schedule.startTime);
        }
        if (typeof schedule?.className === 'string') {
          setClassName(schedule.className);
          setSavedClassName(schedule.className);
        }
        setTestClock(savedTestClock);
      })
      .catch((loadError) => {
        if (active) setError(`Could not load schedule settings: ${loadError.message}`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const updateTestClock = async (nextClock) => {
    setSavingTestClock(true);
    setError('');
    setNotice('');
    try {
      await saveTestClock(nextClock);
      setTestClock(nextClock);

      if (savedStartTime) {
        const now = getEffectiveNow(nextClock);
        await syncAutomaticAbsences(
          getLocalDateKey(now),
          savedStartTime,
          now,
          nextClock.enabled
        );
      }

      setNotice(
        nextClock.enabled
          ? 'Test clock enabled. Simulated attendance is stored separately from real records.'
          : 'Test clock disabled. New scans will use real time and real attendance records.'
      );
    } catch (saveError) {
      setError(`Could not update the test clock: ${saveError.message}`);
    } finally {
      setSavingTestClock(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!className.trim()) {
      setError('Enter a class name.');
      setNotice('');
      return;
    }

    if (!isValidTime(startTime)) {
      setError('Enter the daily class start time in 24-hour HH:MM format.');
      setNotice('');
      return;
    }

    setSavingSchedule(true);
    setError('');
    setNotice('');
    try {
      const trimmedClassName = className.trim();
      await saveAttendanceSchedule(startTime, trimmedClassName);
      setClassName(trimmedClassName);
      setSavedClassName(trimmedClassName);
      setSavedStartTime(startTime);
      const now = getEffectiveNow(testClock);
      await syncAutomaticAbsences(
        getLocalDateKey(now),
        startTime,
        now,
        testClock.enabled
      );
      setNotice(`Schedule saved for ${trimmedClassName} at ${startTime}.`);
    } catch (saveError) {
      setError(`Could not save the schedule: ${saveError.message}`);
    } finally {
      setSavingSchedule(false);
    }
  };

  const adjustTestTime = (minutes) => {
    updateTestClock({
      ...testClock,
      enabled: true,
      time: addMinutesToTime(testClock.time, minutes),
    });
  };

  const resetTestTime = () => {
    updateTestClock({ ...testClock, enabled: true, time: getCurrentTime() });
  };

  const simulateCheckIn = async (student) => {
    if (!savedStartTime || !testClock.enabled) return;

    setSimulatingStudentId(student.id);
    setError('');
    setNotice('');
    try {
      const now = getEffectiveNow(testClock);
      const date = getLocalDateKey(now);
      await syncAutomaticAbsences(date, savedStartTime, now, true);
      const result = await markAttendance(
        student.id,
        student.name,
        date,
        savedStartTime,
        now,
        true
      );
      setNotice(
        result.created
          ? `${student.name} simulated as ${result.status}.`
          : `${student.name} is already recorded as ${result.status} in test records.`
      );
    } catch (checkInError) {
      setError(`Could not simulate check-in: ${checkInError.message}`);
    } finally {
      setSimulatingStudentId('');
    }
  };

  const confirmClearTestRecords = () => {
    Alert.alert(
      'Clear today’s test records?',
      'This only removes simulated records. Real attendance is not changed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear test records',
          style: 'destructive',
          onPress: async () => {
            try {
              const now = getEffectiveNow(testClock);
              const removed = await clearTestAttendanceForDate(getLocalDateKey(now));
              setNotice(`${removed} test record${removed === 1 ? '' : 's'} cleared.`);
              setError('');
            } catch (clearError) {
              setError(`Could not clear test records: ${clearError.message}`);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1A56DB" />
        <Text>Loading schedule settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Daily Class Schedule</Text>
      <Text style={styles.description}>
        This shared start time applies to all students every day.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Class name</Text>
        <TextInput
          accessibilityLabel="Class name"
          style={styles.input}
          value={className}
          onChangeText={setClassName}
          placeholder="e.g. Mathematics 101"
          maxLength={60}
          autoCapitalize="words"
        />
        <Text style={styles.label}>Class start time (24-hour HH:MM)</Text>
        <TextInput
          accessibilityLabel="Daily class start time"
          style={styles.input}
          value={startTime}
          onChangeText={setStartTime}
          placeholder="08:00"
          maxLength={5}
          autoCapitalize="none"
        />
        <Text style={styles.helper}>
          On time: Present. After start through 15 minutes: Late. More than 15 minutes late:
          Absent.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.primaryButton, savingSchedule && styles.disabledButton]}
          onPress={handleSaveSchedule}
          disabled={savingSchedule}
        >
          <Text style={styles.primaryButtonText}>
            {savingSchedule ? 'Saving...' : 'Save Daily Schedule'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.savedText}>
          {savedStartTime
            ? savedClassName
              ? `Saved schedule: ${savedClassName} · ${savedStartTime}`
              : `Saved start time: ${savedStartTime}. Add a class name and save to complete the schedule.`
            : 'No schedule saved yet. Save a class name and start time to enable attendance timing.'}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.sectionTitle}>Test clock</Text>
            <Text style={styles.helper}>
              Test scans and automatic absences are saved separately from real attendance.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Enable test clock"
            value={testClock.enabled}
            onValueChange={(enabled) => updateTestClock({ ...testClock, enabled })}
            disabled={savingTestClock}
          />
        </View>

        {testClock.enabled && (
          <View style={styles.testControls}>
            <Text style={styles.label}>Simulated local time (HH:MM)</Text>
            <TextInput
              accessibilityLabel="Simulated time"
              style={styles.input}
              value={testClock.time}
              onChangeText={(time) => setTestClock({ ...testClock, time })}
              onEndEditing={() => {
                if (isValidTime(testClock.time)) {
                  updateTestClock(testClock);
                } else {
                  setError('Enter a valid simulated time in 24-hour HH:MM format.');
                }
              }}
              placeholder="08:00"
              maxLength={5}
              autoCapitalize="none"
            />
            <View style={styles.buttonRow}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={() => adjustTestTime(-5)}
                disabled={savingTestClock}
              >
                <Text style={styles.secondaryButtonText}>−5 min</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={() => adjustTestTime(5)}
                disabled={savingTestClock}
              >
                <Text style={styles.secondaryButtonText}>+5 min</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={resetTestTime}
                disabled={savingTestClock}
              >
                <Text style={styles.secondaryButtonText}>Use current time</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helper}>
              Simulated time: {getEffectiveNow(testClock).toLocaleTimeString()}. Turn test mode
              off before recording real attendance.
            </Text>
            <Text style={styles.label}>Test student arrival at this time</Text>
            {STUDENTS.map((student) => (
              <View key={student.id} style={styles.studentRow}>
                <Text style={styles.studentName}>{student.name}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.secondaryButton,
                    (!savedStartTime || savingTestClock || simulatingStudentId !== '') &&
                      styles.disabledButton,
                  ]}
                  onPress={() => simulateCheckIn(student)}
                  disabled={!savedStartTime || savingTestClock || simulatingStudentId !== ''}
                >
                  <Text style={styles.secondaryButtonText}>
                    {simulatingStudentId === student.id ? 'Saving...' : 'Simulate check-in'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.clearButton}
              onPress={confirmClearTestRecords}
            >
              <Text style={styles.clearButtonText}>Clear today’s test records</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#f5f5f5', gap: 16 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  title: { color: '#222', fontSize: 24, fontWeight: 'bold' },
  description: { color: '#666', fontSize: 15 },
  card: { padding: 18, borderRadius: 14, backgroundColor: '#fff', gap: 12, elevation: 2 },
  label: { color: '#333', fontSize: 15, fontWeight: '600' },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ccd2dc',
    borderRadius: 8,
    color: '#222',
    fontSize: 18,
  },
  helper: { color: '#666', lineHeight: 21 },
  primaryButton: { padding: 14, borderRadius: 8, alignItems: 'center', backgroundColor: '#1A56DB' },
  disabledButton: { opacity: 0.6 },
  primaryButtonText: { color: '#fff', fontWeight: 'bold' },
  savedText: { color: '#555', fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchCopy: { flex: 1, gap: 4 },
  sectionTitle: { color: '#222', fontSize: 18, fontWeight: 'bold' },
  testControls: { gap: 12, paddingTop: 12 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
  },
  studentName: { flex: 1, color: '#333' },
  secondaryButton: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#e8eefc' },
  secondaryButtonText: { color: '#1A56DB', fontWeight: '600' },
  clearButton: { alignItems: 'center', padding: 10 },
  clearButtonText: { color: '#b42318', fontWeight: '600' },
  error: { color: '#b42318', lineHeight: 21 },
  notice: { color: '#137333', lineHeight: 21 },
});
