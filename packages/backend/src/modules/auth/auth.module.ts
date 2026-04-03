import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WorkspaceService } from './workspace.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaService } from '../../common/prisma.service';
import { EncryptionService } from '../../common/encryption.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'your-secret-key',
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION') || '15m',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, WorkspaceService, JwtStrategy, PrismaService, EncryptionService],
  exports: [AuthService, WorkspaceService, JwtModule],
})
export class AuthModule {}
