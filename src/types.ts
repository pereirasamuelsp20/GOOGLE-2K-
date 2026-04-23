export type DeliveryStatus = 'sending' | 'delivered' | 'waiting' | 'stored';
export type MessageType = 'normal' | 'emergency';
export type EmergencyType = 'fire' | 'medical' | 'threat';
export type BLEStatus = 'connected' | 'searching' | 'offline';
export type DeviceStatus = 'connected' | 'weak' | 'searching';

export interface Message {
  id: string;
  sender: 'me' | 'them';
  senderName?: string;
  text: string;
  time: string;
  status: DeliveryStatus;
  type: MessageType;
  emergencyType?: EmergencyType;
  hasLocation?: boolean;
}

export interface NearbyDevice {
  id: string;
  initials: string;
  name: string;
  rssi: number;
  status: DeviceStatus;
  color: string;
}
