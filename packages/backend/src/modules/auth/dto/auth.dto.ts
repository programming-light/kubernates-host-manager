import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;
}

export class VerifyEmailDto {
  @IsString()
  token: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  newPassword: string;
}

export class AuthResponseDto {
  id: string;
  email: string;
  name: string;
  globalRole: string;
  emailVerified: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class TokenPayloadDto {
  sub: string;
  email: string;
  name: string;
  globalRole: string;
  iat: number;
  exp: number;
}
