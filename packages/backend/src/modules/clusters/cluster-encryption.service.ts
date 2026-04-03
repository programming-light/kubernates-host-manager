import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class ClusterEncryptionService {
  private encryptionKey: Buffer;
  private algorithm = 'aes-256-gcm';

  constructor() {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
      throw new Error(
        'ENCRYPTION_KEY must be set and be 64 hex characters (32 bytes). ' +
        'Generate with: openssl rand -hex 32',
      );
    }
    try {
      this.encryptionKey = Buffer.from(keyHex, 'hex');
    } catch (error) {
      throw new Error('ENCRYPTION_KEY must be valid hexadecimal');
    }
  }

  /**
   * Encrypt sensitive data
   * Returns: iv.tag.ciphertext (all hex encoded)
   */
  encrypt(plaintext: string): string {
    if (!plaintext) return '';

    try {
      const iv = crypto.randomBytes(12); // 96-bit IV for GCM
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);

      const authTag = cipher.getAuthTag();

      // Return: iv + tag + ciphertext (all hex encoded)
      return `${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted.toString('hex')}`;
    } catch (error) {
      throw new BadRequestException('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive data
   * Expects format: iv.tag.ciphertext (all hex encoded)
   */
  decrypt(encrypted: string): string {
    if (!encrypted) return '';

    try {
      const parts = encrypted.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const ciphertext = Buffer.from(parts[2], 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      throw new BadRequestException('Decryption failed - data may be corrupted or encrypted with wrong key');
    }
  }

  /**
   * Safely encode binary data to base64 for storage
   */
  encodeToBase64(data: string | Buffer): string {
    if (!data) return '';
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    return buffer.toString('base64');
  }

  /**
   * Safely decode base64 data
   */
  decodeFromBase64(encoded: string): string {
    if (!encoded) return '';
    return Buffer.from(encoded, 'base64').toString('utf8');
  }

  /**
   * Validate base64 string
   */
  isValidBase64(str: string): boolean {
    try {
      return Buffer.from(str, 'base64').toString('base64') === str;
    } catch {
      return false;
    }
  }
}
