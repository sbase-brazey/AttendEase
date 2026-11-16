import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';

export default function TeacherDashboard({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Good Morning, Teacher!</Text>
      <Text style={styles.subHeader}>Here is your attendance overview.</Text>

      <View style={styles.grid}>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Scanner')}>
          <Text style={styles.cardTitle}>📷 Scan Student</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Calendar')}>
          <Text style={styles.cardTitle}>📅 View Records</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('TeacherSchedule')}>
          <Text style={styles.cardTitle}>🕒 Class Schedule</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('Login')}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  header: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subHeader: { fontSize: 14, color: '#666', marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginTop: 20 },
  card: { backgroundColor: '#fff', padding: 24, borderRadius: 15, width: '46%', alignItems: 'center', elevation: 3 },
  cardTitle: { fontWeight: 'bold', fontSize: 16 },
  logoutBtn: { marginTop: 'auto', padding: 15, alignItems: 'center' },
  logoutText: { color: 'red', fontWeight: 'bold' }
});