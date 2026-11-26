import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAttendanceForDate, subscribeToTeacherAttendance } from '../utils/attendance';
import { getLocalDateKey } from '../utils/attendanceSchedule.cjs';
import { getSupabaseClient } from '../utils/supabase';
import { colors } from '../theme';

function getCounts(records) {
  return records.reduce(
    (counts, record) => {
      if (record.status === 'Present') counts.present += 1;
      if (record.status === 'Late') counts.late += 1;
      if (record.status === 'Absent') counts.absent += 1;
      return counts;
    },
    { present: 0, late: 0, absent: 0 }
  );
}

export default function TeacherDashboard({ route, navigation }) {
  const { profile } = route.params;
  const [schedules, setSchedules] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [realtimeError, setRealtimeError] = useState('');
  const date = getLocalDateKey(new Date());
  const counts = useMemo(() => getCounts(records), [records]);

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      try {
        const result = await getAttendanceForDate(date);
        if (active) {
          setSchedules(result.schedules);
          setRecords(result.records);
          setError('');
        }
      } catch (loadError) {
        if (active) setError(`Could not load today’s attendance: ${loadError.message}`);
      } finally {
        if (active) setLoading(false);
      }
    };

    const unsubscribe = subscribeToTeacherAttendance(date, null, loadOverview, (message) => {
      if (active) setRealtimeError(message);
    });
    const unsubscribeFocus = navigation.addListener('focus', loadOverview);
    loadOverview();

    return () => {
      active = false;
      unsubscribe();
      unsubscribeFocus();
    };
  }, [date, navigation]);

  const navigateWithProfile = (screen, params = {}) => {
    navigation.navigate(screen, { profile, ...params });
  };

  const handleLogout = async () => {
    try {
      const { error: signOutError } = await getSupabaseClient().auth.signOut();
      if (signOutError) throw signOutError;
      navigation.replace('Login');
    } catch (logoutError) {
      setError(`Could not sign out: ${logoutError.message}`);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>ATTENDEASE · TEACHER</Text>
            <Text style={styles.title}>Good day, {profile.full_name.split(' ')[0]}</Text>
            <Text style={styles.subtitle}>{date} · Your live class overview</Text>
          </View>
          <TouchableOpacity style={styles.logout} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.classCard}>
          <Text style={styles.classEyebrow}>TODAY&apos;S SCHEDULE</Text>
          <Text style={styles.className}>
            {schedules.length
              ? `${schedules.length} ${schedules.length === 1 ? 'subject' : 'subjects'}`
              : 'No subjects scheduled'}
          </Text>
          <Text style={styles.classDetail}>
            Each subject has its own check-in, attendance status, and records page.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.scheduleButton}
            onPress={() => navigateWithProfile('TeacherSchedule')}
          >
            <Text style={styles.scheduleButtonText}>Manage subjects</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Today&apos;s attendance</Text>
          {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {realtimeError ? (
          <Text accessibilityRole="alert" style={styles.realtimeWarning}>
            Live updates paused: {realtimeError}
          </Text>
        ) : null}

        <View style={styles.stats}>
          <SummaryCard count={counts.present} label="Present" tone="present" />
          <SummaryCard count={counts.late} label="Late" tone="late" />
          <SummaryCard count={counts.absent} label="Absent" tone="absent" />
        </View>

        {!loading && schedules.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No subjects for today</Text>
            <Text style={styles.emptyText}>Add a subject and start time to begin taking attendance.</Text>
          </View>
        ) : null}

        <View style={styles.subjectList}>
          {schedules.map((schedule) => {
            const subjectCounts = getCounts(
              records.filter((record) => record.schedule_id === schedule.id)
            );
            return (
              <View key={schedule.id} style={styles.subjectCard}>
                <View style={styles.subjectHeader}>
                  <View style={styles.subjectCopy}>
                    <Text style={styles.subjectName}>{schedule.class_name}</Text>
                    <Text style={styles.subjectTime}>
                      Starts {new Date(schedule.starts_at).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {' · Ends '}
                      {new Date(schedule.ends_at).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text style={styles.recordCount}>
                    {subjectCounts.present + subjectCounts.late + subjectCounts.absent} records
                  </Text>
                </View>
                <View style={styles.subjectStats}>
                  <Text style={[styles.subjectStat, { color: colors.present }]}>
                    {subjectCounts.present} present
                  </Text>
                  <Text style={[styles.subjectStat, { color: colors.late }]}>
                    {subjectCounts.late} late
                  </Text>
                  <Text style={[styles.subjectStat, { color: colors.absent }]}>
                    {subjectCounts.absent} absent
                  </Text>
                </View>
                <View style={styles.subjectActions}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.primaryAction}
                    onPress={() => navigateWithProfile('Scanner', { scheduleId: schedule.id })}
                  >
                    <Text style={styles.primaryActionText}>Scan this subject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.recordsAction}
                    onPress={() =>
                      navigateWithProfile('ClassAttendance', { scheduleId: schedule.id })
                    }
                  >
                    <Text style={styles.recordsActionText}>View records</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          style={styles.secondaryAction}
          onPress={() => navigateWithProfile('Calendar')}
        >
          <Text style={styles.secondaryActionTitle}>Browse attendance by date</Text>
          <Text style={styles.arrowMuted}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({ count, label, tone }) {
  const color =
    tone === 'present' ? colors.present : tone === 'late' ? colors.late : colors.absent;
  const background =
    tone === 'present'
      ? colors.presentBackground
      : tone === 'late'
        ? colors.lateBackground
        : colors.absentBackground;

  return (
    <View style={styles.statCard}>
      <View style={[styles.statMark, { backgroundColor: background }]} />
      <Text style={[styles.statValue, { color }]}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: 20, gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headingCopy: { flex: 1, gap: 4 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.9 },
  title: { color: colors.text, fontSize: 23, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 12 },
  logout: { paddingVertical: 9, paddingHorizontal: 11 },
  logoutText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  classCard: { padding: 19, borderRadius: 19, backgroundColor: colors.navy, gap: 8 },
  classEyebrow: { color: '#B8C8E1', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  className: { color: colors.surface, fontSize: 21, fontWeight: '800' },
  classDetail: { color: '#D5DFEF', fontSize: 13, lineHeight: 19 },
  scheduleButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  scheduleButtonText: { color: colors.primaryDark, fontSize: 13, fontWeight: '700' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    minHeight: 92,
    justifyContent: 'center',
    padding: 13,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statMark: { width: 8, height: 8, marginBottom: 8, borderRadius: 4 },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { marginTop: 2, color: colors.muted, fontSize: 11, fontWeight: '600' },
  subjectList: { gap: 10 },
  subjectCard: {
    padding: 15,
    gap: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subjectHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  subjectCopy: { flex: 1, gap: 3 },
  subjectName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  subjectTime: { color: colors.muted, fontSize: 12 },
  recordCount: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  subjectStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  subjectStat: { fontSize: 11, fontWeight: '700' },
  subjectActions: { flexDirection: 'row', gap: 8 },
  primaryAction: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  primaryActionText: { color: colors.surface, fontSize: 12, fontWeight: '700' },
  recordsAction: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: colors.pendingBackground,
  },
  recordsActionText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  emptyCard: { alignItems: 'center', padding: 18, gap: 5, borderRadius: 14, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  secondaryAction: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryActionTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  arrowMuted: { color: colors.muted, fontSize: 25 },
  error: { color: colors.absent, fontSize: 13, lineHeight: 19 },
  realtimeWarning: {
    padding: 11,
    borderRadius: 10,
    backgroundColor: colors.lateBackground,
    color: colors.late,
    fontSize: 12,
    lineHeight: 18,
  },
});
