import { Controller, Get, Post, Param, UseGuards, Request, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(AuthGuard('jwt'))
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  list(@Request() req: any) {
    return this.projectsService.listProjects(req.user.tenantId);
  }

  @Post()
  create(@Request() req: any, @Body() dto: any) {
    return this.projectsService.createProject(req.user.tenantId, dto);
  }

  @Get(':id')
  getProject(@Param('id') id: string) {
    return this.projectsService.getProject(id);
  }
}
