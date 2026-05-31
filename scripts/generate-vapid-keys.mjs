import { generateKeyPairSync } from 'node:crypto';

function base64UrlToBuffer(value) {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
}

function bufferToBase64Url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicJwk = publicKey.export({ format: 'jwk' });
const privateJwk = privateKey.export({ format: 'jwk' });

const x = base64UrlToBuffer(publicJwk.x);
const y = base64UrlToBuffer(publicJwk.y);
const publicBytes = Buffer.concat([Buffer.from([0x04]), x, y]);

console.log('WEB_PUSH_PUBLIC_KEY=' + bufferToBase64Url(publicBytes));
console.log('WEB_PUSH_PRIVATE_KEY=' + privateJwk.d);
console.log('WEB_PUSH_SUBJECT=mailto:you@example.com');
