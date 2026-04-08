import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: errors.array(),
    });
  }
  next();
};

export const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').trim().notEmpty().withMessage('Name is required'),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const workspaceValidation = [
  body('name').trim().notEmpty().withMessage('Workspace name is required'),
  body('slug').matches(/^[a-z0-9-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
];

export const clusterValidation = [
  body('name').trim().notEmpty().withMessage('Cluster name is required'),
  body('provider').isIn(['minikube', 'kind', 'k3s', 'k3d', 'docker-desktop', 'eks', 'gke', 'aks', 'custom']).withMessage('Invalid provider'),
  body('region').trim().notEmpty().withMessage('Region is required'),
  body('apiServer').optional().isURL().withMessage('Invalid API server URL'),
];

export const projectValidation = [
  body('name').trim().notEmpty().withMessage('Project name is required'),
  body('clusterId').notEmpty().withMessage('Cluster ID is required'),
  body('gitUrl').optional().isURL().withMessage('Invalid Git URL'),
  body('namespace').optional().trim().notEmpty().withMessage('Namespace cannot be empty'),
];

export const deploymentValidation = [
  body('imageUrl').isURL().withMessage('Valid Docker image URL is required'),
  body('replicas').optional().isInt({ min: 1, max: 100 }).withMessage('Replicas must be between 1 and 100'),
];

export const idParamValidation = [
  param('id').notEmpty().withMessage('ID is required'),
];

export const queryValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('namespace').optional().isString(),
];
