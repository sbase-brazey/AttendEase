import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAttendanceForDate, subscribeToDateAttendance } from '../utils/attendance';
import { getLocalDateKey } from '../utils/attendanceSchedule.cjs';
import { colors } from '../theme';

function getSummary(records) {
  return records.reduce(
    (summary, record) => {
      if (record.status === 'Present') summary.present += 1;
      if (record.status === 'Late') summary.late += 1;
      if (record.status === 'Absent') summary.absent += 1;
      return summary;
    },
    { present: 0, late: 0, absent: 0 }
  );
}

export default function CalendarScreen({ route, navigation }) {
  const profile = route.params?.profile;
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateKey(new Date()));
  const [schedules, setSchedules] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [realtimeError, setRealtimeError] = useState('');
  const summary = useMemo(() => getSummary(records), [records]);

  useEffect(() => {
    let active = true;

    const loadRecords = async () => {
      try {
        const result = await getAttendanceForDate(selectedDate);
        if (active) {
          setSchedules(result.schedules);
          setRecords(result.records);
          setError('');
        }
      } catch (loadError) {
        if (active) setError(`Could not load attendance records: ${loadError.message}`);
      } finally {
        if (active) setLoading(false);
      }
    };

    const unsubscribeRealtime = subscribeToDateAttendance(selectedDate, null, loadRecords, (message) => {
      if (active) setRealtimeError(message);
    });
    const unsubscribeFocus = navigation.addListener('focus', loadRecords);
    loadRecords();

    return () => {
      active = false;
      unsubscribeRealtime();
      unsubscribeFocus();
    };
  }, [navigation, selectedDate]);

  const openSubjectRecords = (scheduleId) => {
    navigation.navigate('ClassAttendance', { profile, scheduleId });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>TEACHER TOOLS</Text>
          <Text style={styles.title}>Attendance records</Text>
          <Text style={styles.subtitle}>Choose a date, then open a subject to see its students.</Text>
        </View>

        <View style={styles.calendarCard}>
          <Calendar
            current={selectedDate}
            onDayPress={(day) => {
              setLoading(true);
              setSelectedDate(day.dateString);
            }}
            markedDates={{
              [selectedDate]: { selected: true, selectedColor: colors.primary },
            }}
            theme={{
              todayTextColor: colors.primary,
              arrowColor: colors.primary,
              textSectionTitleColor: colors.muted,
              selectedDayTextColor: colors.surface,
              textDayFontWeight: '500',
              textMonthFontWeight: '700',
            }}
          />
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>{selectedDate}</Text>
            <Text style={styles.sectionSubtitle}>
              {schedules.length
                ? `${schedules.length} ${schedules.length === 1 ? 'subject' : 'subjects'} scheduled`
                : 'No subjects scheduled on this date'}
            </Text>
          </View>
          {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>

        <View style={styles.summaryRow}>
          <SummaryItem count={summary.present} label="Present" tone="present" />
          <SummaryItem count={summary.late} label="Late" tone="late" />
          <SummaryItem count={summary.absent} label="Absent" tone="absent" />
        </View>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {realtimeError ? (
          <Text accessibilityRole="alert" style={styles.realtimeWarning}>
            Live updates paused: {realtimeError}
          </Text>
        ) : null}

        <Text style={styles.listHeading}>Subjects</Text>
        {!loading && schedules.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No subjects for this date</Text>
            <Text style={styles.emptyText}>Schedules and attendance records will appear here.</Text>
          </View>
        ) : null}
        <View style={styles.subjectList}>
          {schedules.map((schedule) => {
            const subjectRecords = records.filter((record) => record.schedule_id === schedule.id);
            const counts = getSummary(subjectRecords);
            return (
              <TouchableOpacity
                accessibilityRole="button"
                key={schedule.id}
                style={styles.subjectCard}
                onPress={() => openSubjectRecords(schedule.id)}
              >
                <View style={styles.subjectHeader}>
                  <View style={styles.subjectCopy}>
                    <Text style={styles.subjectName}>{schedule.class_name}</Text>
                    <Text style={styles.subjectTime}>
                      {new Date(schedule.starts_at).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {' – '}
                      {new Date(schedule.ends_at).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text style={styles.arrow}>›</Text>
                </View>
                <View style={styles.subjectStats}>
                  <Text style={[styles.subjectStat, { color: colors.present }]}>{counts.present} present</Text>
                  <Text style={[styles.subjectStat, { color: colors.late }]}>{counts.late} late</Text>
                  <Text style={[styles.subjectStat, { color: colors.absent }]}>{counts.absent} absent</Text>
                </View>
                <Text style={styles.recordHint}>
                  {subjectRecords.length} attendance {subjectRecords.length === 1 ? 'record' : 'records'} · View students
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryItem({ count, label, tone }) {
  const color =
    tone === 'present' ? colors.present : tone === 'late' ? colors.late : colors.absent;
  const background =
    tone === 'present'
      ? colors.presentBackground
      : tone === 'late'
        ? colors.lateBackground
        : colors.absentBackground;

  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryDot, { backgroundColor: color }]} />
      <Text style={[styles.summaryCount, { color }]}>{count}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={[styles.summaryTint, { backgroundColor: background }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: 16, paddingBottom: 28, gap: 14 },
  heading: { gap: 4, paddingHorizontal: 4, paddingTop: 4 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  calendarCard: {
    padding: 7,
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionCopy: { flex: 1, gap: 3 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  sectionSubtitle: { color: colors.muted, fontSize: 12 },
  summaryRow: { flexDirection: 'row', gap: 9 },
  summaryCard: {
    flex: 1,
    minHeight: 72,
    justifyContent: 'center',
    padding: 11,
    overflow: 'hidden',
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryDot: { width: 7, height: 7, marginBottom: 4, borderRadius: 4 },
  summaryCount: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  summaryTint: { position: 'absolute', top: -19, right: -17, width: 43, height: 43, borderRadius: 22, opacity: 0.6 },
  listHeading: { marginTop: 2, color: colors.text, fontSize: 15, fontWeight: '800' },
  subjectList: { gap: 9 },
  subjectCard: {
    padding: 14,
    gap: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subjectHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  subjectCopy: { flex: 1, gap: 3 },
  subjectName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  subjectTime: { color: colors.muted, fontSize: 11 },
  arrow: { color: colors.primary, fontSize: 26 },
  subjectStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  subjectStat: { fontSize: 11, fontWeight: '700' },
  recordHint: { color: colors.muted, fontSize: 11 },
  emptyCard: {
    alignItems: 'center',
    padding: 22,
    gap: 7,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  error: { color: colors.absent, fontSize: 12, lineHeight: 18 },
  realtimeWarning: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.lateBackground,
    color: colors.late,
    fontSize: 12,
    lineHeight: 18,
  },
});
