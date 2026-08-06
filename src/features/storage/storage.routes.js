import { Router } from 'express';
import { body, param } from 'express-validator';
import * as storageController from './storage.controller.js';
import validate from '../../middleware/validate.js';
import authenticate from '../../middleware/authenticate.js';

const router = Router();

// All storage routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/storage/upload-url
 * @desc    Generate a presigned URL for uploading a document
 * @access  Private
 */
router.post(
  '/upload-url',
  [
    body('fileName').trim().notEmpty().withMessage('File name is required'),
    body('contentType').trim().notEmpty().withMessage('Content type is required'),
    body('organizationId').optional().isMongoId().withMessage('Invalid organization ID'),
  ],
  validate,
  storageController.getUploadUrl
);

/**
 * @route   POST /api/v1/storage/download-url
 * @desc    Generate a presigned URL for downloading a document
 * @access  Private
 */
router.post(
  '/download-url',
  [
    body('fileKey').trim().notEmpty().withMessage('File key is required'),
  ],
  validate,
  storageController.getDownloadUrl
);

/**
 * @route   DELETE /api/v1/storage/:fileKey
 * @desc    Delete a file from S3
 * @access  Private
 */
router.delete(
  '/:fileKey',
  [
    param('fileKey').trim().notEmpty().withMessage('File key is required'),
  ],
  validate,
  storageController.deleteFile
);

export default router;
