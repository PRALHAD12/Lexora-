import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../../config/s3.js';
import config from '../../config/index.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../utils/logger.js';

const BUCKET_NAME = config.aws.s3.bucket;
const PRESIGNED_URL_EXPIRY = 3600; // 1 hour

/**
 * Storage Service — AWS S3 presigned URL operations.
 */
class StorageService {
  /**
   * Generate a presigned URL for uploading a file to S3.
   *
   * @param {object} params
   * @param {string} params.fileName - Original file name
   * @param {string} params.contentType - MIME type (e.g., 'application/pdf')
   * @param {string} params.userId - Uploader's user ID (used in the S3 key path)
   * @param {string} [params.organizationId] - Optional org ID for workspace-scoped storage
   * @returns {{ uploadUrl, fileKey, expiresIn }}
   */
  async generateUploadUrl({ fileName, contentType, userId, organizationId }) {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    if (!allowedTypes.includes(contentType)) {
      throw ApiError.badRequest(
        `Unsupported file type: ${contentType}. Allowed: PDF, DOC, DOCX, TXT`
      );
    }

    // Build a unique S3 key path
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const prefix = organizationId ? `orgs/${organizationId}` : `users/${userId}`;
    const fileKey = `${prefix}/documents/${timestamp}-${sanitizedName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
      Metadata: {
        'uploaded-by': userId,
        'original-name': fileName,
      },
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY,
    });

    logger.info(`Presigned upload URL generated: ${fileKey}`);

    return {
      uploadUrl,
      fileKey,
      expiresIn: PRESIGNED_URL_EXPIRY,
    };
  }

  /**
   * Generate a presigned URL for downloading/viewing a file from S3.
   *
   * @param {string} fileKey - The S3 object key
   * @returns {{ downloadUrl, expiresIn }}
   */
  async generateDownloadUrl(fileKey) {
    if (!fileKey) {
      throw ApiError.badRequest('File key is required');
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    });

    const downloadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY,
    });

    return {
      downloadUrl,
      expiresIn: PRESIGNED_URL_EXPIRY,
    };
  }

  /**
   * Delete a file from S3.
   *
   * @param {string} fileKey - The S3 object key
   * @returns {{ message }}
   */
  async deleteFile(fileKey) {
    if (!fileKey) {
      throw ApiError.badRequest('File key is required');
    }

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    });

    await s3Client.send(command);

    logger.info(`File deleted from S3: ${fileKey}`);

    return { message: 'File deleted successfully' };
  }
}

export default new StorageService();
