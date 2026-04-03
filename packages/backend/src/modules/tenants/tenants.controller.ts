import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@UseGuards(AuthGuard('jwt'))
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Get('current')
  getCurrentTenant(@Request() req: any) {
    return this.tenantsService.getTenant(req.user.tenantId);
  }
}
