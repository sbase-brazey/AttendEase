import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const statusStyles = {
  Present: { background: colors.presentBackground, text: colors.present },
  Live: { background: colors.presentBackground, text: colors.present },
  Late: { background: colors.lateBackground, text: colors.late },
  Absent: { background: colors.absentBackground, text: colors.absent },
};

export default function StatusBadge({ status }) {
  const appearance = statusStyles[status] || {
    background: colors.pendingBackground,
    text: colors.pending,
  };

  return (
    <View style={[styles.badge, { backgroundColor: appearance.background }]}>
      <Text style={[styles.text, { color: appearance.text }]}>{status || 'Not recorded'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  text: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
});
