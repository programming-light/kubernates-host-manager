import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@k8s-platform/shared';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
