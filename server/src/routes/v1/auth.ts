import { FastifyInstance } from 'fastify';
import { auth as schemas } from '../../schemas/index.js';
import { authMiddleware } from '../../middleware/auth.js';
import { 
  devLogin, 
  devGetOTP, 
  sendOTP, 
  register, 
  verifyOTPAndLogin, 
  completeProfile, 
  refreshToken 
} from '../../controllers/auth.controller.js';

export default async function(router: FastifyInstance) {
  if (process.env.NODE_ENV === 'development') {
    router.post('/dev-login', { schema: schemas.devLogin }, devLogin);
    router.get('/dev-otp/:email', devGetOTP);
  }

  router.post('/', { schema: schemas.sendOtp }, sendOTP);
  router.post('/register', { schema: schemas.register }, register);
  router.post('/send-otp', { schema: schemas.sendOtp }, sendOTP);
  router.post('/otp/verify', { schema: schemas.verifyOtp }, verifyOTPAndLogin);
  router.post('/complete-profile', { schema: schemas.completeProfile }, completeProfile);
  router.post('/refresh', { schema: schemas.refresh }, refreshToken);
}
