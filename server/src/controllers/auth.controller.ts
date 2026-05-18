import { FastifyRequest, FastifyReply } from 'fastify';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import log from '../lib/logger.js';
import { generateOTP, verifyOTP, getOTP } from '../lib/otp.js';
import { sendOTPEmail, isEmailConfigured } from '../lib/email.js';
import { UserRole, UserStatus } from '../constants/roles.js';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var required');
if (!process.env.REFRESH_SECRET) throw new Error('REFRESH_SECRET env var required');
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;
const refreshTokenExpDays = parseInt(process.env.REFRESH_TOKEN_EXP_DAYS || '7');
const accessTokenExp = (process.env.accessTokenExp || "15m") as SignOptions["expiresIn"];

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

async function createSession(userId: string, request?: FastifyRequest): Promise<string> {
  const refreshToken = generateRefreshToken();
  const hashedToken = hashToken(refreshToken);

  await prisma.session.create({
    data: {
      userId,
      refreshToken: hashedToken,
      userAgent: request?.headers['user-agent']?.substring(0, 255) || null,
      ip: request?.ip || null,
      expiresAt: new Date(Date.now() + refreshTokenExpDays * 24 * 60 * 60 * 1000),
    },
  });

  return refreshToken;
}

function setAuthCookie(reply: FastifyReply, accessToken: string) {
  const exp = typeof accessTokenExp === 'string'
    ? parseExpiry(accessTokenExp)
    : 24 * 60 * 60 * 1000;
  reply.setCookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(Date.now() + exp),
    path: '/',
  });
}

function parseExpiry(exp: string): number {
  const match = exp.match(/^(\d+)([smhd])$/);
  if (!match) return 24 * 60 * 60 * 1000;
  const num = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function devLogin(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email, role } = request.body as any;
    if (!email) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Email required' });
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

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email }, 
      JWT_SECRET, 
      { expiresIn: '1d' }
    );
    const refreshToken = await createSession(user.id, request);

    setAuthCookie(reply, accessToken);

    reply.send({ accessToken, refreshToken, expiresIn: 86400, user });
  } catch (error) {
    log.error('Dev login error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Dev login failed' });
  }
}

export async function devGetOTP(request: FastifyRequest, reply: FastifyReply) {
  const otp = await getOTP((request.params as any).email);
  if (!otp) {
    return reply.status(404).send({ error: 'Not Found', message: 'No OTP found for this email' });
  }
  reply.send({ otp, email: (request.params as any).email });
}

export async function sendOTP(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email } = request.body as any;

    if (!email) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Email is required' });
    }

    if (!validateEmail(email)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid email format' });
    }

    let isNewUser = true;
    try {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      isNewUser = !existingUser;
    } catch (dbError) {
      log.warn(`DB check skipped for sendOTP: ${(dbError as Error).message}`);
    }

    const otp = await generateOTP(email);
    
    const isDev = process.env.NODE_ENV === 'development';

    let emailSent = false;

    if (isEmailConfigured()) {
      try {
        const sent = await sendOTPEmail(email, otp);
        if (sent) {
          log.info(`OTP sent via email to ${email}`);
          emailSent = true;
        }
      } catch (emailError) {
        log.warn(`Email send failed: ${(emailError as Error).message}`);
      }
    }

    if (isDev) log.info(`OTP for ${email} (${isNewUser ? 'register' : 'login'}): ${otp}`);
    reply.send({ 
      message: emailSent ? 'OTP sent to your email' : 'OTP generated',
      requiresOTP: true,
      emailSent,
      ...(isDev ? { devMode: true, otp } : {}),
      isNewUser
    });
  } catch (error) {
    log.error('Auth error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to process request' });
  }
}

export async function register(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email } = request.body as any;

    if (!email) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Email is required' });
    }

    if (!validateEmail(email)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid email format' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return reply.status(409).send({ error: 'Conflict', message: 'User already exists' });
    }
    
    const otp = await generateOTP(email);
    
    const isDev = process.env.NODE_ENV === 'development';
    
    let emailSent = false;

    if (isEmailConfigured()) {
      const sent = await sendOTPEmail(email, otp);
      if (sent) {
        log.info(`OTP sent via email to ${email}`);
        emailSent = true;
      }
    }

    if (isDev) log.info(`OTP for ${email} (register): ${otp}`);
    reply.send({ 
      message: emailSent ? 'OTP sent to your email' : 'OTP generated',
      requiresOTP: true,
      emailSent,
      ...(isDev ? { devMode: true, otp } : {}),
    });
  } catch (error) {
    log.error('Registration error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to register' });
  }
}

