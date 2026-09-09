// Encrypt the daily brief so a public repo stops being a public notebook.
//
// The repo has to stay public for GitHub Pages on the free plan, which means
// anything committed in plain text can be read by anyone, dashboard or no
// dashboard. Encrypting only the page would be theatre: the data is the thing
// that leaks. So the brief itself is encrypted here, and only the passphrase
// opens it.
//
// Deliberately the same scheme as the Reddit console's vault, so the browser
// can decrypt it with WebCrypto and no library:
//   PBKDF2-SHA256, 250,000 iterations, 16 byte salt -> 256 bit key
//   AES-256-GCM, 12 byte IV
import { webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;
// Bound, because destructuring getRandomValues off webcrypto loses its `this`.
const randomBytes = (n) => webcrypto.getRandomValues(new Uint8Array(n));
const ITERATIONS = 250000;

async function keyFrom(passphrase, salt) {
  const base = await subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

const b64 = (buf) => Buffer.from(buf).toString('base64');

/** Returns the JSON envelope to write to disk, or null if there is no passphrase. */
export async function seal(value, passphrase) {
  if (!passphrase) return null;
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await keyFrom(passphrase, salt);
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return {
    v: 1,
    alg: 'AES-256-GCM',
    kdf: `PBKDF2-SHA256-${ITERATIONS}`,
    salt: b64(salt),
    iv: b64(iv),
    data: b64(cipher),
  };
}

/** Only used by the tests below; the browser does its own unsealing. */
export async function unseal(envelope, passphrase) {
  const salt = Buffer.from(envelope.salt, 'base64');
  const iv = Buffer.from(envelope.iv, 'base64');
  const key = await keyFrom(passphrase, new Uint8Array(salt));
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key,
    new Uint8Array(Buffer.from(envelope.data, 'base64')));
  return JSON.parse(new TextDecoder().decode(plain));
}
