import localforage from 'localforage';

const KEY_PAIR_ALGO = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

// --- Identity & Keys ---

export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    KEY_PAIR_ALGO,
    true,
    ["encrypt", "decrypt"]
  );

  const privateKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);
  await localforage.setItem('mesh_private_key', privateKeyJwk);

  const publicKeySpki = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const publicKeyB64 = arrayBufferToBase64(publicKeySpki);

  return publicKeyB64;
}

export async function getPrivateKey() {
  const jwk = await localforage.getItem('mesh_private_key');
  if (!jwk) return null;
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    KEY_PAIR_ALGO,
    true,
    ["decrypt"]
  );
}

export async function hasPrivateKey() {
  const jwk = await localforage.getItem('mesh_private_key');
  return !!jwk;
}

// --- Hybrid Encryption for Messaging ---
// RSA-OAEP can only encrypt small payloads. We use hybrid encryption:
// 1. Generate AES-GCM key.
// 2. Encrypt payload with AES-GCM.
// 3. Encrypt AES key with RSA-OAEP.

export async function encryptPayload(publicKeyB64, dataArrayBuffer) {
  // Import recipient's public key
  const spki = base64ToArrayBuffer(publicKeyB64);
  const publicKey = await window.crypto.subtle.importKey(
    "spki",
    spki,
    KEY_PAIR_ALGO,
    true,
    ["encrypt"]
  );

  // Generate AES-GCM key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // Encrypt payload with AES
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedPayload = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    dataArrayBuffer
  );

  // Encrypt AES key with RSA
  const aesKeyRaw = await window.crypto.subtle.exportKey("raw", aesKey);
  const encryptedAesKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    aesKeyRaw
  );

  return {
    encryptedPayload: arrayBufferToBase64(encryptedPayload),
    encryptedAesKey: arrayBufferToBase64(encryptedAesKey),
    iv: arrayBufferToBase64(iv)
  };
}

export async function decryptPayload(privateKey, encryptedPayloadB64, encryptedAesKeyB64, ivB64) {
  try {
    // Decrypt AES key with RSA
    const encryptedAesKey = base64ToArrayBuffer(encryptedAesKeyB64);
    const aesKeyRaw = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedAesKey
    );

    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      aesKeyRaw,
      { name: "AES-GCM" },
      true,
      ["decrypt"]
    );

    // Decrypt payload with AES
    const iv = base64ToArrayBuffer(ivB64);
    const encryptedPayload = base64ToArrayBuffer(encryptedPayloadB64);
    const decryptedPayload = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      encryptedPayload
    );

    return decryptedPayload; // ArrayBuffer
  } catch (e) {
    console.error("Decryption failed", e);
    return null;
  }
}

// --- Backup & Restore (AES-GCM with PIN) ---

export async function backupPrivateKey(pin) {
  const jwk = await localforage.getItem('mesh_private_key');
  if (!jwk) throw new Error("No private key found to backup");

  const encoder = new TextEncoder();
  const jwkString = JSON.stringify(jwk);
  const data = encoder.encode(jwkString);

  // Derive key from PIN (PBKDF2)
  const pinKeyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    pinKeyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    data
  );

  return {
    encryptedKey: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt)
  };
}

export async function restorePrivateKey(backupObj, pin) {
  const encoder = new TextEncoder();
  
  const pinKeyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const salt = base64ToArrayBuffer(backupObj.salt);
  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    pinKeyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const iv = base64ToArrayBuffer(backupObj.iv);
  const encryptedData = base64ToArrayBuffer(backupObj.encryptedKey);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    encryptedData
  );

  const decoder = new TextDecoder();
  const jwkString = decoder.decode(decrypted);
  const jwk = JSON.parse(jwkString);

  await localforage.setItem('mesh_private_key', jwk);
  return true;
}

// --- Signatures (For Admin Channel) ---

export async function hashSignature(content, timestamp, adminUid) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content + timestamp + adminUid);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return arrayBufferToBase64(hashBuffer);
}

// Technically we are just verifying the hash here since the prompt said:
// "generate a SHA-256 hash of content + timestamp + adminUid using crypto.subtle.digest and store it as signature... Receiving clients verify the signature"
export async function verifySignature(signature, content, timestamp, adminUid) {
  const expectedHash = await hashSignature(content, timestamp, adminUid);
  return signature === expectedHash;
}

// --- Helpers ---

export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export function textToArrayBuffer(text) {
  const encoder = new TextEncoder();
  return encoder.encode(text).buffer;
}

export function arrayBufferToText(buffer) {
  const decoder = new TextDecoder();
  return decoder.decode(buffer);
}
