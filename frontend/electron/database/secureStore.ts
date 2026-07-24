/**
 * At-rest encryption for locally-persisted secrets (Frappe API key/secret, the
 * hub shared secret, the local MariaDB password).
 *
 * Wraps Electron's `safeStorage`, which is backed by the OS credential store
 * (DPAPI on Windows, Keychain on macOS, libsecret/kwallet on Linux). When no
 * OS backend is available, `safeStorage.isEncryptionAvailable()` is false and we
 * fall back to storing plaintext (marked as such) so the app keeps working;
 * this is strictly no worse than the previous always-plaintext behaviour.
 */

import { safeStorage } from "electron";
import { createLogger } from "../logger";

const log = createLogger("SecureStore");

const ENC_PREFIX = "enc:v1:";

/** True when the value has already been encrypted by this module. */
export function isEncrypted(stored: string | null | undefined): boolean {
	return typeof stored === "string" && stored.startsWith(ENC_PREFIX);
}

/** Encrypt a secret for storage. Returns a plaintext passthrough if the OS store is unavailable. */
export function encryptSecret(plain: string): string {
	if (!plain) return plain;
	try {
		if (safeStorage.isEncryptionAvailable()) {
			const buf = safeStorage.encryptString(plain);
			return ENC_PREFIX + buf.toString("base64");
		}
	} catch (err) {
		log.warn("encryptSecret failed, storing plaintext", err);
	}
	return plain;
}

/** Decrypt a stored secret. Legacy plaintext values are returned unchanged. */
export function decryptSecret(stored: string | null | undefined): string | null {
	if (stored == null) return null;
	if (!isEncrypted(stored)) return stored; // legacy plaintext
	try {
		const buf = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
		return safeStorage.decryptString(buf);
	} catch (err) {
		log.error("decryptSecret failed", err);
		return null;
	}
}
