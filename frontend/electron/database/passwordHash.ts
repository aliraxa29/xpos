/**
 * Offline password hashing for locally-provisioned POS users.
 *
 * Replaces the previous unsalted single-round SHA-256 scheme (trivially
 * brute-forceable / precomputable if the local MariaDB is read) with a salted,
 * memory-hard scrypt derivation. Hashing runs only in the Electron main process;
 * the renderer verifies via the `db:verify-password` IPC and never sees the hash.
 */

import { randomBytes, scrypt, createHash, timingSafeEqual } from "crypto";

const KEYLEN = 64;

function scryptHash(password: string, salt: string): Promise<string> {
	return new Promise((resolve, reject) => {
		scrypt(password, salt, KEYLEN, (err, derivedKey) => {
			if (err) reject(err);
			else resolve(derivedKey.toString("hex"));
		});
	});
}

/** Legacy scheme kept only to verify (and then upgrade) pre-migration rows. */
function legacySha256(password: string): string {
	return createHash("sha256").update(password).digest("hex");
}

export interface HashedPassword {
	hash: string;
	salt: string;
}

/** Derive a fresh salted hash for storing a new/updated password. */
export async function hashPassword(password: string): Promise<HashedPassword> {
	const salt = randomBytes(16).toString("hex");
	const hash = await scryptHash(password, salt);
	return { hash, salt };
}

function safeEqualHex(a: string, b: string): boolean {
	const bufA = Buffer.from(a, "hex");
	const bufB = Buffer.from(b, "hex");
	if (bufA.length !== bufB.length) return false;
	return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a password against a stored hash.
 *
 * When `salt` is present, uses scrypt. When absent, the row predates the salted
 * scheme, so we fall back to the legacy SHA-256 comparison; callers should
 * re-hash on success to transparently upgrade the row.
 */
export async function verifyPassword(
	password: string,
	storedHash: string,
	salt: string | null | undefined,
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
	if (salt) {
		const candidate = await scryptHash(password, salt);
		return { valid: safeEqualHex(candidate, storedHash), needsUpgrade: false };
	}
	const candidate = legacySha256(password);
	const valid = candidate.length === storedHash.length && safeEqualHex(candidate, storedHash);
	return { valid, needsUpgrade: valid };
}
