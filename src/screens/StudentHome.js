import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import StatusBadge from '../components/StatusBadge';
import {
  getStudentAttendanceForDate,
  subscribeToStudentAttendance,
} from '../utils/attendance';
import { getLocalDateKey } from '../utils/attendanceSchedule.cjs';
import { getSupabaseClient } from '../utils/supabase';
import { colors } from '../theme';

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function StudentHome({ route, navigation }) {
  const { profile } = route.params;
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState('');
  const [realtimeError, setRealtimeError] = useState('');
  const date = getLocalDateKey(new Date());

  useEffect(() => {
    let active = true;

    const loadAttendance = async () => {
      try {
        const todaysClasses = await getStudentAttendanceForDate(date, profile.id);
        if (active) {
          setClasses(todaysClasses);
          setRefreshError('');
          setRealtimeError('');
        }
      } catch (error) {
        if (active) setRefreshError(`Could not load today’s attendance: ${error.message}`);
      } finally {
        if (active) setLoading(false);
      }
    };

    const unsubscribeRealtime = subscribeToStudentAttendance(
      profile.id,
      date,
      loadAttendance,
      (message) => {
        if (active) setRealtimeError(message);
      }
    );
    const unsubscribeFocus = navigation.addListener('focus', loadAttendance);
    loadAttendance();

    return () => {
      active = false;
      unsubscribeRealtime();
      unsubscribeFocus();
    };
  }, [date, navigation, profile.id]);

  const handleLogout = async () => {
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
      navigation.replace('Login');
    } catch (error) {
      setRefreshError(`Could not sign out: ${error.message}`);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>STUDENT DASHBOARD</Text>
            <Text style={styles.welcome}>Hello, {profile.full_name}</Text>
            <Text style={styles.subheading}>{date} · Your attendance by subject</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.full_name?.trim().charAt(0).toUpperCase() || 'S'}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Today&apos;s classes</Text>
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
        </View>

        {refreshError ? (
          <Text accessibilityRole="alert" style={styles.error}>{refreshError}</Text>
        ) : null}
        {realtimeError ? (
          <Text accessibilityRole="alert" style={styles.realtimeWarning}>
            Live updates paused: {realtimeError}
          </Text>
        ) : null}

        {!loading && classes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No subjects scheduled today</Text>
            <Text style={styles.detail}>
              Your teacher has not published any schedules for today yet.
            </Text>
          </View>
        ) : null}

        <View style={styles.classList}>
          {classes.map((classItem) => (
            <View key={classItem.id} style={styles.attendanceCard}>
              <View style={styles.cardHeader}>
                <View style={styles.flex}>
                  <Text style={styles.cardEyebrow}>SUBJECT</Text>
                  <Text style={styles.cardTitle}>{classItem.class_name}</Text>
                </View>
                <StatusBadge status={classItem.attendance?.status || 'Not recorded'} />
              </View>

              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Class starts</Text>
                <Text style={styles.detailValue}>{formatTime(classItem.starts_at)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Class ends</Text>
                <Text style={styles.detailValue}>{formatTime(classItem.ends_at)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Check-in</Text>
                <Text style={styles.detailValue}>
                  {classItem.attendance?.scanned_at
                    ? formatTime(classItem.attendance.scanned_at)
                    : classItem.attendance?.status === 'Absent'
                      ? classItem.attendance.auto_generated
                        ? 'Class ended'
                        : 'After class end'
                      : 'Not recorded yet'}
                </Text>
              </View>
              <Text style={styles.statusDescription}>
                {classItem.attendance
                  ? classItem.attendance.status === 'Absent' && classItem.attendance.auto_generated
                    ? 'No scan was received before the scheduled class ended.'
                    : 'Your attendance record is up to date.'
                  : 'Show your QR code to your teacher when you arrive.'}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.qrCard}>
          <View style={styles.qrHeading}>
            <Text style={styles.cardTitle}>Your attendance QR</Text>
            <Text style={styles.detail}>Let your teacher scan this code to check you in.</Text>
          </View>
          {profile.student_number ? (
            <View style={styles.qrContainer}>
              <QRCode
                value={profile.student_number}
                size={210}
                color={colors.navy}
                backgroundColor={colors.surface}
              />
            </View>
          ) : (
            <Text style={styles.error}>
              Your student number is not set up. Contact your school administrator.
            </Text>
          )}
          {profile.student_number ? (
            <Text style={styles.studentNumber}>Student ID · {profile.student_number}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: 20, gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  headingCopy: { flex: 1 },
  eyebrow: { marginBottom: 5, color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  welcome: { color: colors.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.5 },
  subheading: { marginTop: 4, color: colors.muted, fontSize: 13 },
  avatar: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#DDE8FF',
  },
  avatarText: { color: colors.primaryDark, fontSize: 20, fontWeight: '800' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  classList: { gap: 11 },
  attendanceCard: {
    padding: 18,
    gap: 13,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  flex: { flex: 1, gap: 4 },
  cardEyebrow: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.9 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.border },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  detailLabel: { color: colors.muted, fontSize: 13 },
  detailValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  detail: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  statusDescription: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  realtimeWarning: {
    padding: 11,
    borderRadius: 10,
    backgroundColor: colors.lateBackground,
    color: colors.late,
    fontSize: 12,
    lineHeight: 18,
  },
  error: { color: colors.absent, fontSize: 13, lineHeight: 19 },
  emptyCard: {
    alignItems: 'center',
    padding: 18,
    gap: 7,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  qrCard: {
    alignItems: 'center',
    padding: 18,
    gap: 16,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrHeading: { alignSelf: 'stretch', gap: 4 },
  qrContainer: { padding: 15, borderRadius: 16, backgroundColor: colors.surface },
  studentNumber: { color: colors.muted, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  logoutButton: { alignItems: 'center', padding: 13 },
  logoutText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
});
