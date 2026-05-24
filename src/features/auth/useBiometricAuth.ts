/**
 * WebAuthn biometric auth — client-side only.
 * We use device biometric as a presence-check; no server-side sig verification needed
 * for a personal PWA.
 */

const RP_NAME = 'MikiZ Helper';
const USER_ID = new TextEncoder().encode('mikiz-local-user');
const LOCAL_CREDENTIAL_KEY = 'mission-control-local-passkey-id';

function randomChallenge(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

function bufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuffer(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function isBiometricSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'credentials' in navigator &&
    typeof PublicKeyCredential !== 'undefined'
  );
}

export function getLocalBiometricCredentialId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LOCAL_CREDENTIAL_KEY);
}

export function clearLocalBiometricCredentialId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCAL_CREDENTIAL_KEY);
}

/**
 * Register a new passkey credential.
 * Returns base64-encoded credentialId to store in settings, or null on failure.
 */
export async function registerBiometric(): Promise<string | null> {
  if (!isBiometricSupported()) return null;
  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: RP_NAME, id: window.location.hostname },
        user: { id: USER_ID, name: 'mikiz', displayName: 'MikiZ' },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256
          { alg: -257, type: 'public-key' },  // RS256
        ],
        authenticatorSelection: {
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60_000,
      },
    }) as PublicKeyCredential | null;

    if (!credential) return null;
    const credentialId = bufferToBase64(credential.rawId);
    localStorage.setItem(LOCAL_CREDENTIAL_KEY, credentialId);
    return credentialId;
  } catch {
    return null;
  }
}

/**
 * Verify the stored passkey.
 * Returns true if the device biometric succeeds, false otherwise.
 */
export async function verifyBiometric(credentialId: string): Promise<boolean> {
  if (!isBiometricSupported() || !credentialId) return false;
  try {
    const result = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        rpId: window.location.hostname,
        allowCredentials: [
          { id: base64ToBuffer(credentialId), type: 'public-key' },
        ],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return result !== null;
  } catch {
    return false;
  }
}
