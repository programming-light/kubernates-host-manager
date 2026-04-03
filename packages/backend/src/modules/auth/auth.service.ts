import { Injectable, BadRequestException, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma.service';
import { EncryptionService } from '../../common/encryption.service';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { SignupDto, LoginDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto, ChangePasswordDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private encryptionService: EncryptionService,
  ) {}

  async signup(signupDto: SignupDto) {
    const { email, password, name } = signupDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password with argon2
    const hashedPassword = await argon2.hash(password, {
      type: argon2.ArgonType.id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    // Generate email verification token
    const emailVerificationToken = randomBytes(32).toString('hex');
    const emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        globalRole: 'TENANT_OWNER',
        emailVerificationToken,
        emailVerificationExpiresAt,
      },
    });

    // Create email verification record
    await this.prisma.emailVerification.create({
      data: {
        email,
        token: emailVerificationToken,
        expiresAt: emailVerificationExpiresAt,
      },
    });

    // Generate tokens
    const { accessToken, refreshToken, expiresIn } = await this.generateTokens(user.id);

    // TODO: Send verification email with emailVerificationToken

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
      emailVerified: user.emailVerified,
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  async login(loginDto: LoginDto, ipAddress: string, userAgent: string) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked due to too many login attempts');
    }

    // Verify password
    const passwordValid = await argon2.verify(user.password, password);

    if (!passwordValid) {
      // Increment login attempts
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: user.loginAttempts + 1,
          lockedUntil: user.loginAttempts + 1 >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    // Reset login attempts on successful login
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    // Generate tokens
    const { accessToken, refreshToken, expiresIn } = await this.generateTokens(user.id);

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        action: 'user.login',
        resourceType: 'user',
        resourceId: user.id,
        userId: user.id,
        ipAddress,
        userAgent,
      },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      globalRole: updatedUser.globalRole,
      emailVerified: updatedUser.emailVerified,
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken: token } = refreshTokenDto;

    // Verify token exists and isn't revoked
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate new tokens
    const { accessToken, refreshToken, expiresIn } = await this.generateTokens(user.id);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
      emailVerified: user.emailVerified,
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  async logout(userId: string, refreshToken: string) {
    // Revoke refresh token
    await this.prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        action: 'user.logout',
        resourceType: 'user',
        resourceId: userId,
        userId,
      },
    });
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists for security
      return { message: 'If account exists, password reset email has been sent' };
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString('hex');
    const resetExpiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    // Update user with reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpiresAt: resetExpiresAt,
      },
    });

    // Store reset request
    await this.prisma.passwordReset.create({
      data: {
        email,
        token: resetToken,
        expiresAt: resetExpiresAt,
      },
    });

    // TODO: Send password reset email with resetToken

    return { message: 'If account exists, password reset email has been sent' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, password } = resetPasswordDto;

    // Validate token
    const resetRequest = await this.prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRequest || resetRequest.expiresAt < new Date() || resetRequest.usedAt) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: resetRequest.email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hash new password
    const hashedPassword = await argon2.hash(password, {
      type: argon2.ArgonType.id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    // Update password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    // Mark reset as used
    await this.prisma.passwordReset.update({
      where: { token },
      data: { usedAt: new Date() },
    });

    // Revoke all existing refresh tokens for security
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password reset successfully' };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { token } = verifyEmailDto;

    const emailVerification = await this.prisma.emailVerification.findUnique({
      where: { token },
    });

    if (!emailVerification || emailVerification.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: emailVerification.email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update user email verified status
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });

    // Delete verification record
    await this.prisma.emailVerification.delete({
      where: { token },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      emailVerified: updatedUser.emailVerified,
    };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const passwordValid = await argon2.verify(user.password, currentPassword);

    if (!passwordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await argon2.hash(newPassword, {
      type: argon2.ArgonType.id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Revoke all existing refresh tokens for security
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password changed successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspaceMembers: {
          include: {
            workspace: true,
          },
        },
        ownedWorkspaces: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      globalRole: user.globalRole,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt,
      workspaces: [
        ...user.ownedWorkspaces,
        ...user.workspaceMembers.map((m) => m.workspace),
      ],
    };
  }

  async updateProfile(userId: string, updateData: { name?: string; avatar?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      globalRole: user.globalRole,
      emailVerified: user.emailVerified,
    };
  }

  private async generateTokens(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refreshTokenString = randomBytes(32).toString('hex');
    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshTokenString,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenString,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }
}
