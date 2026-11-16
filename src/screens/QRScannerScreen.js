import React, { useRef, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { STUDENTS } from '../students';
import {
  getAttendanceSchedule,
  markAttendance,
  syncAutomaticAbsences,
} from '../utils/attendance';
import {
  getEffectiveNow,
  getLocalDateKey,
} from '../utils/attendanceSchedule.cjs';
import { getTestClock } from '../utils/testClock';

export default function QRScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [message, setMessage] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [permissionError, setPermissionError] = useState('');
  const scanHandled = useRef(false);

  const handlePermissionRequest = async () => {
    setPermissionError('');
    try {
      const result = await requestPermission();
      if (!result.granted) {
        setPermissionError(
          result.canAskAgain === false
            ? 'Camera access is blocked. Enable it in your browser or device settings.'
            : 'Camera access was not granted. Allow it in the browser prompt, then try again.'
        );
      }
    } catch (error) {
      setPermissionError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleBarcodeScanned = async ({ data }) => {
    if (scanHandled.current) return;

    scanHandled.current = true;
    setScanned(true);

    const student = STUDENTS.find((item) => item.id === data);
    if (!student) {
      setMessage('This QR code does not belong to a registered student.');
      return;
    }

    try {
      const schedule = await getAttendanceSchedule();
      if (!schedule?.startTime) {
        setMessage('The teacher must save the daily class schedule before attendance can be recorded.');
        return;
      }

      const testClock = await getTestClock();
      const now = getEffectiveNow(testClock);
      const date = getLocalDateKey(now);
      await syncAutomaticAbsences(date, schedule.startTime, now, testClock.enabled);
      const result = await markAttendance(
        student.id,
        student.name,
        date,
        schedule.startTime,
        now,
        testClock.enabled
      );
      setMessage(
        result.created
          ? `${student.name}: ${result.status}.`
          : `${student.name}: already recorded as ${result.status}.`
      );
    } catch (error) {
      setMessage(`Could not save attendance: ${error.message}`);
    }
  };

  const scanAgain = () => {
    scanHandled.current = false;
    setScanned(false);
    setMessage('');
  };

  return (
    <View style={styles.container}>
      {permission?.granted && !cameraError ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          onMountError={(event) => setCameraError(event.message)}
        />
      ) : (
        <View style={styles.statusContainer}>
          {permission === null ? (
            <>
              <ActivityIndicator size="large" color="#1A56DB" />
              <Text style={styles.statusText}>Checking camera permission...</Text>
            </>
          ) : permission?.granted && cameraError ? (
            <>
              <Text style={styles.statusText}>Camera could not start: {cameraError}</Text>
              <Button title="Try Again" onPress={() => setCameraError('')} />
            </>
          ) : (
            <>
              <Text style={styles.statusText}>
                {permissionError ||
                  'Allow camera access to scan student QR codes. On web, use localhost or a secure HTTPS connection.'}
              </Text>
              {permission?.canAskAgain !== false && (
                <Button title="Enable Camera" onPress={handlePermissionRequest} />
              )}
            </>
          )}
        </View>
      )}

      {permission?.granted && !cameraError && (
        <>
          <View style={styles.overlay}>
            <Text style={styles.scanText}>Scan Student QR Code</Text>
          </View>
          {scanned && (
            <View style={styles.result}>
              <Text style={styles.resultText}>{message}</Text>
              <Button title="Scan Again" onPress={scanAgain} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  statusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#f5f5f5',
  },
  statusText: { color: '#333', fontSize: 16, textAlign: 'center' },
  overlay: {
    position: 'absolute',
    top: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 10,
  },
  scanText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  result: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    padding: 16,
    gap: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  resultText: { color: '#222', fontSize: 16, textAlign: 'center' },
});
