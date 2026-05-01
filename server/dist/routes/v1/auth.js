import { Router } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma.js';
import log from '../../lib/logger.js';
import { generateOTP, verifyOTP, getOTP } from '../../lib/otp.js';
import { sendOTPEmail, isEmailConfigured } from '../../lib/email.js';
import { UserRole, UserStatus } from '../../constants/roles.js';
const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-super-secret-refresh-key';
const refreshTokenExp = (process.env.refreshTokenExp || "7d");
const accessTokenExp = (process.env.accessTokenExp || "1d");
function setAuthCookies(res, accessToken, refreshToken) {
    const accessExp = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const refreshExp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: accessExp,
        path: '/',
    });
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: refreshExp,
        path: '/',
    });
}
if (process.env.NODE_ENV === 'development') {
    router.post('/dev-login', async (req, res) => {
        try {
            const { email, role } = req.body;
            if (!email) {
                return res.status(400).json({ error: 'Bad Request', message: 'Email required' });
            }
            let user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
                user = await prisma.user.create({
                    data: {
                        email,
                        name: 'Dev User',
                        role: role || UserRole.DEVELOPER,
                        status: UserStatus.ACTIVE
                    },
                });
            }
            const accessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
            const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: '7d' });
            res.json({ accessToken, refreshToken, expiresIn: 604800, user });
        }
        catch (error) {
            log.error('Dev login error:', error);
            res.status(500).json({ error: 'Internal Server Error', message: 'Dev login failed' });
        }
    });
    router.get('/dev-otp/:email', async (req, res) => {
        const otp = getOTP(req.params.email);
        if (!otp) {
            return res.status(404).json({ error: 'Not Found', message: 'No OTP found for this email' });
        }
        res.json({ otp, email: req.params.email });
    });
}
router.post('/', async (req, res) => {
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
                    emailSent: true,
                    isNewUser: !existingUser
                });
            }
        }
        log.info(`OTP for ${email} (${existingUser ? 'login' : 'register'}): ${otp}`);
        res.json({
            message: 'OTP generated',
            requiresOTP: true,
            emailSent: false,
            devMode: !isEmailConfigured(),
            otp: otp,
            isNewUser: !existingUser
        });
    }
    catch (error) {
        log.error('Auth error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process request' });
    }
});
router.post('/register', async (req, res) => {
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
        if (existingUser) {
            return res.status(409).json({ error: 'Conflict', message: 'User already exists' });
        }
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
        log.info(`OTP for ${email} (register): ${otp}`);
        res.json({
            message: 'OTP generated',
            requiresOTP: true,
            emailSent: false,
            devMode: !isEmailConfigured(),
            otp: otp
        });
    }
    catch (error) {
        log.error('Registration error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to register' });
    }
});
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
            message: 'OTP generated',
            requiresOTP: true,
            emailSent: false,
            devMode: !isEmailConfigured(),
            otp: otp
        });
    }
    catch (error) {
        log.error('Send OTP error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to send OTP' });
    }
});
router.post('/otp/verify', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: 'Bad Request', message: 'Email and OTP are required' });
        }
        if (!verifyOTP(email, otp)) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired OTP' });
        }
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            if (existingUser.status === UserStatus.SUSPENDED || existingUser.status === UserStatus.INACTIVE) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: `Account is ${existingUser.status.toLowerCase()}. Contact admin.`
                });
            }
            const accessToken = jwt.sign({ userId: existingUser.id, email: existingUser.email }, JWT_SECRET, { expiresIn: accessTokenExp });
            const refreshToken = jwt.sign({ userId: existingUser.id }, REFRESH_SECRET, { expiresIn: refreshTokenExp });
            setAuthCookies(res, accessToken, refreshToken);
            return res.json({
                accessToken,
                refreshToken,
                expiresIn: accessTokenExp,
                isNewUser: false,
                isComplete: !!existingUser.name && existingUser.name !== 'Unknown'
            });
        }
        const user = await prisma.user.create({
            data: {
                email,
                name: "Unknown",
                role: UserRole.DEVELOPER,
                status: UserStatus.PENDING,
            },
        });
        const accessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: accessTokenExp });
        const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: refreshTokenExp });
        setAuthCookies(res, accessToken, refreshToken);
        res.status(201).json({
            accessToken,
            refreshToken,
            expiresIn: accessTokenExp,
            isNewUser: true,
            isComplete: false,
        });
    }
    catch (error) {
        log.error('OTP verification error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Verification failed' });
    }
});
router.post('/complete-profile', async (req, res) => {
    try {
        const { name, company, role, phone } = req.body;
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Token required' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Bad Request', message: 'Name is required' });
        }
        const user = await prisma.user.update({
            where: { id: decoded.userId },
            data: {
                name: name.trim(),
                company: company?.trim() || null,
                role: role || UserRole.DEVELOPER,
                phone: phone?.trim() || null,
                status: UserStatus.ACTIVE,
            },
        });
        res.json({
            message: 'Profile completed',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                status: user.status
            }
        });
    }
    catch (error) {
        log.error('Complete profile error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to complete profile' });
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
        if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.INACTIVE) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `Account is ${user.status.toLowerCase()}`
            });
        }
        const accessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: accessTokenExp });
        const newRefreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: refreshTokenExp });
        res.json({
            accessToken,
            refreshToken: newRefreshToken,
            expiresIn: accessTokenExp,
        });
    }
    catch {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired refresh token' });
    }
});
export default router;
