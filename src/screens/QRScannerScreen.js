import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import StatusBadge from '../components/StatusBadge';
import { colors } from '../theme';
import { getClassSchedulesForDate, recordStudentAttendance } from '../utils/attendance';
import { getLocalDateKey } from '../utils/attendanceSchedule.cjs';

export default function QRScannerScreen({ route, navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(route.params?.scheduleId || null);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [showSchedulePicker, setShowSchedulePicker] = useState(!route.params?.scheduleId);
  const [scheduleError, setScheduleError] = useState('');
  const [scanned, setScanned] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [message, setMessage] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [saving, setSaving] = useState(false);
  const scanHandled = useRef(false);
  const selectedSchedule = schedules.find((schedule) => schedule.id === selectedScheduleId) || null;

  useEffect(() => {
    let active = true;
    const date = getLocalDateKey(new Date());

    getClassSchedulesForDate(date)
      .then((todaySchedules) => {
        if (!active) return;
        setSchedules(todaySchedules);
        if (
          route.params?.scheduleId &&
          todaySchedules.some((schedule) => schedule.id === route.params.scheduleId)
        ) {
          setSelectedScheduleId(route.params.scheduleId);
          setShowSchedulePicker(false);
        } else {
          setSelectedScheduleId(null);
          setShowSchedulePicker(true);
        }
      })
      .catch((error) => {
        if (active) setScheduleError(`Could not load today’s subjects: ${error.message}`);
      })
      .finally(() => {
        if (active) setLoadingSchedules(false);
      });

    return () => {
      active = false;
    };
  }, [route.params?.scheduleId]);

  const handleBarcodeScanned = async ({ data }) => {
    if (scanHandled.current || !selectedSchedule) return;

    scanHandled.current = true;
    setScanned(true);
    setSaving(true);
    setMessage('');
    setScanResult(null);

    try {
      const result = await recordStudentAttendance(data.trim(), selectedSchedule.id);
      setScanResult({ ...result, className: selectedSchedule.class_name });
    } catch (error) {
      setMessage(error.message || 'Attendance could not be recorded. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const scanAgain = () => {
    scanHandled.current = false;
    setScanned(false);
    setScanResult(null);
    setMessage('');
  };

  const chooseSchedule = (schedule) => {
    setSelectedScheduleId(schedule.id);
    setShowSchedulePicker(false);
    setCameraError('');
    scanAgain();
  };

  const handlePermissionRequest = async () => {
    try {
      const result = await requestPermission();
      if (!result.granted) {
        setMessage(
          result.canAskAgain === false
            ? 'Camera access is blocked. Enable it in your device settings.'
            : 'Camera access was not granted. Allow it to scan attendance.'
        );
      } else {
        setMessage('');
      }
    } catch (error) {
      setMessage(error.message || 'Unable to request camera access.');
    }
  };

  if (loadingSchedules) {
    return (
      <View style={styles.permissionScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.permissionTitle}>Loading today’s subjects</Text>
      </View>
    );
  }

  if (scheduleError) {
    return (
      <View style={styles.permissionScreen}>
        <Text style={styles.permissionTitle}>Subjects unavailable</Text>
        <Text accessibilityRole="alert" style={styles.permissionText}>{scheduleError}</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (schedules.length === 0) {
    return (
      <View style={styles.permissionScreen}>
        <Text style={styles.permissionTitle}>No subjects scheduled today</Text>
        <Text style={styles.permissionText}>Add a subject before scanning attendance.</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('TeacherSchedule', { profile: route.params?.profile })}
        >
          <Text style={styles.primaryButtonText}>Manage class schedule</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showSchedulePicker || !selectedSchedule) {
    return (
      <ScrollView contentContainerStyle={styles.pickerScreen}>
        <Text style={styles.pickerEyebrow}>TODAY&apos;S CLASSES</Text>
        <Text style={styles.pickerTitle}>Choose a subject</Text>
        <Text style={styles.pickerSubtitle}>
          Select the class being checked in. The attendance record will be saved to that subject only.
        </Text>
        {schedules.map((schedule) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={schedule.id}
            style={styles.scheduleOption}
            onPress={() => chooseSchedule(schedule)}
          >
            <View style={styles.scheduleCopy}>
              <Text style={styles.scheduleName}>{schedule.class_name}</Text>
              <Text style={styles.scheduleTime}>
                {new Date(schedule.starts_at).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <Text style={styles.optionArrow}>›</Text>
          </TouchableOpacity>
        ))}
        {!!message && <Text style={styles.permissionError}>{message}</Text>}
      </ScrollView>
    );
  }

  if (!permission?.granted || cameraError) {
    return (
      <View style={styles.permissionScreen}>
        {permission === null ? (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.permissionTitle}>Checking camera access</Text>
          </>
        ) : cameraError ? (
          <>
            <Text style={styles.permissionTitle}>Camera unavailable</Text>
            <Text style={styles.permissionText}>{cameraError}</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setCameraError('')}>
              <Text style={styles.secondaryButtonText}>Try again</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.permissionTitle}>Allow camera access</Text>
            <Text style={styles.permissionText}>
              AttendEase uses your camera to scan a student’s attendance QR code for {selectedSchedule.class_name}.
            </Text>
            {message ? <Text style={styles.permissionError}>{message}</Text> : null}
            {permission?.canAskAgain !== false && (
              <TouchableOpacity style={styles.primaryButton} onPress={handlePermissionRequest}>
                <Text style={styles.primaryButtonText}>Enable camera</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setShowSchedulePicker(true)}
            >
              <Text style={styles.secondaryButtonText}>Change subject</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        onMountError={(event) => setCameraError(event.message)}
      />
      <View style={styles.topOverlay}>
        <View style={styles.overlayRow}>
          <View style={styles.overlayCopy}>
            <Text style={styles.scanHeading}>Scanning {selectedSchedule.class_name}</Text>
            <Text style={styles.scanHint}>Center the student QR code in the frame.</Text>
          </View>
          <TouchableOpacity onPress={() => setShowSchedulePicker(true)}>
            <Text style={styles.changeSubject}>Change</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View pointerEvents="none" style={styles.scanFrame}>
        <View style={[styles.corner, styles.cornerTopLeft]} />
        <View style={[styles.corner, styles.cornerTopRight]} />
        <View style={[styles.corner, styles.cornerBottomLeft]} />
        <View style={[styles.corner, styles.cornerBottomRight]} />
      </View>

      {(scanned || saving) && (
        <View style={styles.resultCard}>
          {saving ? (
            <View style={styles.savingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.resultTitle}>Saving attendance…</Text>
            </View>
          ) : scanResult ? (
            <>
              <View style={styles.resultHeader}>
                <View style={styles.resultCopy}>
                  <Text style={styles.resultEyebrow}>ATTENDANCE RECORDED</Text>
                  <Text style={styles.resultTitle}>{scanResult.student_name}</Text>
                </View>
                <StatusBadge status={scanResult.status} />
              </View>
              <Text style={styles.resultDetail}>
                {scanResult.className} · {new Date(scanResult.scanned_at).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
              <TouchableOpacity style={styles.primaryButton} onPress={scanAgain}>
                <Text style={styles.primaryButtonText}>Scan next student</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.resultTitle}>Unable to record attendance</Text>
              <Text style={styles.resultDetail}>{message}</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={scanAgain}>
                <Text style={styles.primaryButtonText}>Try again</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  permissionScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    gap: 14,
    backgroundColor: colors.background,
  },
  permissionTitle: { color: colors.text, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  permissionText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  permissionError: { color: colors.absent, fontSize: 13, textAlign: 'center' },
  pickerScreen: { flexGrow: 1, padding: 20, gap: 12, backgroundColor: colors.background },
  pickerEyebrow: { marginTop: 6, color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  pickerTitle: { color: colors.text, fontSize: 25, fontWeight: '800' },
  pickerSubtitle: { marginBottom: 8, color: colors.muted, fontSize: 13, lineHeight: 19 },
  scheduleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scheduleCopy: { flex: 1, gap: 4 },
  scheduleName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  scheduleTime: { color: colors.muted, fontSize: 12 },
  optionArrow: { color: colors.primary, fontSize: 27 },
  topOverlay: {
    position: 'absolute',
    top: 28,
    left: 16,
    right: 16,
    padding: 15,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 35, 63, 0.9)',
  },
  overlayRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  overlayCopy: { flex: 1, gap: 5 },
  scanHeading: { color: colors.surface, fontSize: 16, fontWeight: '700' },
  scanHint: { color: '#D4DFEF', fontSize: 12 },
  changeSubject: { color: '#DCE6FF', fontSize: 12, fontWeight: '700' },
  scanFrame: {
    position: 'absolute',
    top: '28%',
    left: '12%',
    width: '76%',
    aspectRatio: 1,
  },
  corner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: colors.surface,
  },
  cornerTopLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  cornerTopRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  cornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  resultCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    padding: 18,
    gap: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 42 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  resultCopy: { flex: 1, gap: 4 },
  resultEyebrow: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  resultTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  resultDetail: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  primaryButton: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 11,
    backgroundColor: colors.primary,
  },
  primaryButtonText: { color: colors.surface, fontSize: 14, fontWeight: '700' },
  secondaryButton: {
    marginTop: 6,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 11,
    backgroundColor: colors.pendingBackground,
  },
  secondaryButtonText: { color: colors.text, fontWeight: '700' },
});
