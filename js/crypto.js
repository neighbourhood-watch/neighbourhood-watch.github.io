const ITERATIONS = 600000;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
export const MAX_CATALOGUE_BYTES = 8 * 1024 * 1024;

function encode(bytes) {
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
}

function decode(value, length) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error('Invalid catalogue encoding.');
  }
  const bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0));
  if (length && bytes.length !== length) throw new Error('Invalid catalogue field.');
  return bytes;
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256 || /\s/.test(password)) {
    throw new Error('Use one word of 12 to 256 characters, without spaces.');
  }
}

async function passwordKey(password, salt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function seal(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) };
}

async function unseal(key, value) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(value.iv, 12) }, key, decode(value.ciphertext));
}

export function parseEnvelope(text) {
  if (typeof text !== 'string' || encoder.encode(text).length > MAX_CATALOGUE_BYTES) {
    throw new Error('Catalogue exceeds the 8 MB limit.');
  }
  let envelope;
  try { envelope = JSON.parse(text); } catch { throw new Error('Choose a valid encrypted catalogue JSON file.'); }
  if (envelope?.format !== 'incident-register' || envelope.version !== 1 || envelope.iterations !== ITERATIONS) {
    throw new Error('This catalogue format is not supported.');
  }
  for (const role of ['viewer', 'editor']) {
    const wrapper = envelope.keys?.[role];
    if (!wrapper) throw new Error('Catalogue is missing an access key.');
    decode(wrapper.salt, 16);
    decode(wrapper.iv, 12);
    decode(wrapper.ciphertext, 48);
  }
  if (!envelope.payload) throw new Error('Catalogue has no encrypted content.');
  decode(envelope.payload.iv, 12);
  if (decode(envelope.payload.ciphertext).length < 16) throw new Error('Catalogue content is invalid.');
  return envelope;
}

export async function createCatalogue(data, viewerPassword, editorPassword) {
  validatePassword(viewerPassword);
  validatePassword(editorPassword);
  if (viewerPassword === editorPassword) throw new Error('Choose different viewer and editor passwords.');
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const contentKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const keys = {};
  for (const [role, password] of [['viewer', viewerPassword], ['editor', editorPassword]]) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    keys[role] = { salt: encode(salt), ...await seal(await passwordKey(password, salt), rawKey) };
  }
  rawKey.fill(0);
  const envelope = { format: 'incident-register', version: 1, iterations: ITERATIONS, keys };
  return { envelope: await saveCatalogue(envelope, contentKey, data), contentKey };
}

export async function unlockCatalogue(envelope, password, role) {
  if (!['viewer', 'editor'].includes(role)) throw new Error('Invalid access role.');
  const wrapper = envelope.keys[role];
  try {
    const derivedKey = await passwordKey(password, decode(wrapper.salt, 16));
    const rawKey = await unseal(derivedKey, wrapper);
    const contentKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
    new Uint8Array(rawKey).fill(0);
    const data = JSON.parse(decoder.decode(await unseal(contentKey, envelope.payload)));
    return { contentKey, data };
  } catch {
    throw new Error('Unable to unlock. Check the password and that the catalogue is intact.');
  }
}

export async function saveCatalogue(envelope, contentKey, data) {
  const updated = { ...envelope, payload: await seal(contentKey, encoder.encode(JSON.stringify(data))) };
  parseEnvelope(JSON.stringify(updated));
  return updated;
}