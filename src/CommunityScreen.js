import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { auth, firestore } from './firebaseConfig';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { hashSignature, verifySignature } from './utils/nativeCrypto';
import { ShieldAlert, ShieldCheck, Plus, X, Trash2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Activity icon was renamed in some lucide versions — use safe fallback
let ActivityIcon = null;
try {
  ActivityIcon = require('lucide-react-native').Activity;
} catch (e) {
  // Ignore — we'll use text fallback
}

const GLOBAL_CHANNEL = 'global_emergency';

export default function CommunityScreen() {
  const [posts, setPosts] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(firestore, 'users', currentUser.uid)).then(uDoc => {
      if (uDoc.exists() && (uDoc.data().role === 'Admin' || uDoc.data().role === 'Responder')) {
        setIsAdmin(true);
      }
    });
  }, [currentUser]);

  useEffect(() => {
    const q = query(collection(firestore, `channels/${GLOBAL_CHANNEL}/posts`), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, async (snapshot) => {
      const newPosts = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        const isValid = await verifySignature(data.signature, data.content, data.timestampStr, data.adminUid);
        newPosts.push({ id: d.id, ...data, verified: isValid });
      }
      setPosts(newPosts);
    });
    return () => unsub();
  }, []);

  const handleDeletePost = (postId) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(firestore, `channels/${GLOBAL_CHANNEL}/posts`, postId));
            } catch (e) {
              Alert.alert('Error', 'Failed to delete post.');
            }
          }
        }
      ]
    );
  };

  const renderPost = ({ item }) => {
    const canDelete = currentUser && (item.adminUid === currentUser.uid || isAdmin);
    return (
    <View style={[styles.postCard, item.urgent && styles.urgentCard]}>
      {item.urgent && <Text style={styles.urgentBadge}>URGENT</Text>}
      <View style={styles.postHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Text style={styles.adminName}>{item.adminName || 'Admin'}</Text>
          {item.verified ? <ShieldCheck color="#10b981" size={16} /> : <ShieldAlert color="#ef4444" size={16} />}
        </View>
        {canDelete && (
          <TouchableOpacity onPress={() => handleDeletePost(item.id)} style={{ padding: 4 }}>
            <Trash2 color="#666" size={16} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.postContent}>{item.content}</Text>
      {item.tags && (
        <View style={styles.tagsContainer}>
          {item.tags.map(t => <Text key={t} style={styles.tag}>#{t}</Text>)}
        </View>
      )}
    </View>
  );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {ActivityIcon ? <ActivityIcon color="#dc2626" size={24} /> : <Text style={{ color: '#dc2626', fontWeight: 'bold' }}>⚡</Text>}
        <Text style={styles.headerTitle}>Community Updates</Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        renderItem={renderPost}
        contentContainerStyle={{ padding: 20 }}
      />

      {isAdmin && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowComposer(true)}>
          <Plus color="white" size={28} />
        </TouchableOpacity>
      )}

      {showComposer && (
        <ComposerModal 
          onClose={() => setShowComposer(false)} 
          currentUser={currentUser} 
        />
      )}
    </View>
  );
}

function ComposerModal({ onClose, currentUser }) {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState([]);

  const toggleTag = (t) => tags.includes(t) ? setTags(tags.filter(x => x !== t)) : setTags([...tags, t]);

  const handlePost = async () => {
    if (!content.trim() || !currentUser) return;
    try {
      const tsStr = Date.now().toString();
      const sig = await hashSignature(content, tsStr, currentUser.uid);

      await addDoc(collection(firestore, `channels/${GLOBAL_CHANNEL}/posts`), {
        adminUid: currentUser.uid,
        adminName: currentUser.displayName || 'Admin',
        content: content.trim(),
        tags,
        urgent: false,
        timestampStr: tsStr,
        signature: sig,
        timestamp: serverTimestamp()
      });
      onClose();
    } catch (e) {
      Alert.alert("Error", "Failed to post update.");
    }
  };

  return (
    <Modal animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Broadcast Update</Text>
            <TouchableOpacity onPress={onClose}><X color="#888" size={24} /></TouchableOpacity>
          </View>
          
          <TextInput
            style={styles.textArea}
            multiline
            placeholder="Type your emergency update..."
            placeholderTextColor="#666"
            value={content}
            onChangeText={setContent}
          />
          
          <View style={styles.tagsContainer}>
            {['Evacuation', 'Medical', 'Food', 'Shelter'].map(t => (
              <TouchableOpacity key={t} style={[styles.tagButton, tags.includes(t) && styles.tagButtonActive]} onPress={() => toggleTag(t)}>
                <Text style={{ color: 'white', fontSize: 12 }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.postBtn} onPress={handlePost}>
            <Text style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>Publish Update</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f', paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, borderBottomWidth: 1, borderColor: '#1f1f2e' },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  postCard: { backgroundColor: '#13131a', padding: 20, borderRadius: 12, marginBottom: 15 },
  urgentCard: { borderLeftWidth: 4, borderColor: '#dc2626' },
  urgentBadge: { color: '#dc2626', fontWeight: 'bold', fontSize: 10, marginBottom: 5 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  adminName: { color: 'white', fontWeight: 'bold' },
  postContent: { color: '#ccc', fontSize: 15, lineHeight: 22 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15 },
  tag: { color: '#a78bfa', backgroundColor: '#1f1f2e', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, fontSize: 11 },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', elevation: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#13131a', padding: 25, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  textArea: { backgroundColor: '#1f1f2e', color: 'white', height: 120, borderRadius: 12, padding: 15, textAlignVertical: 'top' },
  tagButton: { backgroundColor: '#1f1f2e', padding: 8, borderRadius: 16, marginTop: 10 },
  tagButtonActive: { backgroundColor: '#dc2626' },
  postBtn: { backgroundColor: '#dc2626', padding: 15, borderRadius: 12, marginTop: 20 }
});
