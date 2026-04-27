import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, onSnapshot, orderBy, serverTimestamp, addDoc, updateDoc } from 'firebase/firestore';
import { useMesh } from '../components/MeshProvider';
import { encryptPayload, decryptPayload, getPrivateKey, textToArrayBuffer, arrayBufferToText } from '../utils/crypto';
import imageCompression from 'browser-image-compression';
import { generateSmartReplies } from '../utils/ai';
import { Send, Image as ImageIcon, Check, CheckCheck, Wifi, WifiOff, Users, QrCode } from 'lucide-react';

export default function MessagesScreen() {
  const { deviceCode, networkStatus } = useMesh();
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactCode, setNewContactCode] = useState('');
  const [addError, setAddError] = useState('');

  // Messages state
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [smartReplies, setSmartReplies] = useState([]);
  const messagesEndRef = useRef(null);
  
  const currentUser = auth.currentUser;

  // Load Contacts
  useEffect(() => {
    if (!currentUser) return;
    const q = collection(db, `users/${currentUser.uid}/contacts`);
    const unsub = onSnapshot(q, (snapshot) => {
      const c = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setContacts(c);
    });
    return () => unsub();
  }, [currentUser]);

  // Load Messages for active contact
  useEffect(() => {
    if (!currentUser || !activeContact) {
      setMessages([]);
      return;
    }

    const conversationId = [currentUser.uid, activeContact.uid].sort().join('_');
    const q = query(collection(db, `messages/${conversationId}/msgs`), orderBy('timestamp', 'asc'));
    
    const unsub = onSnapshot(q, async (snapshot) => {
      const privateKey = await getPrivateKey();
      if (!privateKey) return;

      const msgs = [];
      const newMsgsForAi = [];

      for (const d of snapshot.docs) {
        const data = d.data();
        let decryptedText = "[Encrypted Content]";
        
        if (data.senderUid === currentUser.uid) {
          // If I sent it, I technically cannot decrypt it unless I store the AES key encrypted with my own pubkey too.
          // For this prototype, to show sent messages, I would need a local queue or dual-encryption.
          // WhatsApp uses dual-encryption (encrypts a copy for sender and copy for recipient).
          // To keep this simple and strictly E2E as requested, let's assume we can only decrypt received,
          // BUT wait, we need to see our own sent messages! 
          // I will dual-encrypt in the send function (store `encryptedPayloadSender` and `encryptedAesKeySender`).
          
          if (data.encryptedPayloadSender && data.encryptedAesKeySender && data.iv) {
            const decBuf = await decryptPayload(privateKey, data.encryptedPayloadSender, data.encryptedAesKeySender, data.iv);
            if (decBuf) decryptedText = arrayBufferToText(decBuf);
          } else {
             decryptedText = data.originalText || "[Cannot read own msg without dual encryption]"; 
          }
        } else {
          // Received message
          if (data.encryptedPayload && data.encryptedAesKey && data.iv) {
            const decBuf = await decryptPayload(privateKey, data.encryptedPayload, data.encryptedAesKey, data.iv);
            if (decBuf) decryptedText = arrayBufferToText(decBuf);
          }
          newMsgsForAi.push({ sender: activeContact.name, text: decryptedText });
          
          // Mark as read if not already
          if (data.status !== 'read') {
            updateDoc(d.ref, { status: 'read' });
          }
        }

        msgs.push({ id: d.id, ...data, decryptedText });
      }
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

      // Generate Smart Replies
      if (newMsgsForAi.length > 0) {
        const last3 = newMsgsForAi.slice(-3);
        const replies = await generateSmartReplies(last3);
        setSmartReplies(replies);
      } else {
        setSmartReplies([]);
      }
    });

    return () => unsub();
  }, [currentUser, activeContact]);

  const handleAddContact = async () => {
    if (!newContactCode.trim()) return;
    setAddError('');
    try {
      const q = query(collection(db, 'users'), where('deviceCode', '==', newContactCode.trim()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setAddError('User not found.');
        return;
      }
      
      const userDoc = snap.docs[0];
      const userData = userDoc.data();
      
      if (userDoc.id === currentUser.uid) {
        setAddError("You can't add yourself.");
        return;
      }

      await setDoc(doc(db, `users/${currentUser.uid}/contacts`, userDoc.id), {
        uid: userDoc.id,
        name: userData.displayName || 'Unknown',
        deviceCode: userData.deviceCode,
        publicKey: userData.publicKey,
        addedAt: serverTimestamp()
      });

      setNewContactCode('');
      setShowAddContact(false);
    } catch (e) {
      console.error(e);
      setAddError('Failed to add contact.');
    }
  };

  const handleSend = async (text) => {
    if (!text.trim() || !activeContact || !currentUser) return;
    const payloadText = text.trim();
    setInputText('');
    setSmartReplies([]);

    try {
      // Get my own public key for dual encryption
      const myUserSnap = await getDocs(query(collection(db, 'users'), where('deviceCode', '==', deviceCode)));
      const myPublicKey = myUserSnap.docs[0].data().publicKey;

      // Encrypt for recipient
      const encRecipient = await encryptPayload(activeContact.publicKey, textToArrayBuffer(payloadText));
      
      // Encrypt for sender (myself) so I can read it later on other devices
      const encSender = await encryptPayload(myPublicKey, textToArrayBuffer(payloadText));

      const conversationId = [currentUser.uid, activeContact.uid].sort().join('_');
      
      await addDoc(collection(db, `messages/${conversationId}/msgs`), {
        senderUid: currentUser.uid,
        type: 'text',
        timestamp: serverTimestamp(),
        status: 'sent',
        
        // Recipient fields
        encryptedPayload: encRecipient.encryptedPayload,
        encryptedAesKey: encRecipient.encryptedAesKey,
        
        // Sender fields
        encryptedPayloadSender: encSender.encryptedPayload,
        encryptedAesKeySender: encSender.encryptedAesKey,
        
        // Shared IV (we can use recipient's IV for both since AES payload is different per RSA encryption... wait, the AES payload is different because we generated a new AES key for the sender. So we need sender IV too. Let's just store the sender's IV as well)
        iv: encRecipient.iv, 
        ivSender: encSender.iv,

        // Keeping original text ONLY for prototype quick-view if crypto fails (NOT FOR PROD!)
        // I will omit it to adhere to E2E.
      });

    } catch (e) {
      console.error("Send failed", e);
      alert("Failed to send encrypted message.");
    }
  };

  const isMeshMode = networkStatus === 'offline';

  return (
    <div style={{ display: 'flex', height: '100vh', paddingTop: 60, backgroundColor: '#0a0a0f', color: 'white' }}>
      
      {/* Sidebar */}
      <div style={{ width: 320, borderRight: '1px solid #1f1f2e', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 20, borderBottom: '1px solid #1f1f2e' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Users size={20} color="#dc2626" /> Contacts
            </h2>
            <button 
              onClick={() => setShowAddContact(true)}
              style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer' }}
            >
              <QrCode size={20} />
            </button>
          </div>

          {/* Network Banner */}
          <div style={{ 
            padding: 8, borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
            backgroundColor: isMeshMode ? '#450a0a' : '#064e3b',
            color: isMeshMode ? '#fca5a5' : '#a7f3d0'
          }}>
            {isMeshMode ? <WifiOff size={14} /> : <Wifi size={14} />}
            {isMeshMode ? 'Mesh mode active' : 'Internet Connected'}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {contacts.map(c => (
            <div 
              key={c.id} 
              onClick={() => setActiveContact(c)}
              style={{ 
                padding: '15px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 15,
                backgroundColor: activeContact?.id === c.id ? '#13131a' : 'transparent',
                borderBottom: '1px solid #1f1f2e'
              }}
            >
              <div style={{ 
                width: 40, height: 40, borderRadius: 20, backgroundColor: '#1f1f2e', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#dc2626'
              }}>
                {c.name.substring(0,2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{c.deviceCode.substring(0,8)}...</div>
              </div>
            </div>
          ))}
          {contacts.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 14 }}>
              No contacts yet. Tap the QR icon to add someone.
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0a0a0f' }}>
        {activeContact ? (
          <>
            <div style={{ padding: '15px 20px', borderBottom: '1px solid #1f1f2e', backgroundColor: '#13131a', display: 'flex', alignItems: 'center', gap: 15 }}>
              <div style={{ 
                width: 40, height: 40, borderRadius: 20, backgroundColor: '#1f1f2e', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#dc2626'
              }}>
                {activeContact.name.substring(0,2).toUpperCase()}
              </div>
              <div style={{ fontWeight: 600 }}>{activeContact.name}</div>
            </div>

            <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.map(m => {
                const isMe = m.senderUid === currentUser?.uid;
                return (
                  <div key={m.id} style={{ 
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '70%',
                    backgroundColor: isMe ? '#dc2626' : '#1f1f2e',
                    padding: '10px 15px',
                    borderRadius: 16,
                    borderBottomRightRadius: isMe ? 4 : 16,
                    borderBottomLeftRadius: isMe ? 16 : 4,
                  }}>
                    <div style={{ fontSize: 15, wordBreak: 'break-word' }}>{m.decryptedText}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'right', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      {m.timestamp ? new Date(m.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                      {isMe && (
                        m.status === 'read' ? <CheckCheck size={12} color="#60a5fa" /> :
                        m.status === 'delivered' ? <CheckCheck size={12} /> :
                        <Check size={12} />
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Smart Replies */}
            {smartReplies.length > 0 && (
              <div style={{ display: 'flex', gap: 10, padding: '0 20px', marginBottom: 10 }}>
                {smartReplies.map((reply, idx) => (
                  <button 
                    key={idx}
                    onClick={() => handleSend(reply)}
                    style={{
                      background: 'transparent', border: '1px solid #dc2626', color: '#dc2626',
                      padding: '6px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer'
                    }}
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* Composer */}
            <div style={{ padding: 20, backgroundColor: '#13131a', display: 'flex', gap: 10, alignItems: 'center' }}>
              <button style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                <ImageIcon size={24} />
              </button>
              <input 
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend(inputText)}
                placeholder="Type an encrypted message..."
                style={{ 
                  flex: 1, padding: '12px 20px', borderRadius: 24, border: 'none', 
                  backgroundColor: '#1f1f2e', color: 'white', outline: 'none'
                }}
              />
              <button 
                onClick={() => handleSend(inputText)}
                style={{ 
                  width: 40, height: 40, borderRadius: 20, backgroundColor: '#dc2626', 
                  border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}
              >
                <Send size={18} style={{ marginLeft: -2 }} />
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
            Select a contact to start messaging
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddContact && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000
        }}>
          <div className="glass-panel" style={{ padding: 30, maxWidth: 400, width: '100%', textAlign: 'center', backgroundColor: '#13131a' }}>
            <h2 style={{ marginBottom: 20 }}>Share Identity</h2>
            
            <div style={{ backgroundColor: 'white', padding: 20, borderRadius: 12, display: 'inline-block', marginBottom: 20 }}>
              <QRCodeSVG value={deviceCode || ''} size={200} />
            </div>
            
            <p style={{ color: '#888', fontSize: 13, marginBottom: 5 }}>Your Device Code:</p>
            <div style={{ padding: 10, backgroundColor: '#1f1f2e', borderRadius: 8, fontFamily: 'monospace', fontSize: 14, marginBottom: 30 }}>
              {deviceCode}
            </div>

            <hr style={{ borderColor: '#333', marginBottom: 20 }} />

            <h3 style={{ fontSize: 16, marginBottom: 15 }}>Add a Contact</h3>
            <input 
              type="text" 
              value={newContactCode}
              onChange={e => setNewContactCode(e.target.value)}
              placeholder="Paste device code here..."
              style={{ 
                width: '100%', padding: 12, borderRadius: 8, 
                backgroundColor: '#1f1f2e', border: '1px solid #333',
                color: 'white', marginBottom: 10
              }}
            />
            {addError && <p style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{addError}</p>}
            
            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                onClick={() => setShowAddContact(false)}
                style={{ flex: 1, padding: 12, borderRadius: 8, background: '#333', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleAddContact}
                style={{ flex: 1, padding: 12, borderRadius: 8, background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Add Contact
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
