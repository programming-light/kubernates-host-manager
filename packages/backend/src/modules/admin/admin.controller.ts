import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard('jwt'))
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('users')
  listUsers(@Request() req: any) {
    return this.adminService.listUsers();
  }

  @Get('tenants')
  listTenants(@Request() req: any) {
    return this.adminService.listTenants();
  }

  @Get('stats')
  getStats(@Request() req: any) {
    return this.adminService.getStats();
  }

  @Get('audit-logs')
  getAuditLogs(@Request() req: any) {
    return this.adminService.getAuditLogs();
  }
}
