import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getLocalDateKey,
  isValidTime,
  isValidTimeRange,
} from '../utils/attendanceSchedule.cjs';
import { getClassSchedulesForDate, saveClassSchedule } from '../utils/attendance';
import { colors } from '../theme';

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getTimeOneHourLater(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = Math.min(hours * 60 + minutes + 60, 23 * 60 + 59);
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

function getScheduleTime(schedule, field) {
  const time = new Date(schedule[field]);
  return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
}

function sortSchedules(schedules) {
  return [...schedules].sort(
    (first, second) => new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime()
  );
}

export default function TeacherSchedule({ route, navigation }) {
  const { profile } = route.params;
  const [className, setClassName] = useState('');
  const [startTime, setStartTime] = useState(getCurrentTime);
  const [endTime, setEndTime] = useState(() => getTimeOneHourLater(getCurrentTime()));
  const [schedules, setSchedules] = useState([]);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const date = getLocalDateKey(new Date());

  useEffect(() => {
    let active = true;

    getClassSchedulesForDate(date)
      .then((savedSchedules) => {
        if (active) setSchedules(savedSchedules);
      })
      .catch((loadError) => {
        if (active) setError(`Could not load today's schedules: ${loadError.message}`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date]);

  const startNewSchedule = () => {
    setEditingScheduleId(null);
    setClassName('');
    const newStartTime = getCurrentTime();
    setStartTime(newStartTime);
    setEndTime(getTimeOneHourLater(newStartTime));
    setError('');
    setNotice('');
  };

  const editSchedule = (schedule) => {
    setEditingScheduleId(schedule.id);
    setClassName(schedule.class_name);
    setStartTime(getScheduleTime(schedule, 'starts_at'));
    setEndTime(getScheduleTime(schedule, 'ends_at'));
    setError('');
    setNotice('');
  };

  const handleSaveSchedule = async () => {
    const trimmedClassName = className.trim();
    if (!trimmedClassName) {
      setError('Enter the subject or class name.');
      setNotice('');
      return;
    }
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      setError('Enter both class times in 24-hour HH:MM format.');
      setNotice('');
      return;
    }
    if (!isValidTimeRange(startTime, endTime)) {
      setError('Class end time must be later than its start time.');
      setNotice('');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const savedSchedule = await saveClassSchedule(
        trimmedClassName,
        startTime,
        endTime,
        date,
        profile.id,
        editingScheduleId
      );
      setSchedules((current) =>
        sortSchedules([
          ...current.filter((schedule) => schedule.id !== savedSchedule.id),
          savedSchedule,
        ])
      );
      if (editingScheduleId) {
        setEditingScheduleId(savedSchedule.id);
        setClassName(savedSchedule.class_name);
        setStartTime(getScheduleTime(savedSchedule, 'starts_at'));
        setEndTime(getScheduleTime(savedSchedule, 'ends_at'));
        setNotice(`${savedSchedule.class_name} schedule updated.`);
      } else {
        setClassName('');
        const newStartTime = getCurrentTime();
        setStartTime(newStartTime);
        setEndTime(getTimeOneHourLater(newStartTime));
        setNotice(`${savedSchedule.class_name} added to today's schedule.`);
      }
    } catch (saveError) {
      setError(`Could not save the schedule: ${saveError.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>TEACHER TOOLS</Text>
        <Text style={styles.title}>Class schedule</Text>
        <Text style={styles.subtitle}>
          Add each subject separately. Every subject gets its own attendance records.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Attendance policy</Text>
        <View style={styles.policyRow}>
          <View style={[styles.dot, { backgroundColor: colors.present }]} />
          <Text style={styles.policyText}>Before start or through 15 min after: Present</Text>
        </View>
        <View style={styles.policyRow}>
          <View style={[styles.dot, { backgroundColor: colors.late }]} />
          <Text style={styles.policyText}>After 15 min, through class end: Late</Text>
        </View>
        <View style={styles.policyRow}>
          <View style={[styles.dot, { backgroundColor: colors.absent }]} />
          <Text style={styles.policyText}>No attendance by class end: Absent</Text>
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionTitle}>Today&apos;s subjects</Text>
          <Text style={styles.date}>{date}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={startNewSchedule}>
          <Text style={styles.addButton}>+ Add subject</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : schedules.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No subjects scheduled yet</Text>
          <Text style={styles.emptyText}>Add the first subject using the form below.</Text>
        </View>
      ) : (
        <View style={styles.scheduleList}>
          {schedules.map((schedule) => (
            <View key={schedule.id} style={styles.scheduleCard}>
              <View style={styles.scheduleCopy}>
                <Text style={styles.scheduleName}>{schedule.class_name}</Text>
                <Text style={styles.scheduleTime}>
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
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.viewButton}
                onPress={() =>
                  navigation.navigate('ClassAttendance', { profile, scheduleId: schedule.id })
                }
              >
                <Text style={styles.viewButtonText}>Records</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.editButton}
                onPress={() => editSchedule(schedule)}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>
          {editingScheduleId ? 'Edit subject' : 'Add a subject'}
        </Text>
        <Text style={styles.label}>Subject or class name</Text>
        <TextInput
          accessibilityLabel="Subject or class name"
          style={styles.input}
          value={className}
          onChangeText={setClassName}
          placeholder="e.g. Mathematics 101"
          placeholderTextColor={colors.muted}
          maxLength={80}
          autoCapitalize="words"
        />
        <Text style={styles.label}>Class start time</Text>
        <TextInput
          accessibilityLabel="Class start time"
          style={styles.input}
          value={startTime}
          onChangeText={setStartTime}
          placeholder="08:00"
          placeholderTextColor={colors.muted}
          maxLength={5}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
        />
        <Text style={styles.label}>Class end time</Text>
        <TextInput
          accessibilityLabel="Class end time"
          style={styles.input}
          value={endTime}
          onChangeText={setEndTime}
          placeholder="09:00"
          placeholderTextColor={colors.muted}
          maxLength={5}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
        />
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.button, saving && styles.disabled]}
          onPress={handleSaveSchedule}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.buttonText}>
              {editingScheduleId ? 'Update subject' : 'Add subject'}
            </Text>
          )}
        </TouchableOpacity>
        {editingScheduleId ? (
          <TouchableOpacity accessibilityRole="button" onPress={startNewSchedule}>
            <Text style={styles.cancelText}>Cancel editing</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 16, backgroundColor: colors.background },
  heading: { gap: 5, marginBottom: 2 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  infoCard: { padding: 18, gap: 10, borderRadius: 16, backgroundColor: colors.navy },
  infoTitle: { marginBottom: 2, color: colors.surface, fontSize: 16, fontWeight: '700' },
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  policyText: { color: '#E8EEF7', fontSize: 13 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  date: { marginTop: 3, color: colors.muted, fontSize: 12 },
  addButton: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  scheduleList: { gap: 9 },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    gap: 7,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scheduleCopy: { flex: 1, gap: 3 },
  scheduleName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  scheduleTime: { color: colors.muted, fontSize: 12 },
  viewButton: { paddingVertical: 9, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#E8EEFA' },
  viewButtonText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  editButton: { paddingVertical: 9, paddingHorizontal: 10, borderRadius: 9, backgroundColor: colors.pendingBackground },
  editButtonText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  emptyCard: { alignItems: 'center', padding: 18, gap: 5, borderRadius: 14, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  formCard: {
    padding: 18,
    gap: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  label: { color: colors.text, fontSize: 13, fontWeight: '700' },
  input: {
    minHeight: 50,
    paddingHorizontal: 13,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FAFBFD',
    color: colors.text,
    fontSize: 15,
  },
  button: {
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    borderRadius: 11,
    backgroundColor: colors.primary,
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: colors.surface, fontSize: 14, fontWeight: '700' },
  cancelText: { color: colors.muted, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  error: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.absentBackground,
    color: colors.absent,
    lineHeight: 20,
  },
  notice: { color: colors.present, fontSize: 13, lineHeight: 19 },
});
