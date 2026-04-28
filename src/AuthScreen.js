import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  Easing,
  Platform
} from 'react-native';
import { Zap } from 'lucide-react-native';
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  PhoneAuthProvider,
  RecaptchaVerifier,
  linkWithCredential
} from 'firebase/auth';
import { auth, firestore } from './firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import Svg, { Path } from 'react-native-svg';

const TabSwitcher = ({ tabs, activeTab, onTabChange }) => {
  return (
    <View style={styles.tabContainer}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, isActive && styles.tabActive]}
            activeOpacity={0.8}
            onPress={() => onTabChange(tab)}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const GoogleIcon = () => (
  <Svg width="18" height="18" viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <Path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <Path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <Path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </Svg>
);

const AnimatedButton = ({ title, onPress, type = 'primary', icon }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <Animated.View
        style={[
          styles.button,
          type === 'primary' ? styles.primaryButton : styles.ghostButton,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        {icon && <View style={styles.buttonIcon}>{icon}</View>}
        <Text style={[
          styles.buttonText,
          type === 'primary' ? styles.primaryButtonText : styles.ghostButtonText
        ]}>
          {title}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function AuthScreen({ onAuthSuccess, onSkipAuth }) {
  const [activeTab, setActiveTab] = useState('Sign in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(''); // BUG 2: Phone number
  const [role, setRole] = useState('Citizen');
  const [errorMsg, setErrorMsg] = useState('');
  const [verificationId, setVerificationId] = useState(null); // BUG 2: OTP flow
  const [otpCode, setOtpCode] = useState(''); // BUG 2: OTP code
  const [showOtpModal, setShowOtpModal] = useState(false); // BUG 2: OTP modal
  const [pendingUser, setPendingUser] = useState(null); // BUG 2: user awaiting phone link

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const dotOpacity = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    // Pulsing dot animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dotOpacity, {
          toValue: 0.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;

    // Animate out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveTab(tab);
      setErrorMsg('');

      // Animate in
      slideAnim.setValue(-10);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
      ]).start();
    });
  };

  const handleEmailAuth = async () => {
    try {
      setErrorMsg('');
      if (activeTab === 'Sign in') {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        onAuthSuccess(cred.user, false);
      } else {
        // Task 2: Phone number is required for sign up
        if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 10) {
          setErrorMsg('Phone number is required. Please enter a valid 10-digit number.');
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // Save user profile with phone number
        try {
          await setDoc(doc(firestore, 'users', cred.user.uid), {
            displayName: fullName || email.split('@')[0],
            email,
            role,
            phoneNumber: phoneNumber || null, // BUG 2: Store phone
            phoneVerified: false,
            createdAt: new Date(),
          }, { merge: true });
        } catch (e) {
          console.warn('Failed to save user role (non-fatal):', e.message);
        }

        // BUG 2: If phone number provided, initiate verification
        if (phoneNumber && Platform.OS === 'web') {
          try {
            // Web-only reCAPTCHA-based phone auth
            if (!window.recaptchaVerifier) {
              window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                size: 'invisible',
              });
            }
            const provider = new PhoneAuthProvider(auth);
            const vId = await provider.verifyPhoneNumber(phoneNumber, window.recaptchaVerifier);
            setVerificationId(vId);
            setPendingUser(cred.user);
            setShowOtpModal(true);
            return; // Don't call onAuthSuccess yet — wait for OTP
          } catch (phoneErr) {
            console.warn('Phone verification failed (non-fatal):', phoneErr.message);
            // Continue without phone verification
          }
        }

        onAuthSuccess(cred.user, true);
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // BUG 2: Verify OTP and link phone credential
  const handleVerifyOtp = async () => {
    try {
      setErrorMsg('');
      const credential = PhoneAuthProvider.credential(verificationId, otpCode);
      if (pendingUser) {
        await linkWithCredential(pendingUser, credential);
        // Mark phone as verified in Firestore
        await setDoc(doc(firestore, 'users', pendingUser.uid), {
          phoneVerified: true,
        }, { merge: true });
      }
      setShowOtpModal(false);
      setOtpCode('');
      setVerificationId(null);
      onAuthSuccess(pendingUser, true);
    } catch (err) {
      setErrorMsg('Invalid OTP: ' + err.message);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        const cred = await signInWithPopup(auth, provider);
        // Create user doc if first time
        try {
          const userDoc = await getDoc(doc(firestore, 'users', cred.user.uid));
          if (!userDoc.exists()) {
            await setDoc(doc(firestore, 'users', cred.user.uid), {
              displayName: cred.user.displayName || cred.user.email?.split('@')[0] || 'User',
              email: cred.user.email,
              role: 'Citizen',
              createdAt: new Date(),
            }, { merge: true });
          }
        } catch (e) {
          console.warn('User doc creation failed (non-fatal):', e.message);
        }
        onAuthSuccess(cred.user, true);
      } else {
        setErrorMsg('Google Sign-in on mobile requires native configuration (expo-auth-session or @react-native-google-signin). Use email sign-in for now.');
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleSkipAuth = async () => {
    try {
      await signInAnonymously(auth);
      onSkipAuth();
    } catch (err) {
      setErrorMsg(err.message);
      // Fallback if no firebase set up properly
      onSkipAuth();
    }
  };

  // No Admin self-signup — admin can only log in with existing credentials
  // No Admin or Responder self-signup — Responder is earned via role request approval
  const roles = ['Citizen', 'Volunteer'];

  return (
    <View style={styles.container}>
      {/* Background glow overlay */}
      <View style={styles.glowOverlay} />

      <View style={styles.content}>

        {/* Top Section */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Zap color="#fff" size={28} />
          </View>
          <Text style={styles.appName}>ReliefMesh</Text>
          <Text style={styles.subtitle}>Emergency response, even when networks fail</Text>

          <View style={styles.badgeContainer}>
            <Animated.View style={[styles.badgeDot, { opacity: dotOpacity }]} />
            <Text style={styles.badgeText}>MESH NETWORK ACTIVE</Text>
          </View>
        </View>

        {/* Auth Card */}
        <View style={styles.card}>
          <TabSwitcher
            tabs={['Sign in', 'Sign up']}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />

          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }}
          >
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            {activeTab === 'Sign up' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Name Surname"
                  placeholderTextColor="#4a4a5a"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                placeholder="Your_Email@gmail.com"
                placeholderTextColor="#4a4a5a"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="********"
                placeholderTextColor="#4a4a5a"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {activeTab === 'Sign up' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Role</Text>
                <View style={styles.rolePicker}>
                  {roles.map(r => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setRole(r)}
                      style={[styles.roleOption, role === r && styles.roleOptionActive]}
                    >
                      <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Phone number input (Sign Up only — required) */}
            {activeTab === 'Sign up' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone number <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '700' }}>(required *)</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="+91 XXXXX XXXXX"
                  placeholderTextColor="#4a4a5a"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                />
              </View>
            )}

            <View style={styles.buttonWrapper}>
              <AnimatedButton
                title={activeTab === 'Sign in' ? 'Sign in to ReliefMesh' : 'Create account'}
                onPress={handleEmailAuth}
                type="primary"
              />
            </View>

            {activeTab === 'Sign in' && (
              <>
                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <AnimatedButton
                  title="Continue with Google"
                  onPress={handleGoogleAuth}
                  type="ghost"
                  icon={<GoogleIcon />}
                />
              </>
            )}
          </Animated.View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <View style={styles.sosPrompt}>
            <Text style={styles.sosText}>In an emergency? </Text>
            <TouchableOpacity onPress={handleSkipAuth}>
              <Text style={styles.sosLink}>Send SOS without login →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chipsContainer}>
            <View style={styles.chip}><Text style={styles.chipText}>Offline mesh</Text></View>
            <View style={styles.chip}><Text style={styles.chipText}>Live SOS</Text></View>
            <View style={styles.chip}><Text style={styles.chipText}>Safe routing</Text></View>
          </View>
        </View>

      </View>

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <View style={styles.otpOverlay}>
          <View style={styles.otpCard}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 }}>Verify Phone</Text>
            <Text style={{ color: '#888', fontSize: 13, marginBottom: 20, lineHeight: 18 }}>
              Enter the 6-digit code sent to {phoneNumber}
            </Text>
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
            <TextInput
              style={[styles.input, { textAlign: 'center', fontSize: 24, letterSpacing: 8 }]}
              placeholder="000000"
              placeholderTextColor="#4a4a5a"
              keyboardType="number-pad"
              maxLength={6}
              value={otpCode}
              onChangeText={(code) => {
                setOtpCode(code);
                // Task 5: Auto-submit when 6 digits are entered
                if (code.length === 6) {
                  setTimeout(() => handleVerifyOtp(), 300);
                }
              }}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              autoFocus={true}
            />
            <View style={{ marginTop: 16 }}>
              <AnimatedButton title="Verify" onPress={handleVerifyOtp} type="primary" />
            </View>
            <TouchableOpacity onPress={() => { setShowOtpModal(false); onAuthSuccess(pendingUser, true); }} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: '#888', fontSize: 13 }}>Skip verification →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Invisible reCAPTCHA container (web only) */}
      {Platform.OS === 'web' && <View nativeID="recaptcha-container" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  glowOverlay: {
    position: 'absolute',
    top: -150,
    left: '50%',
    marginLeft: -250,
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: 'rgba(220, 38, 38, 0.10)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 56,
    height: 56,
    backgroundColor: '#dc2626',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  appName: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: '#8a8a9a',
    fontSize: 13,
    marginBottom: 16,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#dc2626',
    marginRight: 6,
  },
  badgeText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#13131a',
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: '#2a2a3a',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0a0a0f',
    borderRadius: 10,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#dc2626',
  },
  tabText: {
    color: '#6a6a7a',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#8a8a9a',
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#0d0d14',
    borderWidth: 1,
    borderColor: '#2a2a3a',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  rolePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    backgroundColor: '#0d0d14',
    borderWidth: 1,
    borderColor: '#2a2a3a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roleOptionActive: {
    borderColor: '#dc2626',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  roleText: {
    color: '#6a6a7a',
    fontSize: 12,
    fontWeight: '500',
  },
  roleTextActive: {
    color: '#dc2626',
  },
  buttonWrapper: {
    marginTop: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  primaryButton: {
    backgroundColor: '#dc2626',
  },
  ghostButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#fff',
  },
  ghostButtonText: {
    color: '#fff',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2a2a3a',
  },
  dividerText: {
    color: '#6a6a7a',
    paddingHorizontal: 12,
    fontSize: 13,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  bottomSection: {
    marginTop: 32,
    alignItems: 'center',
  },
  sosPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  sosText: {
    color: '#8a8a9a',
    fontSize: 14,
  },
  sosLink: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  chip: {
    backgroundColor: '#13131a',
    borderWidth: 1,
    borderColor: '#2a2a3a',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    color: '#6a6a7a',
    fontSize: 11,
    fontWeight: '500',
  },
  // BUG 2: OTP modal styles
  otpOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  otpCard: {
    backgroundColor: '#13131a',
    borderWidth: 1,
    borderColor: '#2a2a3a',
    borderRadius: 20,
    padding: 28,
    width: '85%',
    maxWidth: 380,
  },
});
