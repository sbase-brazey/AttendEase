import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export default function StudentHome({ route, navigation }) {
  const { student } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Hello, {student.name}!</Text>
      <Text style={styles.sub}>Show this QR code to your teacher.</Text>

      <View style={styles.qrContainer}>
        <QRCode
          value={student.id}
          size={250}
          color="black"
          backgroundColor="white"
        />
      </View>

      <Text style={styles.idText}>ID: {student.id}</Text>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('Login')}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  welcome: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  sub: { fontSize: 14, color: '#666', marginBottom: 30 },
  qrContainer: { padding: 20, backgroundColor: '#fff', borderRadius: 20, elevation: 5 },
  idText: { marginTop: 20, fontSize: 18, fontWeight: 'bold', color: '#1A56DB' },
  logoutBtn: { marginTop: 40, padding: 15 },
  logoutText: { color: 'red', fontWeight: 'bold' }
});