export async function verifyOTPAndLogin(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email, otp } = request.body as any;

    if (!email || !otp) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Email and OTP are required' });
    }

    if (!await verifyOTP(email, otp)) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired OTP. Request a new code.' });
    }

    let user;

    try {
      user = await prisma.user.findUnique({ where: { email } });
    } catch (dbError) {
      log.warn(`DB lookup failed in verifyOTPAndLogin: ${(dbError as Error).message}`);
    }

    if (!user) {
      try {
        user = await prisma.user.create({
          data: { email, name: 'Unknown', role: UserRole.DEVELOPER, status: UserStatus.PENDING },
        });
      } catch (dbError) {
        log.warn(`DB create failed in verifyOTPAndLogin: ${(dbError as Error).message}`);
        const isDev = process.env.NODE_ENV === 'development';
        if (isDev) {
          const mockId = `dev-${email.replace(/[^a-z0-9]/gi, '-')}`;
          const accessToken = jwt.sign({ userId: mockId, email }, JWT_SECRET, { expiresIn: accessTokenExp });
          const refreshToken = jwt.sign({ userId: mockId }, REFRESH_SECRET, { expiresIn: accessTokenExp });
          setAuthCookie(reply, accessToken);
          return reply.send({
            accessToken, refreshToken, expiresIn: accessTokenExp,
            isNewUser: true, isComplete: true,
            devMode: true, message: 'Dev mode: DB unavailable, using mock session',
          });
        }
        return reply.status(503).send({ error: 'Service Unavailable', message: 'Database unreachable. Check your DATABASE_URL or start PostgreSQL.' });
      }
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.INACTIVE) {
      return reply.status(403).send({ 
        error: 'Forbidden',
        message: `Account is ${user.status.toLowerCase()}. Contact admin.` 
      });
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: accessTokenExp },
    );

    const refreshToken = await createSession(user.id, request);
    
    setAuthCookie(reply, accessToken);

    const isExisting = !!(user.name && user.name !== 'Unknown');
    
    reply.send({ 
      accessToken, 
      refreshToken,
      expiresIn: accessTokenExp,
      isNewUser: !isExisting,
      isComplete: isExisting,
    });
  } catch (error) {
    log.error('OTP verification error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Verification failed. Is the database running?' });
  }
}

export async function completeProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { name, company, role, phone, email } = request.body as any;
    let userId = (request as any).userId;

    if (!userId && email) {
      try {
        const userByEmail = await prisma.user.findUnique({ where: { email } });
        if (userByEmail) userId = userByEmail.id;
      } catch {
        const isDev = process.env.NODE_ENV === 'development';
        if (isDev && email) {
          userId = `dev-${email.replace(/[^a-z0-9]/gi, '-')}`;
        }
      }
    }

    if (!userId) {
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev && email) {
        userId = `dev-${email.replace(/[^a-z0-9]/gi, '-')}`;
      }
    }

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Token or email required' });
    }

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Name is required' });
    }

    let user;
    try {
      user = await prisma.user.update({
        where: { id: userId },
        data: { 
          name: name.trim(),
          company: company?.trim() || null,
          role: role || UserRole.DEVELOPER,
          phone: phone?.trim() || null,
          status: UserStatus.ACTIVE,
        },
      });
    } catch (dbError) {
      log.warn(`DB update failed in completeProfile: ${(dbError as Error).message}`);
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        const mockId = userId;
        const accessToken = jwt.sign({ userId: mockId, email: email || 'dev@localhost' }, JWT_SECRET, { expiresIn: accessTokenExp });
        const refreshToken = crypto.randomBytes(48).toString('hex');
        setAuthCookie(reply, accessToken);
        return reply.send({
          message: 'Profile completed (dev mode, no DB)', devMode: true,
          accessToken, refreshToken, redirectTo: '/dashboard',
          user: { id: mockId, email: email || 'dev@localhost', name: name.trim(), role: 'DEVELOPER', status: 'ACTIVE' },
        });
      }
      return reply.status(503).send({ error: 'Service Unavailable', message: 'Database unreachable.' });
    }

    let workspaceCreated = false;
    try {
      const existingWorkspaces = await prisma.workspace.count({ where: { ownerId: user.id } });
      if (existingWorkspaces === 0) {
        const workspace = await prisma.workspace.create({
          data: {
            name: `${user.name}'s Workspace`,
            slug: `${user.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-workspace`,
            description: 'Auto-created workspace',
            ownerId: user.id,
          },
        });
        workspaceCreated = true;

        const existingClusters = await prisma.cluster.count({
          where: { workspace: { ownerId: user.id } },
        });

        if (existingClusters === 0) {
          const provider = process.env.K8S_PROVIDER || 'minikube';
          await prisma.cluster.create({
            data: {
              workspaceId: workspace.id,
              name: 'default',
              provider,
              region: 'local',
              status: 'active',
              isDefault: true,
            },
          });
          log.info(`Free cluster created for user ${user.email} in workspace ${workspace.slug}`);
        }
      }
    } catch (wsError) {
      log.warn(`Workspace/cluster creation skipped: ${(wsError as Error).message}`);
    }

    const accessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: accessTokenExp });
    const refreshToken = await createSession(user.id, request);
    setAuthCookie(reply, accessToken);

    reply.send({ 
      message: 'Profile completed', 
      accessToken, refreshToken,
      redirectTo: '/dashboard',
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    log.error('Complete profile error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to complete profile' });
  }
}

export async function refreshToken(request: FastifyRequest, reply: FastifyReply) {
  const refreshTokenBody = (request.body as any)?.refreshToken;

  if (!refreshTokenBody) {
    return reply.status(400).send({ error: 'Bad Request', message: 'Refresh token is required' });
  }

  try {
    const hashedToken = hashToken(refreshTokenBody);
    const session = await prisma.session.findUnique({ where: { refreshToken: hashedToken } });

    if (!session) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid refresh token' });
    }

    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } });
      return reply.status(401).send({ error: 'Unauthorized', message: 'Refresh token expired. Please login again.' });
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      await prisma.session.delete({ where: { id: session.id } });
      return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.INACTIVE) {
      return reply.status(403).send({ 
        error: 'Forbidden',
        message: `Account is ${user.status.toLowerCase()}` 
      });
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET, 
      { expiresIn: accessTokenExp }
    );

    await prisma.session.delete({ where: { id: session.id } });
    const newRefreshToken = await createSession(user.id, request);

    setAuthCookie(reply, accessToken);

    reply.send({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: accessTokenExp,
    });
  } catch {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired refresh token' });
  }
}
