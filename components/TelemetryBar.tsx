import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TelemetryBarProps {
  label: string;
  value: number; // 0 to 1
  color?: string;
}

export default function TelemetryBar({ label, value, color = '#C8102E' }: TelemetryBarProps) {
  const percentage = Math.floor(value * 100);
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        <Text style={styles.value}>{percentage}%</Text>
      </View>
      <View style={styles.track}>
        <View 
          style={[
            styles.fill, 
            { width: `${percentage}%`, backgroundColor: color }
          ]} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900', // Bold/Heavy as per brief
    fontFamily: 'System',
  },
  value: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'System',
  },
  track: {
    height: 8, // Thicker for industrial look
    backgroundColor: '#E5E7EB',
    borderRadius: 0, // Rigid
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  fill: {
    height: '100%',
    // Zero shadow/glow
  },
});
