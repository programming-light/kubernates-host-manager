import { Controller, Post, Get, Body, UseGuards, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { WorkspaceService } from './workspace.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SignupDto, LoginDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto, ChangePasswordDto } from './dto/auth.dto';
import { CreateWorkspaceDto, UpdateWorkspaceDto, InviteMemberDto, UpdateMemberRoleDto } from './dto/workspace.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private workspaceService: WorkspaceService,
  ) {}

  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() req: any) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Post('refresh')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: any, @Body() body: { refreshToken: string }) {
    await this.authService.logout(user.sub, body.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('verify-email')
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@CurrentUser() user: any, @Body() changePasswordDto: ChangePasswordDto) {
    return this.authService.changePassword(user.sub, changePasswordDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.sub);
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@CurrentUser() user: any, @Body() updateData: { name?: string; avatar?: string }) {
    return this.authService.updateProfile(user.sub, updateData);
  }

  // Workspace endpoints
  @Post('workspaces')
  @UseGuards(JwtAuthGuard)
  async createWorkspace(@CurrentUser() user: any, @Body() createWorkspaceDto: CreateWorkspaceDto) {
    return this.workspaceService.createWorkspace(user.sub, createWorkspaceDto);
  }

  @Get('workspaces')
  @UseGuards(JwtAuthGuard)
  async listWorkspaces(@CurrentUser() user: any) {
    return this.workspaceService.listWorkspaces(user.sub);
  }

  @Get('workspaces/:workspaceId')
  @UseGuards(JwtAuthGuard)
  async getWorkspace(@CurrentUser() user: any, @Req() req: any) {
    return this.workspaceService.getWorkspace(user.sub, req.params.workspaceId);
  }

  @Post('workspaces/:workspaceId')
  @UseGuards(JwtAuthGuard)
  async updateWorkspace(@CurrentUser() user: any, @Req() req: any, @Body() updateWorkspaceDto: UpdateWorkspaceDto) {
    return this.workspaceService.updateWorkspace(user.sub, req.params.workspaceId, updateWorkspaceDto);
  }

  @Post('workspaces/:workspaceId/members/invite')
  @UseGuards(JwtAuthGuard)
  async inviteMember(@CurrentUser() user: any, @Req() req: any, @Body() inviteMemberDto: InviteMemberDto) {
    return this.workspaceService.inviteMember(user.sub, req.params.workspaceId, inviteMemberDto);
  }

  @Post('workspaces/:workspaceId/members/:memberId/accept')
  @UseGuards(JwtAuthGuard)
  async acceptInvitation(@CurrentUser() user: any, @Req() req: any) {
    return this.workspaceService.acceptInvitation(user.sub, req.params.workspaceId);
  }

  @Post('workspaces/:workspaceId/members/:memberId/role')
  @UseGuards(JwtAuthGuard)
  async updateMemberRole(@CurrentUser() user: any, @Req() req: any, @Body() updateMemberRoleDto: UpdateMemberRoleDto) {
    return this.workspaceService.updateMemberRole(user.sub, req.params.workspaceId, req.params.memberId, updateMemberRoleDto);
  }

  @Post('workspaces/:workspaceId/members/:memberId/remove')
  @UseGuards(JwtAuthGuard)
  async removeMember(@CurrentUser() user: any, @Req() req: any) {
    return this.workspaceService.removeMember(user.sub, req.params.workspaceId, req.params.memberId);
  }

  @Get('workspaces/:workspaceId/members')
  @UseGuards(JwtAuthGuard)
  async getMembers(@CurrentUser() user: any, @Req() req: any) {
    return this.workspaceService.getMembers(user.sub, req.params.workspaceId);
  }
}
