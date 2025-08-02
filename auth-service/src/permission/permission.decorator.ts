import { SetMetadata } from "@nestjs/common";
import { permissionEnum } from "./permission.service";

export const requirePermissions = (...permissions: permissionEnum[]) =>
    SetMetadata('permissions', permissions);

export const RequireRoles = (...roles: string[]) =>
    SetMetadata('roles', roles);