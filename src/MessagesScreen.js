import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, SectionList, ActivityIndicator, Linking } from 'react-native';
import { auth, firestore } from './firebaseConfig';
import { collection, query, where, getDocs, doc, setDoc, onSnapshot, orderBy, serverTimestamp, addDoc, updateDoc } from 'firebase/firestore';
import { encryptPayload, decryptPayload, getPrivateKey } from './utils/nativeCrypto';

// BUG 2: Gracefully import expo-contacts
let Contacts = null;
try {
  Contacts = require('expo-contacts');
} catch (e) {
  console.warn('expo-contacts not available:', e.message);
}

// Gracefully import QR code — needs react-native-svg
let QRCode = null;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch (e) {
  console.warn('react-native-qrcode-svg not available');
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Send, QrCode, Users, WifiOff, Phone, UserPlus, Search } from 'lucide-react-native';

export default function MessagesScreen() {
  const [deviceCode, setDeviceCode] = useState('');
  const [contacts, setContacts] = useState([]);
  const [deviceContacts, setDeviceContacts] = useState([]); // BUG 2: Matched device contacts
  const [unmatchedContacts, setUnmatchedContacts] = useState([]); // BUG 2: Unmatched device contacts
  const [loadingContacts, setLoadingContacts] = useState(false); // BUG 2: Loading state
  const [contactSearch, setContactSearch] = useState(''); // BUG 2: Search filter
  const [activeContact, setActiveContact] = useState(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactCode, setNewContactCode] = useState('');
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isOffline, setIsOffline] = useState(false);

  const currentUser = auth.currentUser;
  const flatListRef = useRef();

  useEffect(() => {
    AsyncStorage.getItem('deviceCode').then(code => {
      if (code) setDeviceCode(code);
    });
  }, []);

  // Existing Firestore contacts listener
  useEffect(() => {
    if (!currentUser) return;
    const q = collection(firestore, `users/${currentUser.uid}/contacts`);
    const unsub = onSnapshot(q, (snapshot) => {
      const c = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setContacts(c);
    });
    return () => unsub();
  }, [currentUser]);

  // Normalize phone number: strip all non-digits, remove country code, keep last 10 digits
  const normalizePhone = (raw) => {
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    // Indian numbers: strip +91 or 91 prefix, keep last 10 digits
    if (digits.length > 10) {
      return digits.slice(-10);
    }
    return digits;
  };

  // Fetch device contacts and match against Firestore users
  useEffect(() => {
    if (!currentUser || !Contacts) return;
    
    const CACHE_KEY = `@reliefmesh_contacts_${currentUser.uid}`;
    
    // Load cached contacts immediately for instant display
    const loadCached = async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const { matched, unmatched, timestamp } = JSON.parse(cached);
          if (matched) setDeviceContacts(matched);
          if (unmatched) setUnmatchedContacts(unmatched);
          // If cache is fresh (< 5 min), skip background sync
          if (timestamp && Date.now() - timestamp < 5 * 60 * 1000) return false;
        }
      } catch (e) { /* ignore cache errors */ }
      return true; // should sync
    };

    const fetchDeviceContacts = async () => {
      try {
        const shouldSync = await loadCached();
        setLoadingContacts(shouldSync);
        
        if (!shouldSync) {
          setLoadingContacts(false);
          return;
        }
        
        const { status } = await Contacts.requestPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Contacts permission denied');
          setLoadingContacts(false);
          return;
        }

        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails, Contacts.Fields.Name],
          sort: Contacts.SortTypes.FirstName,
          pageSize: 200, // Limit to first 200 contacts
          pageOffset: 0,
        });

        if (!data || data.length === 0) {
          setLoadingContacts(false);
          return;
        }

        // Extract phone numbers AND emails from device contacts (limited set)
        const phoneMap = {}; // normalizedPhone -> contact info
        const emailMap = {}; // email -> contact info

        data.forEach(contact => {
          const contactName = contact.name || contact.firstName || 'Unknown';

          // Process phone numbers
          if (contact.phoneNumbers) {
            contact.phoneNumbers.forEach(pn => {
              const raw = pn.number || '';
              const normalized = normalizePhone(raw);
              if (normalized.length >= 10) {
                phoneMap[normalized] = {
                  name: contactName,
                  phone: raw,
                  normalizedPhone: normalized,
                };
              }
            });
          }

          // Process emails for broader matching
          if (contact.emails) {
            contact.emails.forEach(em => {
              const email = (em.email || '').toLowerCase().trim();
              if (email) {
                emailMap[email] = {
                  name: contactName,
                  email: email,
                };
              }
            });
          }
        });

        const normalizedPhones = Object.keys(phoneMap);
        const emails = Object.keys(emailMap);

        if (normalizedPhones.length === 0 && emails.length === 0) {
          setLoadingContacts(false);
          return;
        }

        // Query Firestore users in batches of 30 (increased from 10 for fewer round-trips)
        const matched = [];
        const matchedPhones = new Set();
        const matchedUids = new Set();

        // --- Match by normalized phone number only (no redundant alt-format queries) ---
        for (let i = 0; i < normalizedPhones.length; i += 30) {
          const batch = normalizedPhones.slice(i, i + 30);
          try {
            const q = query(collection(firestore, 'users'), where('phoneNumber', 'in', batch));
            const snap = await getDocs(q);
            snap.forEach(d => {
              const userData = d.data();
              if (d.id !== currentUser.uid && !matchedUids.has(d.id)) {
                const userNormalized = normalizePhone(userData.phoneNumber);
                const contactInfo = phoneMap[userNormalized] || phoneMap[userData.phoneNumber] || {};
                matched.push({
                  id: d.id,
                  uid: d.id,
                  name: userData.displayName || contactInfo.name || 'User',
                  deviceCode: userData.deviceCode || '',
                  publicKey: userData.publicKey || '',
                  phoneNumber: userData.phoneNumber,
                  localName: contactInfo.name,
                  source: 'device',
                });
                matchedPhones.add(userNormalized);
                matchedUids.add(d.id);
              }
            });
          } catch (e) {
            console.warn('[ContactSync] Phone batch query failed:', e.message);
          }
        }

        // --- Match by email (single pass, no alt formats) ---
        for (let i = 0; i < emails.length; i += 30) {
          const batch = emails.slice(i, i + 30);
          try {
            const q = query(collection(firestore, 'users'), where('email', 'in', batch));
            const snap = await getDocs(q);
            snap.forEach(d => {
              const userData = d.data();
              if (d.id !== currentUser.uid && !matchedUids.has(d.id)) {
                const contactInfo = emailMap[(userData.email || '').toLowerCase()] || {};
                matched.push({
                  id: d.id,
                  uid: d.id,
                  name: userData.displayName || contactInfo.name || 'User',
                  deviceCode: userData.deviceCode || '',
                  publicKey: userData.publicKey || '',
                  phoneNumber: userData.phoneNumber || '',
                  email: userData.email,
                  localName: contactInfo.name,
                  source: 'device',
                });
                matchedUids.add(d.id);
              }
            });
          } catch (e) {
            console.warn('[ContactSync] Email batch query failed:', e.message);
          }
        }

        setDeviceContacts(matched);

        // Build unmatched list (limit to first 50 for performance)
        const unmatched = Object.values(phoneMap)
          .filter(c => !matchedPhones.has(c.normalizedPhone))
          .slice(0, 50);
        setUnmatchedContacts(unmatched);
        setLoadingContacts(false);
        
        // Cache results for instant load next time
        try {
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
            matched, unmatched, timestamp: Date.now(),
          }));
        } catch (e) { /* ignore cache write errors */ }
      } catch (e) {
        console.warn('Device contacts fetch failed:', e.message);
        setLoadingContacts(false);
      }
    };

    fetchDeviceContacts();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !activeContact) {
      setMessages([]);
      return;
    }

    const conversationId = [currentUser.uid, activeContact.uid].sort().join('_');
    const q = query(collection(firestore, `messages/${conversationId}/msgs`), orderBy('timestamp', 'asc'));
    
    const unsub = onSnapshot(q, async (snapshot) => {
      const privateKey = await getPrivateKey();
      const msgs = [];

      for (const d of snapshot.docs) {
        const data = d.data();
        let decryptedText = "[Encrypted Content]";
        
        if (data.senderUid === currentUser.uid) {
          if (data.encryptedPayloadSender && data.encryptedAesKeySender && data.ivSender) {
             const decStr = await decryptPayload(privateKey, data.encryptedPayloadSender, data.encryptedAesKeySender, data.ivSender);
             if (decStr) decryptedText = decStr;
          }
        } else {
          if (data.encryptedPayload && data.encryptedAesKey && data.iv) {
             const decStr = await decryptPayload(privateKey, data.encryptedPayload, data.encryptedAesKey, data.iv);
             if (decStr) decryptedText = decStr;
          }
          if (data.status !== 'read') {
            updateDoc(d.ref, { status: 'read' });
          }
        }
        msgs.push({ id: d.id, ...data, decryptedText });
      }
      setMessages(msgs);
    });

    return () => unsub();
  }, [currentUser, activeContact]);

  const handleAddContact = async () => {
    if (!newContactCode.trim()) return;
    try {
      const q = query(collection(firestore, 'users'), where('deviceCode', '==', newContactCode.trim()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        Alert.alert("Error", "User not found.");
        return;
      }
      
      const userDoc = snap.docs[0];
      const userData = userDoc.data();

      if (userDoc.id === currentUser.uid) {
        Alert.alert("Error", "You can't add yourself.");
        return;
      }

      await setDoc(doc(firestore, `users/${currentUser.uid}/contacts`, userDoc.id), {
        uid: userDoc.id,
        name: userData.displayName || 'Unknown',
        deviceCode: userData.deviceCode,
        publicKey: userData.publicKey,
        addedAt: serverTimestamp()
      });

      setNewContactCode('');
      setShowAddContact(false);
    } catch (e) {
      Alert.alert("Error", "Failed to add contact.");
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !activeContact || !currentUser) return;
    const text = inputText.trim();
    setInputText('');

    try {
      const myUserSnap = await getDocs(query(collection(firestore, 'users'), where('deviceCode', '==', deviceCode)));
      const myPublicKey = myUserSnap.docs[0].data().publicKey;

      const encRecipient = await encryptPayload(activeContact.publicKey, text);
      const encSender = await encryptPayload(myPublicKey, text);

      const conversationId = [currentUser.uid, activeContact.uid].sort().join('_');
      
      await addDoc(collection(firestore, `messages/${conversationId}/msgs`), {
        senderUid: currentUser.uid,
        type: 'text',
        timestamp: serverTimestamp(),
        status: 'sent',
        encryptedPayload: encRecipient.encryptedPayload,
        encryptedAesKey: encRecipient.encryptedAesKey,
        encryptedPayloadSender: encSender.encryptedPayload,
        encryptedAesKeySender: encSender.encryptedAesKey,
        iv: encRecipient.iv, 
        ivSender: encSender.iv
      });
    } catch (e) {
      Alert.alert("Error", "Failed to send message.");
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.senderUid === currentUser?.uid;
    return (
      <View style={[styles.msgBubble, isMe ? styles.msgMe : styles.msgThem]}>
        <Text style={styles.msgText}>{item.decryptedText}</Text>
      </View>
    );
  };

  // BUG 2: Handle tapping a device contact (auto-add to Firestore contacts)
  const handleDeviceContactTap = async (contact) => {
    try {
      // Add to Firestore contacts subcollection if not already there
      const existingContact = contacts.find(c => c.uid === contact.uid);
      if (!existingContact) {
        await setDoc(doc(firestore, `users/${currentUser.uid}/contacts`, contact.uid), {
          uid: contact.uid,
          name: contact.localName || contact.name,
          deviceCode: contact.deviceCode,
          publicKey: contact.publicKey,
          phoneNumber: contact.phoneNumber,
          source: 'device',
          addedAt: serverTimestamp()
        });
      }
      setActiveContact(contact);
    } catch (e) {
      Alert.alert('Error', 'Failed to start chat: ' + e.message);
    }
  };

  // BUG 2: Invite unmatched contact via SMS
  const handleInviteContact = (contact) => {
    const message = `Hey! Join me on ReliefMesh for emergency response and mesh networking. Download: https://reliefmesh.app`;
    const url = `sms:${contact.phone}?body=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Invite Sent', `Ask ${contact.name} to join ReliefMesh!`);
    });
  };

  // BUG 2: Combine all contacts and filter by search
  const allContacts = [
    ...contacts.map(c => ({ ...c, source: c.source || 'mesh' })),
    ...deviceContacts.filter(dc => !contacts.find(c => c.uid === dc.uid)),
  ];

  const filteredContacts = contactSearch
    ? allContacts.filter(c => (c.name || '').toLowerCase().includes(contactSearch.toLowerCase()))
    : allContacts;

  const filteredUnmatched = contactSearch
    ? unmatchedContacts.filter(c => (c.name || '').toLowerCase().includes(contactSearch.toLowerCase()))
    : unmatchedContacts;

  if (!activeContact && !showAddContact) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Contacts</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => setShowAddContact(true)}>
              <QrCode color="#dc2626" size={24} />
            </TouchableOpacity>
          </View>
        </View>
        
        {isOffline && (
          <View style={styles.banner}>
            <WifiOff size={16} color="#fca5a5" />
            <Text style={styles.bannerText}>Mesh Mode Active</Text>
          </View>
        )}

        {/* BUG 2: Search bar */}
        <View style={{ paddingHorizontal: 15, paddingTop: 10, paddingBottom: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f1f2e', borderRadius: 10, paddingHorizontal: 12 }}>
            <Search color="#555" size={16} />
            <TextInput
              style={{ flex: 1, color: '#fff', padding: 10, fontSize: 14 }}
              placeholder="Search contacts..."
              placeholderTextColor="#555"
              value={contactSearch}
              onChangeText={setContactSearch}
            />
          </View>
        </View>

        {loadingContacts && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#dc2626" />
            <Text style={{ color: '#888', fontSize: 12, marginTop: 8 }}>Syncing device contacts...</Text>
          </View>
        )}

        <FlatList
          data={[
            ...(filteredContacts.length > 0 ? [{ type: 'section', title: `RELIEFMESH CONTACTS (${filteredContacts.length})` }] : []),
            ...filteredContacts.map(c => ({ type: 'contact', ...c })),
            ...(filteredUnmatched.length > 0 ? [{ type: 'section', title: `INVITE TO RELIEFMESH (${filteredUnmatched.length})` }] : []),
            ...filteredUnmatched.map(c => ({ type: 'unmatched', ...c })),
          ]}
          keyExtractor={(item, i) => item.id || item.normalizedPhone || `section-${i}`}
          renderItem={({ item }) => {
            if (item.type === 'section') {
              return (
                <View style={{ paddingHorizontal: 15, paddingTop: 16, paddingBottom: 6 }}>
                  <Text style={{ color: '#555', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>{item.title}</Text>
                </View>
              );
            }
            if (item.type === 'unmatched') {
              return (
                <View style={[styles.contactRow, { opacity: 0.6 }]}>
                  <View style={[styles.avatar, { backgroundColor: '#1a1a2a' }]}>
                    <Phone color="#555" size={16} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.contactName, { color: '#888' }]}>{item.name}</Text>
                    <Text style={styles.contactCode}>{item.phone}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleInviteContact(item)}
                    style={{ backgroundColor: 'rgba(220,38,38,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <UserPlus color="#dc2626" size={12} />
                    <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '700' }}>Invite</Text>
                  </TouchableOpacity>
                </View>
              );
            }
            return (
              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => item.source === 'device' ? handleDeviceContactTap(item) : setActiveContact(item)}
              >
                <View style={[styles.avatar, item.source === 'device' && { borderWidth: 1, borderColor: '#22c55e40' }]}>
                  <Text style={styles.avatarText}>{(item.name || '??').substring(0,2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{item.localName || item.name}</Text>
                  <Text style={styles.contactCode}>
                    {item.source === 'device' ? '📱 From contacts' : (item.deviceCode ? item.deviceCode.substring(0,8) + '...' : 'Mesh user')}
                  </Text>
                </View>
                {item.source === 'device' && (
                  <View style={{ backgroundColor: 'rgba(34,197,94,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ color: '#22c55e', fontSize: 9, fontWeight: '700' }}>PHONE</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            !loadingContacts ? (
              <Text style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>No contacts yet. Add via QR code or sync your phone contacts.</Text>
            ) : null
          }
        />
      </View>
    );
  }

  if (showAddContact) {
    return (
      <View style={[styles.container, { justifyContent: 'center', padding: 30 }]}>
        <Text style={styles.headerTitle}>Share Identity</Text>
        <View style={{ backgroundColor: 'white', padding: 20, alignSelf: 'center', borderRadius: 10, marginVertical: 20 }}>
          {deviceCode && QRCode ? <QRCode value={deviceCode} size={200} /> : <Text style={{ color: '#333', textAlign: 'center' }}>{deviceCode || 'Generating...'}</Text>}
        </View>
        <Text style={{ color: '#888', textAlign: 'center', marginBottom: 20 }}>Code: {deviceCode}</Text>

        <TextInput
          style={styles.input}
          placeholder="Paste device code..."
          placeholderTextColor="#666"
          value={newContactCode}
          onChangeText={setNewContactCode}
        />
        <TouchableOpacity style={styles.primaryButton} onPress={handleAddContact}>
          <Text style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>Add Contact</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 20 }} onPress={() => setShowAddContact(false)}>
          <Text style={{ color: '#888', textAlign: 'center' }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={() => setActiveContact(null)} style={{ padding: 10 }}>
          <Text style={{ color: '#dc2626' }}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{activeContact.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: 15 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Encrypted message..."
          placeholderTextColor="#666"
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Send color="white" size={20} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f', paddingTop: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#1f1f2e' },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  banner: { backgroundColor: '#450a0a', padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  bannerText: { color: '#fca5a5', fontWeight: 'bold' },
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#1f1f2e' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1f1f2e', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  avatarText: { color: '#dc2626', fontWeight: 'bold' },
  contactName: { color: 'white', fontSize: 16, fontWeight: '500' },
  contactCode: { color: '#888', fontSize: 12 },
  input: { backgroundColor: '#1f1f2e', color: 'white', padding: 15, borderRadius: 8, marginBottom: 15 },
  primaryButton: { backgroundColor: '#dc2626', padding: 15, borderRadius: 8 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#1f1f2e', backgroundColor: '#13131a' },
  msgBubble: { padding: 12, borderRadius: 16, marginBottom: 10, maxWidth: '75%' },
  msgMe: { backgroundColor: '#dc2626', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  msgThem: { backgroundColor: '#1f1f2e', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  msgText: { color: 'white', fontSize: 15 },
  composer: { flexDirection: 'row', padding: 15, backgroundColor: '#13131a', alignItems: 'center', gap: 10 },
  composerInput: { flex: 1, backgroundColor: '#1f1f2e', color: 'white', padding: 12, borderRadius: 20 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' }
});
