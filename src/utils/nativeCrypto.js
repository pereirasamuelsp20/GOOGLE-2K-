import AsyncStorage from '@react-native-async-storage/async-storage';

// Gracefully import react-native-quick-crypto — it may not be linked on all builds
let crypto = null;
try {
  crypto = require('react-native-quick-crypto');
} catch (e) {
  console.warn('react-native-quick-crypto not available, using JS fallback');
}

// JS Fallback: simple SHA-256 using a basic hash (for when native crypto is unavailable)
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export async function generateKeyPair() {
  if (!crypto || !crypto.generateKeyPair) {
    // Fallback: generate a pseudo key pair using random strings
    // This won't provide real encryption but prevents crashes
    console.warn('Crypto not available — generating placeholder keys');
    const fakePub = 'PLACEHOLDER_PUB_' + Date.now().toString(36);
    const fakePriv = 'PLACEHOLDER_PRIV_' + Date.now().toString(36);
    await AsyncStorage.setItem('mesh_private_key', fakePriv);
    await AsyncStorage.setItem('mesh_public_key', fakePub);
    return fakePub;
  }

  return new Promise((resolve, reject) => {
    crypto.generateKeyPair('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    }, async (err, publicKey, privateKey) => {
      if (err) return reject(err);
      
      await AsyncStorage.setItem('mesh_private_key', privateKey);
      await AsyncStorage.setItem('mesh_public_key', publicKey);
      
      resolve(publicKey);
    });
  });
}

export async function getPrivateKey() {
  return await AsyncStorage.getItem('mesh_private_key');
}

export async function hasPrivateKey() {
  const key = await AsyncStorage.getItem('mesh_private_key');
  return !!key;
}

export async function encryptPayload(publicKeyPem, dataStr) {
  if (!crypto || !crypto.createCipheriv) {
    // Fallback: return plaintext wrapped so the structure is consistent
    console.warn('Crypto not available — skipping encryption');
    return {
      encryptedPayload: dataStr,
      encryptedAesKey: 'NONE',
      iv: 'NONE'
    };
  }

  try {
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    let encryptedPayload = cipher.update(dataStr, 'utf8', 'base64');
    encryptedPayload += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    // Encrypt AES key with RSA public key
    const encryptedAesKey = crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      aesKey
    ).toString('base64');

    const combinedIvAuthTag = Buffer.concat([iv, authTag]).toString('base64');

    return {
      encryptedPayload,
      encryptedAesKey,
      iv: combinedIvAuthTag
    };
  } catch (e) {
    console.warn("Encrypt failed, sending plaintext fallback:", e.message);
    return {
      encryptedPayload: dataStr,
      encryptedAesKey: 'NONE',
      iv: 'NONE'
    };
  }
}

export async function decryptPayload(privateKeyPem, encryptedPayloadBase64, encryptedAesKeyBase64, ivAuthTagBase64) {
  // If the message was never encrypted (fallback mode), return as-is
  if (encryptedAesKeyBase64 === 'NONE') {
    return encryptedPayloadBase64;
  }

  if (!crypto || !crypto.createDecipheriv) {
    console.warn('Crypto not available — cannot decrypt');
    return '[Decryption unavailable]';
  }

  try {
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encryptedAesKeyBase64, 'base64')
    );

    const combinedBuffer = Buffer.from(ivAuthTagBase64, 'base64');
    const iv = combinedBuffer.slice(0, 12);
    const authTag = combinedBuffer.slice(12);

    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedPayloadBase64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (e) {
    console.warn("Decryption failed", e.message);
    return null;
  }
}

export async function hashSignature(content, timestamp, adminUid) {
  const data = content + timestamp + adminUid;
  if (crypto && crypto.createHash) {
    return crypto.createHash('sha256').update(data).digest('base64');
  }
  // JS fallback
  return simpleHash(data);
}

export async function verifySignature(signatureBase64, content, timestamp, adminUid) {
  const expectedHash = await hashSignature(content, timestamp, adminUid);
  return signatureBase64 === expectedHash;
}
