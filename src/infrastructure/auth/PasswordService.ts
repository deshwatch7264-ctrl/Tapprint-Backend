import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Password hashing and verification using bcrypt.
 */
export class PasswordService {
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}

export const passwordService = new PasswordService();
