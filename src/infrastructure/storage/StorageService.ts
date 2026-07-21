import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../config';
import { logger } from '../../shared/logger/logger';

export interface PresignedUpload {
  uploadUrl: string;
  storageKey: string;
  expiresIn: number;
}

/**
 * Abstraction over object storage. Documents are uploaded directly by the
 * client via pre-signed PUT URLs and downloaded by the Print Agent via
 * short-lived signed GET URLs. Objects are purged after printing.
 */
export interface IStorageService {
  createUploadUrl(key: string, mimeType: string): Promise<PresignedUpload>;
  createDownloadUrl(key: string): Promise<string>;
  getObjectBytes(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
}

export class S3StorageService implements IStorageService {
  private readonly client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: config.storage.region,
      endpoint: config.storage.endpoint,
      forcePathStyle: Boolean(config.storage.endpoint),
      credentials: {
        accessKeyId: config.storage.accessKeyId,
        secretAccessKey: config.storage.secretAccessKey,
      },
    });
  }

  async createUploadUrl(key: string, mimeType: string): Promise<PresignedUpload> {
    // Note: no ServerSideEncryption header — it would be part of the signature
    // but the browser PUT doesn't send it, causing a signature mismatch.
    // Supabase Storage encrypts at rest regardless.
    const command = new PutObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: config.storage.uploadUrlTtl,
    });
    return { uploadUrl, storageKey: key, expiresIn: config.storage.uploadUrlTtl };
  }

  async getObjectBytes(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: config.storage.bucket, Key: key }),
    );
    if (!res.Body) throw new Error(`Object not found: ${key}`);
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async createDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: config.storage.downloadUrlTtl,
    });
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: config.storage.bucket, Key: key }),
    );
    logger.info('Storage object purged', { key });
  }
}

export const storageService: IStorageService = new S3StorageService();
