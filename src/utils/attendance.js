import { getLocalDateKey, getScheduledStart } from './attendanceSchedule.cjs';
import { getSupabaseClient } from './supabase';

const PROFILE_COLUMNS = 'id, role, full_name, student_number';
const SCHEDULE_COLUMNS = 'id, class_date, class_name, starts_at, ends_at';
const ATTENDANCE_COLUMNS =
  'id, schedule_id, student_id, status, scanned_at, auto_generated, created_at';

let subscriptionSequence = 0;

// ==========================================
// 1. DATA FETCHING FUNCTIONS
// ==========================================

export async function getProfile(profileId) {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', profileId)
    .single();

  if (error) throw error;
  return data;
}

export async function getClassSchedulesForDate(date = getLocalDateKey(new Date())) {
  const { data, error } = await getSupabaseClient()
    .from('class_schedule')
    .select(SCHEDULE_COLUMNS)
    .eq('class_date', date)
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getClassSchedule(scheduleId) {
  const { data, error } = await getSupabaseClient()
    .from('class_schedule')
    .select(SCHEDULE_COLUMNS)
    .eq('id', scheduleId)
    .single();

  if (error) throw error;
  return data;
}

export async function saveClassSchedule(
  className,
  startTime,
  endTime,
  date,
  teacherId,
  scheduleId = null
) {
  const startsAt = getScheduledStart(date, startTime).toISOString();
  const endsAt = getScheduledStart(date, endTime).toISOString();
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new Error('Class end time must be later than its start time.');
  }
  const scheduleData = {
    class_date: date,
    class_name: className,
    starts_at: startsAt,
    ends_at: endsAt,
    created_by: teacherId,
  };
  const query = getSupabaseClient().from('class_schedule');
  const { data, error } = scheduleId
    ? await query
        .update(scheduleData)
        .eq('id', scheduleId)
        .select(SCHEDULE_COLUMNS)
        .single()
    : await query.insert(scheduleData).select(SCHEDULE_COLUMNS).single();

  if (error) throw error;
  return data;
}

export async function getAttendanceForDate(date) {
  const schedules = await getClassSchedulesForDate(date);
  if (schedules.length === 0) return { schedules, records: [] };

  const { data: attendance, error: attendanceError } = await getSupabaseClient()
    .from('attendance')
    .select(ATTENDANCE_COLUMNS)
    .in('schedule_id', schedules.map((schedule) => schedule.id))
    .order('created_at', { ascending: true });

  if (attendanceError) throw attendanceError;
  if (!attendance.length) return { schedules, records: [] };

  const studentIds = [...new Set(attendance.map((record) => record.student_id))];
  const { data: profiles, error: profilesError } = await getSupabaseClient()
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .in('id', studentIds);

  if (profilesError) throw profilesError;
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const schedulesById = new Map(schedules.map((schedule) => [schedule.id, schedule]));

  return {
    schedules,
    records: attendance.map((record) => ({
      ...record,
      student: profilesById.get(record.student_id) || null,
      schedule: schedulesById.get(record.schedule_id) || null,
    })),
  };
}

export async function getAttendanceForSchedule(scheduleId) {
  const schedule = await getClassSchedule(scheduleId);
  const result = await getAttendanceForDate(schedule.class_date);
  return {
    schedule,
    records: result.records.filter((record) => record.schedule_id === scheduleId),
  };
}

export async function getStudentAttendance(scheduleId, studentId) {
  if (!scheduleId) return null;

  const { data, error } = await getSupabaseClient()
    .from('attendance')
    .select(ATTENDANCE_COLUMNS)
    .eq('schedule_id', scheduleId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getStudentAttendanceForDate(date, studentId) {
  const schedules = await getClassSchedulesForDate(date);
  if (schedules.length === 0) return [];

  const { data: records, error } = await getSupabaseClient()
    .from('attendance')
    .select(ATTENDANCE_COLUMNS)
    .eq('student_id', studentId)
    .in('schedule_id', schedules.map((schedule) => schedule.id));

  if (error) throw error;
  const recordsByScheduleId = new Map(
    records.map((record) => [record.schedule_id, record])
  );

  return schedules.map((schedule) => ({
    ...schedule,
    attendance: recordsByScheduleId.get(schedule.id) || null,
  }));
}

export async function recordStudentAttendance(studentNumber, scheduleId) {
  const { data, error } = await getSupabaseClient().rpc('record_attendance', {
    p_student_number: studentNumber,
    p_schedule_id: scheduleId,
  });

  if (error) throw error;
  const record = Array.isArray(data) ? data[0] : data;
  if (!record) throw new Error('Attendance was not recorded by the server.');

  // The SQL function now returns the exact names your UI expects
  return record;
}

// ==========================================
// 2. HYBRID REALTIME + POLLING (Bulletproof)
// ==========================================

function subscribeToChanges(channelName, subscriptions, onChange, onError) {
  const supabase = getSupabaseClient();
  const uniqueChannelName = `${channelName}-${++subscriptionSequence}`;
  let channel = supabase.channel(uniqueChannelName);

  // 1. Start the fallback polling (every 3 seconds)
  const pollInterval = setInterval(() => {
    onChange();
  }, 3000);

  // 2. Try the WebSocket Realtime connection
  for (const subscription of subscriptions) {
    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: subscription.table,
        ...(subscription.filter ? { filter: subscription.filter } : {}),
      },
      onChange
    );
  }

  channel.subscribe((status, error) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      const message = error?.message || `Realtime connection ${status.toLowerCase()}.`;
      console.warn(`Realtime unavailable. Using 3s background polling instead: ${message}`);
      if (onError) onError(message);
    }
  });

  return () => {
    clearInterval(pollInterval); // Stop polling when the screen unmounts
    void supabase.removeChannel(channel).catch((error) => {
      console.warn(`Unable to remove Supabase channel:`, error);
    });
  };
}

export function subscribeToStudentAttendance(studentId, date, onChange, onError) {
  const subscriptions = [
    { table: 'class_schedule', filter: `class_date=eq.${date}` },
    { table: 'attendance', filter: `student_id=eq.${studentId}` },
  ];

  return subscribeToChanges(
    `student-attendance-${studentId}-${date}`,
    subscriptions,
    onChange,
    onError
  );
}

export function subscribeToDateAttendance(date, _scheduleId, onChange, onError) {
  const subscriptions = [{ table: 'class_schedule', filter: `class_date=eq.${date}` }];
  subscriptions.push({ table: 'attendance' });

  return subscribeToChanges(
    `attendance-date-${date}`,
    subscriptions,
    onChange,
    onError
  );
}

export function subscribeToScheduleAttendance(scheduleId, onChange, onError) {
  return subscribeToChanges(
    `attendance-schedule-${scheduleId}`,
    [{ table: 'attendance', filter: `schedule_id=eq.${scheduleId}` }],
    onChange,
    onError
  );
}

export function subscribeToTeacherAttendance(date, scheduleId, onChange, onError) {
  return subscribeToDateAttendance(date, scheduleId, onChange, onError);
}