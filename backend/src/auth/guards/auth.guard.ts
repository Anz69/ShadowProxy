import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { UserService } from "../../user/user.service";

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly userService: UserService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();

        if (typeof request.session.userId === "undefined") {
            throw new UnauthorizedException("errors.not_authorized");
        }

        request.user = await this.userService.findById(request.session.userId);

        return true;
    }
}
