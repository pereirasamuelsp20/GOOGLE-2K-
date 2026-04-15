import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ChatBubbleProps {
  text: string;
  sender: 'me' | 'them';
  time: string;
  isAuthority?: boolean;
}

export default function ChatBubble({ text, sender, time, isAuthority }: ChatBubbleProps) {
  const isMe = sender === 'me';

  return (
    <View style={[
      styles.container,
      isMe ? styles.meContainer : styles.themContainer
    ]}>
      <View style={[
        styles.bubble,
        isMe ? styles.meBubble : (isAuthority ? styles.authorityBubble : styles.themBubble)
      ]}>
        <Text style={[
          styles.text,
          isMe ? styles.meText : styles.themText
        ]}>
          {text}
        </Text>
        <Text style={[
          styles.time,
          isMe ? styles.meTime : styles.themTime
        ]}>
          {time}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 4,
    flexDirection: 'row',
  },
  meContainer: {
    justifyContent: 'flex-end',
  },
  themContainer: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    // Zero elevation/shadow
  },
  meBubble: {
    backgroundColor: '#C8102E', // Safety Red
    borderColor: '#ef4444',
  },
  themBubble: {
    backgroundColor: '#09090b', // TRUE BLACK/DARK
    borderColor: '#1e293b',
  },
  authorityBubble: {
    backgroundColor: '#000',
    borderColor: '#C8102E',
    borderWidth: 2,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'System',
  },
  meText: {
    color: '#fff',
  },
  themText: {
    color: '#fff', // WHITE ON BLACK
  },
  time: {
    fontSize: 10,
    marginTop: 6,
    fontWeight: '800',
    alignSelf: 'flex-end',
    fontFamily: 'System',
  },
  meTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  themTime: {
    color: '#6B7280',
  },
});
