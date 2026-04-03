import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private encryptionKey: Buffer;

  constructor() {
    const keyString = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef';
    if (keyString.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 characters (16 bytes in hex)');
    }
    this.encryptionKey = Buffer.from(keyString, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Combine iv + authTag + encrypted data
    const combined = iv.toString('hex') + authTag.toString('hex') + encrypted;
    return combined;
  }

  decrypt(encrypted: string): string {
    const iv = Buffer.from(encrypted.slice(0, 24), 'hex'); // 12 bytes = 24 hex chars
    const authTag = Buffer.from(encrypted.slice(24, 56), 'hex'); // 16 bytes = 32 hex chars
    const encryptedData = encrypted.slice(56);

    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
