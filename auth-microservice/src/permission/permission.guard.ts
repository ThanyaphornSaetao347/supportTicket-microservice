import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionService } from "./permission.service";
import { permissionEnum } from "./permission.service";

@Injectable()
export class PermissionGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private permissionService: PermissionService,
    ){}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredPermissions = this.reflector.getAllAndOverride<permissionEnum[]>('permissions', [
        context.getHandler(),
        context.getClass(),
        ]);

        const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
        context.getHandler(),
        context.getClass(),
        ]);

        if (!requiredPermissions && !requiredRoles) {
        return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
        return false;
        }

        if (requiredPermissions) {
        const hasPermission = await this.permissionService.checkPermission(
            user.id,
            requiredPermissions
        );
        if (!hasPermission) {
            return false;
        }
        }

        if (requiredRoles) {
        const hasRole = await this.permissionService.checkRole(
            user.id,
            requiredRoles
        );
        if (!hasRole) {
            return false;
        }
        }

        return true;
    }
}