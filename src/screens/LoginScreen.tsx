import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { C } from '../config/colors';
import { loginWithUsername } from '../services/authService';

interface Props {
  onLogin: (username: string) => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    if (!username.trim() || !password) { setError('กรุณากรอกข้อมูลให้ครบ'); return; }
    setLoading(true); setError('');
    try {
      const user = await loginWithUsername(username.trim(), password);
      onLogin(user);
    } catch (e: any) {
      const code = e?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
        setError('รหัสผ่านไม่ถูกต้อง');
      } else if (code === 'auth/user-not-found') {
        setError('ไม่พบบัญชีนี้');
      } else {
        setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.box}>
          <Text style={s.icon}>💰</Text>
          <Text style={s.logo}>MoneyMind</Text>
          <Text style={s.sub}>บริหารการเงินส่วนตัว</Text>

          <TextInput
            style={s.input}
            placeholder="Username หรือ Email"
            placeholderTextColor={C.muted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={s.input}
            placeholder="รหัสผ่าน"
            placeholderTextColor={C.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {!!error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity style={s.btn} onPress={handle} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnText}>เข้าสู่ระบบ</Text>
            )}
          </TouchableOpacity>

          <Text style={s.hint}>ใช้ username + password เดียวกับเว็บ</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  box: {
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  icon: { fontSize: 48, marginBottom: 12 },
  logo: {
    fontSize: 26,
    fontWeight: '800',
    color: C.primaryL,
    marginBottom: 4,
  },
  sub: { fontSize: 13, color: C.muted, marginBottom: 28 },
  input: {
    width: '100%',
    backgroundColor: C.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    fontSize: 15,
    color: C.text,
    marginBottom: 12,
  },
  error: { color: C.red, fontSize: 13, marginBottom: 8, alignSelf: 'flex-start' },
  btn: {
    width: '100%',
    backgroundColor: C.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 12, color: C.muted, marginTop: 16, textAlign: 'center' },
});
