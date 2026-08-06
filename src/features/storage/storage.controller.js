import storageService from './storage.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * POST /api/v1/storage/upload-url
 * Generate a presigned URL for uploading a document to S3.
 */
export const getUploadUrl = asyncHandler(async (req, res) => {
  const { fileName, contentType, organizationId } = req.body;
  const result = await storageService.generateUploadUrl({
    fileName,
    contentType,
    userId: req.user.id,
    organizationId,
  });
  return ApiResponse.ok(res, 'Upload URL generated', result);
});

/**
 * POST /api/v1/storage/download-url
 * Generate a presigned URL for downloading a document from S3.
 */
export const getDownloadUrl = asyncHandler(async (req, res) => {
  const { fileKey } = req.body;
  const result = await storageService.generateDownloadUrl(fileKey);
  return ApiResponse.ok(res, 'Download URL generated', result);
});

/**
 * DELETE /api/v1/storage/:fileKey
 * Delete a file from S3.
 */
export const deleteFile = asyncHandler(async (req, res) => {
  const fileKey = decodeURIComponent(req.params.fileKey);
  const result = await storageService.deleteFile(fileKey);
  return ApiResponse.ok(res, result.message);
});

export default { getUploadUrl, getDownloadUrl, deleteFile };
