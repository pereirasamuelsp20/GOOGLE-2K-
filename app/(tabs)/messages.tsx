import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ChatBubble from '../../components/ChatBubble';
import HamburgerMenu from '../../components/HamburgerMenu';

/* ---------------- INDUSTRIAL COMMS DATA ---------------- */

const CONTACT_SECTIONS = [
  {
    title: 'EMERGENCY AUTHORITIES',
    data: [
      {
        id: 'NODE-FIRE',
        name: 'FIRE DISPATCH',
        category: 'Authority',
        lastMessage: 'UNIT 4-B ASSIGNED TO SECTOR 7.',
        time: '4m ago',
        verified: true,
        messages: [{ id: '1', text: 'REQUESTING SECTOR 7 STATUS.', sender: 'them', time: '10:00' }]
      },
      {
        id: 'NODE-MED',
        name: 'MEDICAL COMMAND',
        category: 'Authority',
        lastMessage: 'TRIAGE CENTER ESTABLISHED AT ZONE C.',
        time: '12m ago',
        verified: true,
        messages: [{ id: '1', text: 'ZONE C IS SECURE FOR TRIAGE.', sender: 'them', time: '09:45' }]
      },
      {
        id: 'NODE-POL',
        name: 'POLICE CENTRAL',
        category: 'Authority',
        lastMessage: 'PERIMETER SECURED. MAINTAIN POSITION.',
        time: '1h ago',
        verified: true,
        messages: [{ id: '1', text: 'MAINTAIN CURRENT POSITION.', sender: 'them', time: '09:00' }]
      }
    ]
  },
  {
    title: 'FAMILY & FRIENDS',
    data: [
      {
        id: 'PRIME-MOM',
        name: 'MOM (PRIME CONTACT)',
        category: 'Family',
        lastMessage: 'Stay in the safe zone.',
        time: '1h ago',
        verified: false,
        messages: [
          { id: '1', text: 'Are you secure?', sender: 'them', time: '09:00' },
          { id: '2', text: 'Secure. Safe zone reached.', sender: 'me', time: '09:05' }
        ]
      },
      {
        id: 'SEC-DAD',
        name: 'DAD',
        category: 'Family',
        lastMessage: 'Checking in. Power is out here.',
        time: '3h ago',
        verified: false,
        messages: [{ id: '1', text: 'All good. Power is cut.', sender: 'them', time: '07:30' }]
      }
    ]
  }
];

const QUICK_RESPONSES = [
  "I AM SAFE",
  "HELP NEEDED",
  "RETREATING",
  "ARRIVED AT ZONE",
];

/* ---------------- SCREEN ---------------- */

export default function Messages() {
  const [sections, setSections] = useState(CONTACT_SECTIONS);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');

  const selectedChat = sections.flatMap(s => s.data).find(c => c.id === selectedChatId);

  const handleSendMessage = () => {
    if (!inputText.trim() || !selectedChatId) return;

    const newMessage = {
      id: Date.now().toString(),
      text: inputText.trim().toUpperCase(),
      sender: 'me' as const,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setSections(prev => prev.map(section => ({
      ...section,
      data: section.data.map(chat => {
        if (chat.id === selectedChatId) {
          return {
            ...chat,
            lastMessage: newMessage.text,
            time: 'now',
            messages: [...chat.messages, newMessage],
          };
        }
        return chat;
      })
    })));

    setInputText('');
  };

  const renderChatItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.chatCard}
      onPress={() => setSelectedChatId(item.id)}
    >
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>
            {item.name} {item.verified && <Ionicons name="shield-checkmark" size={16} color="#C8102E" />}
          </Text>
          <Text style={styles.chatTime}>{item.time}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
        <TouchableOpacity style={styles.messageBtnInline}>
          <Text style={styles.messageBtnText}>MESSAGE</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (selectedChatId && selectedChat) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.chatRoomHeader}>
          <TouchableOpacity onPress={() => setSelectedChatId(null)} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#C8102E" />
          </TouchableOpacity>
          <View>
            <Text style={styles.chatRoomTitle}>{selectedChat.name}</Text>
            <Text style={styles.chatRoomStatus}>ENCRYPTED CHANNEL ACTIVE</Text>
          </View>
        </View>

        <FlatList
          data={selectedChat.messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatBubble
              text={item.text}
              sender={item.sender as any}
              time={item.time}
              isAuthority={selectedChat.category === 'Authority'}
            />
          )}
          contentContainerStyle={styles.messagesList}
        />

        <View style={styles.quickResponsesContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={QUICK_RESPONSES}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.quickBtn}
                onPress={() => setInputText(item)}
              >
                <Text style={styles.quickBtnText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder="TYPE TRANSMISSION..."
            placeholderTextColor="#4B5563"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>Crisis Center</Text>
        <View style={{ flex: 1 }} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderChatItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 150 }}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000",
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerTitle: {
    color: "#C8102E",
    fontSize: 24,
    fontWeight: "900",
    fontFamily: "System",
    fontStyle: 'italic',
    marginLeft: 15,
  },
  sectionHeader: {
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginTop: 10,
  },
  sectionHeaderText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  chatCard: {
    backgroundColor: '#09090b',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chatName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  chatTime: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
  },
  lastMessage: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 15,
  },
  messageBtnInline: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    width: 100,
    borderRadius: 4,
    alignItems: 'center',
  },
  messageBtnText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
  },
  /* CHAT ROOM */
  chatRoomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    marginRight: 15,
  },
  chatRoomTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  chatRoomStatus: {
    color: '#16A34A',
    fontSize: 10,
    fontWeight: '900',
  },
  messagesList: {
    padding: 15,
  },
  quickResponsesContainer: {
    paddingVertical: 15,
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  quickBtn: {
    backgroundColor: '#09090b',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 4,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  quickBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  input: {
    flex: 1,
    backgroundColor: '#09090b',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 4,
    marginRight: 10,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  sendBtn: {
    backgroundColor: '#C8102E',
    width: 48,
    height: 48,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
