import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Switch, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import {
  getAttendanceByDate,
  getAttendanceSchedule,
  syncAutomaticAbsences,
} from '../utils/attendance';
import { getEffectiveNow, getLocalDateKey } from '../utils/attendanceSchedule.cjs';
import { getTestClock } from '../utils/testClock';

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateKey(new Date()));
  const [records, setRecords] = useState([]);
  const [showTestRecords, setShowTestRecords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadRecords = async () => {
      setLoading(true);
      setError('');
      try {
        const [schedule, testClock] = await Promise.all([
          getAttendanceSchedule(),
          getTestClock(),
        ]);
        if (schedule?.startTime) {
          const now = getEffectiveNow(testClock);
          if (showTestRecords || !testClock.enabled) {
            await syncAutomaticAbsences(
              selectedDate,
              schedule.startTime,
              now,
              showTestRecords
            );
          }
        }

        const data = await getAttendanceByDate(selectedDate, showTestRecords);
        if (active) setRecords(data);
      } catch (loadError) {
        if (active) setError(`Could not load attendance records: ${loadError.message}`);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadRecords();
    return () => {
      active = false;
    };
  }, [selectedDate, showTestRecords]);

  return (
    <View style={styles.container}>
      <View style={styles.modeRow}>
        <Text style={styles.modeLabel}>
          {showTestRecords ? 'Showing isolated test records' : 'Showing real attendance'}
        </Text>
        <Switch
          accessibilityLabel="Show test attendance records"
          value={showTestRecords}
          onValueChange={setShowTestRecords}
        />
      </View>

      <Calendar
        current={selectedDate}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={{ [selectedDate]: { selected: true, selectedColor: '#1A56DB' } }}
      />

      <Text style={styles.header}>Records for {selectedDate}</Text>
      <View style={styles.legend}>
        <Text style={styles.present}>Present</Text>
        <Text style={styles.late}>Late</Text>
        <Text style={styles.absent}>Absent</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loading} size="large" color="#1A56DB" />
      ) : error ? (
        <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.studentId}
          renderItem={({ item }) => {
            const statusStyle =
              item.status === 'Present'
                ? styles.present
                : item.status === 'Late'
                  ? styles.late
                  : styles.absent;
            return (
              <View style={styles.recordItem}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={[styles.status, statusStyle]}>
                  {item.status}{item.timeIn ? ` at ${item.timeIn}` : ''}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No attendance records for this date yet.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#fff' },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  modeLabel: { color: '#555', fontSize: 14 },
  header: { fontSize: 18, fontWeight: 'bold', marginVertical: 12, textAlign: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginBottom: 8 },
  recordItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: { color: '#222', fontWeight: 'bold' },
  status: { fontWeight: '600' },
  present: { color: '#137333' },
  late: { color: '#b06000' },
  absent: { color: '#b42318' },
  loading: { marginTop: 24 },
  empty: { color: '#666', textAlign: 'center', marginTop: 20 },
  error: { color: '#b42318', textAlign: 'center', marginTop: 20 },
});
