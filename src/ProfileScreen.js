import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, Platform, ActivityIndicator
} from 'react-native';
import { auth, firestore } from './firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { User, Mail, Shield, Edit3, LogOut, ChevronRight, AlertTriangle, Star, Phone, Clock } from 'lucide-react-native';

export default function ProfileScreen({ user, userRole: propRole, userName: propName, onSignOut, onNavigateToAuth }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const isAnonymous = !user || user.isAnonymous || user.uid === 'sys_anonymous' || user.uid?.startsWith('widget_');

  useEffect(() => {
    if (isAnonymous) {
      setProfile({ displayName: 'Anonymous Citizen', role: 'Citizen', email: null });
      setLoading(false);
      return;
    }
    const fetchProfile = async () => {
      try {
        const snap = await getDoc(doc(firestore, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          // Merge live role from App.js if available
          if (propRole) data.role = propRole;
          if (propName) data.displayName = propName;
          setProfile(data);
          setEditName(data.displayName || user.displayName || '');
        } else {
          const fallback = {
            displayName: propName || user.displayName || user.email?.split('@')[0] || 'User',
            email: user.email,
            role: propRole || 'Citizen',
          };
          setProfile(fallback);
          setEditName(fallback.displayName);
        }
      } catch (e) {
        setProfile({
          displayName: propName || user.displayName || 'User',
          email: user.email,
          role: propRole || 'Citizen',
        });
        setEditName(propName || user.displayName || 'User');
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user, propRole, propName]);

  const handleSaveName = async () => {
    if (!editName.trim() || isAnonymous) return;
    try {
      await setDoc(doc(firestore, 'users', user.uid), {
        displayName: editName.trim(),
      }, { merge: true });
      setProfile(p => ({ ...p, displayName: editName.trim() }));
      setEditing(false);
      Alert.alert('Updated', 'Display name saved.');
    } catch (e) {
      Alert.alert('Error', 'Could not update name.');
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of ReliefMesh?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out', style: 'destructive',
          onPress: () => {
            auth.signOut();
            if (onSignOut) onSignOut();
          }
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#dc2626" style={{ marginTop: 60 }} />
      </View>
    );
  }

  const initials = (profile?.displayName || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const roleBadgeColor = {
    Admin: '#dc2626',
    Responder: '#3b82f6',
    Volunteer: '#f59e0b',
    Citizen: '#22c55e',
  }[profile?.role] || '#6b7280';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Anonymous Banner */}
      {isAnonymous && (
        <View style={styles.anonBanner}>
          <AlertTriangle color="#fbbf24" size={18} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.anonBannerTitle}>You're browsing anonymously</Text>
            <Text style={styles.anonBannerSub}>Sign in to unlock all features like encrypted chat and profile customization.</Text>
          </View>
        </View>
      )}

      {/* Avatar Section */}
      <View style={styles.avatarSection}>
        <View style={[styles.avatarCircle, { borderColor: roleBadgeColor }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ marginTop: 16, alignItems: 'center' }}>
          {editing ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                autoFocus
                placeholderTextColor="#555"
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveName}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <Text style={{ color: '#888', marginLeft: 10 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.displayName}>{profile?.displayName || 'User'}</Text>
              {!isAnonymous && (
                <TouchableOpacity onPress={() => setEditing(true)}>
                  <Edit3 color="#888" size={16} />
                </TouchableOpacity>
              )}
            </View>
          )}
          <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor + '22', borderColor: roleBadgeColor }]}>
            <Text style={[styles.roleBadgeText, { color: roleBadgeColor }]}>{profile?.role || 'Citizen'}</Text>
          </View>
        </View>
      </View>

      {/* Info Cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACCOUNT DETAILS</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}><User color="#888" size={16} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>User ID</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {isAnonymous ? 'Anonymous' : user.uid?.substring(0, 20) + '...'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}><Mail color="#888" size={16} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>
                {isAnonymous ? 'Not available' : (profile?.email || user.email || 'Not set')}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}><Phone color="#888" size={16} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>
                {isAnonymous ? 'Not available' : (profile?.phone || 'Not set')}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}><Shield color="#888" size={16} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Account Type</Text>
              <Text style={styles.infoValue}>
                {isAnonymous ? 'Anonymous Session' : 'Registered Member'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}><Clock color="#888" size={16} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>
                {isAnonymous ? 'N/A' : (profile?.createdAt?.toDate ? profile.createdAt.toDate().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : (user.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown'))}
              </Text>
            </View>
          </View>

          {profile?.teamId && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}><Star color="#888" size={16} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Assigned Team</Text>
                  <Text style={styles.infoValue}>{profile.teamId.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</Text>
                </View>
              </View>
            </>
          )}

          {profile?.teamRole && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}><Shield color="#888" size={16} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Team Role</Text>
                  <Text style={styles.infoValue}>{profile.teamRole}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIONS</Text>

        {isAnonymous && onNavigateToAuth && (
          <TouchableOpacity style={styles.ctaButton} onPress={onNavigateToAuth}>
            <Text style={styles.ctaButtonText}>Create Account / Sign In</Text>
            <ChevronRight color="#fff" size={18} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut color="#FF3B30" size={18} />
          <Text style={styles.signOutText}>Sign Out Securely</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    paddingTop: 30,
  },
  anonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  anonBannerTitle: {
    color: '#fbbf24',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2,
  },
  anonBannerSub: {
    color: '#a0a0a0',
    fontSize: 12,
    lineHeight: 17,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#1a1a2e',
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
  },
  displayName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  roleBadge: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  editInput: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  saveBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 10,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#555',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#131313',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: {
    color: '#666',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    color: '#e0e0e0',
    fontSize: 15,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#1a1a2e',
    marginLeft: 66,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  ctaButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  signOutText: {
    color: '#FF3B30',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});
