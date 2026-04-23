import type { BLEStatus, EmergencyType, Message, NearbyDevice } from './types';

export const COLORS = {
  bg: '#000000',
  bgDeep: '#060d1a',
  bgCard: '#0a0f1e',
  bgCardAlt: '#0d1526',
  border: '#1a2540',
  cyan: '#00d4ff',
  cyanDim: '#0ea5e9',
  blue: '#1a3a6e',
  blueBright: '#3b82f6',
  red: '#c8102e',
  amber: '#f59e0b',
  orange: '#f97316',
  green: '#22c55e',
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  textMuted: '#475569',
  textDim: '#334155',
};

export const EMERGENCY_META: Record<EmergencyType, { emoji: string; label: string; borderColor: string; glowColor: string }> = {
  fire:    { emoji: '🚨', label: 'Fire Emergency',            borderColor: '#f97316', glowColor: 'rgba(249,115,22,0.18)' },
  medical: { emoji: '🚑', label: 'Medical Assistance Needed', borderColor: '#c8102e', glowColor: 'rgba(200,16,46,0.18)'  },
  threat:  { emoji: '⚠️', label: 'Threat Nearby',             borderColor: '#f59e0b', glowColor: 'rgba(245,158,11,0.18)' },
};

export const STATUS_CONFIG: Record<BLEStatus, { text: string; color: string; bars: number }> = {
  connected: { text: 'Connected via Bluetooth',      color: '#22c55e', bars: 3 },
  searching: { text: 'Searching for nearby devices', color: '#f59e0b', bars: 1 },
  offline:   { text: 'Offline Mode Active',          color: '#475569', bars: 0 },
};

export const QUICK_ACTIONS = [
  { id: 'help',     label: 'Need Help',      color: '#c8102e' },
  { id: 'safe',     label: 'Safe',           color: '#22c55e' },
  { id: 'medical',  label: 'Medical',        color: '#f59e0b' },
  { id: 'fire',     label: 'Fire',           color: '#f97316' },
  { id: 'location', label: 'Share Location', color: '#0ea5e9' },
] as const;

export const QUICK_LABELS: Record<string, string> = {
  help:     '🆘 NEED HELP — Please assist immediately!',
  safe:     '✅ I AM SAFE — All clear on my end.',
  medical:  '🚑 MEDICAL NEEDED — Someone requires assistance.',
  fire:     '🚨 FIRE ALERT — Fire spotted! Evacuate now!',
  location: '📍 SHARING LOCATION — [Zone B, Grid 4-C]',
};

export const INITIAL_MESSAGES: Message[] = [
  {
    id: '1', sender: 'them', senderName: 'Priya K.',
    text: 'I am safe, currently at shelter zone B. How is everyone else?',
    time: '21:04', status: 'delivered', type: 'normal',
  },
  {
    id: '2', sender: 'me',
    text: 'Safe here. There is smoke coming from the north building.',
    time: '21:06', status: 'delivered', type: 'normal',
  },
  {
    id: '3', sender: 'them', senderName: 'Rajan M.',
    text: 'FIRE EMERGENCY — North wing, 3rd floor. Evacuate immediately via Stairwell A!',
    time: '21:08', status: 'delivered', type: 'emergency',
    emergencyType: 'fire', hasLocation: true,
  },
  {
    id: '4', sender: 'them', senderName: 'Asha T.',
    text: 'Person needs medical help near stairwell C. Ankle injury, cannot walk.',
    time: '21:10', status: 'delivered', type: 'emergency',
    emergencyType: 'medical', hasLocation: true,
  },
  {
    id: '5', sender: 'me',
    text: 'Moving to safe zone A now. Will confirm on arrival.',
    time: '21:11', status: 'delivered', type: 'normal',
  },
  {
    id: '6', sender: 'them', senderName: 'Rajan M.',
    text: 'Suspicious individual at east gate. Do not approach.',
    time: '21:13', status: 'delivered', type: 'emergency',
    emergencyType: 'threat',
  },
];

export const NEARBY_DEVICES: NearbyDevice[] = [
  { id: '1', initials: 'PK', name: 'Priya K.',  rssi: -55, status: 'connected', color: '#0ea5e9' },
  { id: '2', initials: 'RM', name: 'Rajan M.',  rssi: -68, status: 'connected', color: '#22c55e' },
  { id: '3', initials: 'AT', name: 'Asha T.',   rssi: -82, status: 'weak',      color: '#f59e0b' },
  { id: '4', initials: '?',  name: 'Unknown',   rssi: -96, status: 'searching', color: '#475569' },
];
