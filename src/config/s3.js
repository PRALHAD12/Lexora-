import { S3Client } from '@aws-sdk/client-s3';
import config from './index.js';

/**
 * AWS S3 Client for document storage.
 * Used for generating presigned URLs for secure upload/download.
 */
export const s3Client = new S3Client({
  region: config.aws.region,
});

export default s3Client;
