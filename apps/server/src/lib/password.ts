import * as argon2 from "argon2";

/**
 * Hash a password using Argon2id algorithm.
 * Argon2id is the recommended variant for password hashing.
 */
export const hashPassword = async (password: string): Promise<string> => {
	return argon2.hash(password, {
		type: argon2.argon2id,
		memoryCost: 65536, // 64 MiB
		timeCost: 3,
		parallelism: 4,
	});
};

/**
 * Verify a password against a hash.
 * Returns true if the password matches, false otherwise.
 */
export const verifyPassword = async (
	password: string,
	hash: string,
): Promise<boolean> => {
	try {
		return await argon2.verify(hash, password);
	} catch {
		return false;
	}
};
