import React, { Component } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { C } from './src/config/colors';
import WebApp from './src/screens/WebApp';

// จับ error ระดับ render ไม่ให้จอขาว
class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: string }> {
  state = { error: '' };
  componentDidCatch(e: Error) { this.setState({ error: e.message + '\n' + (e.stack || '') }); }
  render() {
    if (this.state.error) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#0d0d1a', padding: 20 }}>
          <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>App Error</Text>
          <Text style={{ color: '#fca5a5', fontFamily: 'monospace', fontSize: 12 }}>{this.state.error}</Text>
        </ScrollView>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          <WebApp />
        </SafeAreaView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
});
