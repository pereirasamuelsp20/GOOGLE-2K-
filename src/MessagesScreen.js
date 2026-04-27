import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert } from 'react-native';
import { auth, firestore } from './firebaseConfig';
import { collection, query, where, getDocs, doc, setDoc, onSnapshot, orderBy, serverTimestamp, addDoc, updateDoc } from 'firebase/firestore';
import { encryptPayload, decryptPayload, getPrivateKey } from './utils/nativeCrypto';

// Gracefully import QR code — needs react-native-svg
let QRCode = null;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch (e) {
  console.warn('react-native-qrcode-svg not available');
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Send, QrCode, Users, WifiOff } from 'lucide-react-native';

export default function MessagesScreen() {
  const [deviceCode, setDeviceCode] = useState('');
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactCode, setNewContactCode] = useState('');
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isOffline, setIsOffline] = useState(false); // Can be hooked to NetInfo in a full app

  const currentUser = auth.currentUser;
  const flatListRef = useRef();

  useEffect(() => {
    AsyncStorage.getItem('deviceCode').then(code => {
      if (code) setDeviceCode(code);
    });
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const q = collection(firestore, `users/${currentUser.uid}/contacts`);
    const unsub = onSnapshot(q, (snapshot) => {
      const c = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setContacts(c);
    });
    return () => unsub();
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

  if (!activeContact && !showAddContact) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Contacts</Text>
          <TouchableOpacity onPress={() => setShowAddContact(true)}>
            <QrCode color="#dc2626" size={24} />
          </TouchableOpacity>
        </View>
        
        {isOffline && (
          <View style={styles.banner}>
            <WifiOff size={16} color="#fca5a5" />
            <Text style={styles.bannerText}>Mesh Mode Active</Text>
          </View>
        )}

        <FlatList
          data={contacts}
          keyExtractor={c => c.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.contactRow} onPress={() => setActiveContact(item)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.substring(0,2).toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.contactName}>{item.name}</Text>
                <Text style={styles.contactCode}>{item.deviceCode.substring(0,8)}...</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>No contacts yet.</Text>}
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
