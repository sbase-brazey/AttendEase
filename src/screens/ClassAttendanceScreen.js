import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import StatusBadge from '../components/StatusBadge';
import {
  getAttendanceForSchedule,
  subscribeToScheduleAttendance,
} from '../utils/attendance';
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

export default function ClassAttendanceScreen({ route, navigation }) {
  const { scheduleId } = route.params;
  const [schedule, setSchedule] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [realtimeError, setRealtimeError] = useState('');
  const summary = useMemo(() => getSummary(records), [records]);

  useEffect(() => {
    let active = true;

    const loadRecords = async () => {
      try {
        const result = await getAttendanceForSchedule(scheduleId);
        if (active) {
          setSchedule(result.schedule);
          setRecords(result.records);
          setError('');
        }
      } catch (loadError) {
        if (active) setError(`Could not load this subject’s attendance: ${loadError.message}`);
      } finally {
        if (active) setLoading(false);
      }
    };

    const unsubscribeRealtime = subscribeToScheduleAttendance(scheduleId, loadRecords, (message) => {
      if (active) setRealtimeError(message);
    });
    const unsubscribeFocus = navigation.addListener('focus', loadRecords);
    loadRecords();

    return () => {
      active = false;
      unsubscribeRealtime();
      unsubscribeFocus();
    };
  }, [navigation, scheduleId]);

  const header = (
    <View style={styles.headerContent}>
      <Text style={styles.eyebrow}>SUBJECT ATTENDANCE</Text>
      <Text style={styles.title}>{schedule?.class_name || 'Attendance records'}</Text>
      {schedule ? (
        <Text style={styles.subtitle}>
          {schedule.class_date} · Starts{' '}
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
      ) : null}
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.scanButton}
        onPress={() =>
          navigation.navigate('Scanner', {
            profile: route.params.profile,
            scheduleId,
          })
        }
      >
        <Text style={styles.scanButtonText}>Scan student for this subject</Text>
      </TouchableOpacity>

      <View style={styles.summaryRow}>
        <SummaryItem count={summary.present} label="Present" tone="present" />
        <SummaryItem count={summary.late} label="Late" tone="late" />
        <SummaryItem count={summary.absent} label="Absent" tone="absent" />
      </View>

      {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {realtimeError ? (
        <Text accessibilityRole="alert" style={styles.realtimeWarning}>
          Live updates paused: {realtimeError}
        </Text>
      ) : null}
      <Text style={styles.listHeading}>Students</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={records}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={styles.recordCard}>
            <View style={styles.studentAvatar}>
              <Text style={styles.avatarText}>
                {item.student?.full_name?.trim().charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <View style={styles.recordCopy}>
              <Text style={styles.studentName}>{item.student?.full_name || 'Student account'}</Text>
              <Text style={styles.studentNumber}>
                {item.student?.student_number || 'Student number unavailable'}
              </Text>
              <Text style={styles.recordTime}>
                {item.scanned_at
                  ? `Checked in ${new Date(item.scanned_at).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}`
                  : 'No check-in received'}
              </Text>
            </View>
            <StatusBadge status={item.status} />
          </View>
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No records yet</Text>
              <Text style={styles.emptyText}>
                Check-ins and absences for this subject will appear here.
              </Text>
            </View>
          )
        }
      />
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
  listContent: { flexGrow: 1, padding: 16, paddingBottom: 28 },
  headerContent: { gap: 12, paddingBottom: 14 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 12 },
  scanButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: colors.primary,
  },
  scanButtonText: { color: colors.surface, fontSize: 13, fontWeight: '700' },
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
  listHeading: { color: colors.text, fontSize: 15, fontWeight: '800' },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
    padding: 13,
    gap: 11,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#E8EEFA',
  },
  avatarText: { color: colors.primaryDark, fontSize: 16, fontWeight: '800' },
  recordCopy: { flex: 1, gap: 2 },
  studentName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  studentNumber: { color: colors.muted, fontSize: 11 },
  recordTime: { marginTop: 2, color: colors.muted, fontSize: 10 },
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
