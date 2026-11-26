import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { getProfile } from '../utils/attendance';
import { getSupabaseClient } from '../utils/supabase';

function getDashboardRoute(profile) {
  if (profile.role === 'teacher') return 'TeacherDashboard';
  if (profile.role === 'student') return 'StudentHome';
  throw new Error('Your account does not have a supported AttendEase role.');
}

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      try {
        const client = getSupabaseClient();
        const { data, error } = await client.auth.getSession();
        if (error) throw error;

        if (data.session?.user) {
          const profile = await getProfile(data.session.user.id);
          if (active) navigation.replace(getDashboardRoute(profile), { profile });
        }
      } catch (sessionError) {
        if (active) {
          setErrorMessage(`Unable to connect to your account: ${sessionError.message}`);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    restoreSession();
    return () => {
      active = false;
    };
  }, [navigation]);

  const handleLogin = async () => {
    setSigningIn(true);
    setErrorMessage('');
    let client;
    let signedIn = false;

    try {
      client = getSupabaseClient();

      // 1. Get what the user typed
      const input = email.trim();

      // 2. If it doesn't have an '@', it's a Student ID. Add the hidden email domain.
      const loginEmail = input.includes('@') ? input : `${input}@attendease.local`;

      // 3. Sign in with Supabase
      const { data, error } = await client.auth.signInWithPassword({
        email: loginEmail,
        password, // They type their ID again here for the password
      });

      if (error) throw error;
      if (!data.user) throw new Error('Authentication did not return a user account.');
      signedIn = true;

      // 4. Get their profile and route them to the right dashboard
      const profile = await getProfile(data.user.id);
      navigation.replace(getDashboardRoute(profile), { profile });
    } catch (loginError) {
      if (signedIn && client) {
        try {
          const { error: signOutError } = await client.auth.signOut();
          if (signOutError) console.error('Unable to clear incomplete sign-in:', signOutError);
        } catch (signOutError) {
          console.error('Unable to clear incomplete sign-in:', signOutError);
        }
      }
      const message = loginError.message || 'Unable to sign in. Please check your ID and password.';
      setErrorMessage(
        /database error querying schema/i.test(message)
          ? 'Supabase Auth returned a server error while querying its database (HTTP 500). Your URL and key reached Supabase, but the Auth database is unavailable or unhealthy. Check your project status and Auth/Postgres logs in the Supabase Dashboard.'
          : /failed to fetch|network request failed|networkerror/i.test(message)
            ? 'Could not reach Supabase. Check your internet connection and Supabase project status, then restart Expo with “npx expo start -c”.'
            : message
      );
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brandPanel}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>A</Text>
            </View>
            <Text style={styles.brand}>AttendEase</Text>
            <Text style={styles.tagline}>Attendance, made clear.</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.description}>Sign in with your school account to continue.</Text>

            <Text style={styles.label}>Student ID or Email</Text>
            <TextInput
              accessibilityLabel="Student ID or Email"
              style={styles.input}
              placeholder="e.g. 2023302044 or teacher@gmail.com"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address" // Accepts both numbers and letters
              textContentType="username"
              editable={!loading && !signingIn}
              returnKeyType="next"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              accessibilityLabel="Password"
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              editable={!loading && !signingIn}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            {!!errorMessage && (
              <Text accessibilityRole="alert" style={styles.error}>
                {errorMessage}
              </Text>
            )}

            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.button, (loading || signingIn) && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading || signingIn}
            >
              {loading || signingIn ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.footer}>
              Need access? Contact your school administrator.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.navy },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
    gap: 24,
    backgroundColor: colors.background,
  },
  brandPanel: { width: '100%', maxWidth: 480, alignItems: 'center', paddingVertical: 8 },
  brandMark: {
    width: 58,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderRadius: 18,
    backgroundColor: colors.primary,
  },
  brandMarkText: { color: colors.surface, fontSize: 28, fontWeight: '800' },
  brand: { color: colors.navy, fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  tagline: { marginTop: 6, color: colors.muted, fontSize: 15 },
  formCard: {
    width: '100%',
    maxWidth: 480,
    padding: 22,
    gap: 12,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 23, fontWeight: '800' },
  description: { marginBottom: 8, color: colors.muted, fontSize: 14, lineHeight: 20 },
  label: { color: colors.text, fontSize: 13, fontWeight: '700' },
  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FAFBFD',
    color: colors.text,
    fontSize: 15,
  },
  error: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.absentBackground,
    color: colors.absent,
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: '700' },
  footer: { marginTop: 4, color: colors.muted, fontSize: 12, textAlign: 'center' },
});