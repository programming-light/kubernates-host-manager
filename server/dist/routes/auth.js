/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication endpoints
 */
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Send OTP for registration/login
 *     description: Send OTP to email for authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: OTP sent successfully
 */
/**
 * @swagger
 * /api/auth/otp/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Verify OTP and login or complete registration
 *     description: Verify OTP - if user exists login, if not create account with name
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login or registration successful
 *       401:
 *         description: Invalid or expired OTP
 */
/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     description: Get a new access token using a valid refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid or expired refresh token
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import log from '../lib/logger.js';
import { generateOTP, verifyOTP } from '../lib/otp.js';
import { sendOTPEmail, isEmailConfigured } from '../lib/email.js';
const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-super-secret-refresh-key';
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Bad Request', message: 'Email is required' });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Bad Request', message: 'Invalid email format' });
        }
        const existingUser = await prisma.user.findUnique({ where: { email } });
        const otp = generateOTP(email);
        if (isEmailConfigured()) {
            const sent = await sendOTPEmail(email, otp);
            if (sent) {
                log.info(`OTP sent via email to ${email}`);
                return res.json({
                    message: 'OTP sent to your email',
                    requiresOTP: true,
                    emailSent: true
                });
            }
        }
        log.info(`OTP for ${email} (${existingUser ? 'login' : 'register'}): ${otp}`);
        res.json({
            message: 'OTP generated (check server logs in development)',
            requiresOTP: true,
            emailSent: false,
            devMode: !isEmailConfigured()
        });
    }
    catch (error) {
        log.error('Send OTP error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to send OTP' });
    }
});
router.post('/register', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Bad Request', message: 'Email is required' });
        }
        const existingUser = await prisma.user.findUnique({ where: { email } });
        const otp = generateOTP(email);
        if (isEmailConfigured()) {
            const sent = await sendOTPEmail(email, otp);
            if (sent) {
                log.info(`OTP sent via email to ${email}`);
                return res.json({
                    message: 'OTP sent to your email',
                    requiresOTP: true,
                    emailSent: true,
                    isNewUser: !existingUser
                });
            }
        }
        log.info(`OTP for ${email}: ${otp}`);
        res.json({
            message: 'OTP generated',
            requiresOTP: true,
            emailSent: false,
            devMode: !isEmailConfigured(),
            isNewUser: !existingUser
        });
    }
    catch (error) {
        log.error('Registration error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to send OTP' });
    }
});
router.post('/otp/verify', async (req, res) => {
    try {
        const { email, otp, name } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: 'Bad Request', message: 'Email and OTP are required' });
        }
        if (!verifyOTP(email, otp)) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired OTP' });
        }
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            const accessToken = jwt.sign({ userId: existingUser.id, email: existingUser.email }, JWT_SECRET, { expiresIn: process.env.accessTokenExp });
            const refreshToken = jwt.sign({ userId: existingUser.id }, REFRESH_SECRET, { expiresIn: process.env.refreshTokenExp });
            return res.json({ accessToken, refreshToken, expiresIn: process.env.accessTokenExp });
        }
        if (!name) {
            return res.json({ message: 'OTP verified, provide name to complete registration' });
        }
        const user = await prisma.user.create({
            data: {
                email,
                name,
                role: 'developer',
            },
        });
        const accessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: process.env.accessTokenExp });
        const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: process.env.refreshTokenExp });
        res.status(201).json({ accessToken, refreshToken, expiresIn: process.env.accessTokenExp });
    }
    catch (error) {
        log.error('OTP verification error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Verification failed' });
    }
});
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ error: 'Bad Request', message: 'Refresh token is required' });
    }
    try {
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
        }
        const accessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: process.env.accessTokenExp });
        const newRefreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: process.env.refreshTokenExp });
        res.json({ accessToken, refreshToken: newRefreshToken, expiresIn: process.env.accessTokenExp });
    }
    catch {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired refresh token' });
    }
});
export default router;
