import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(private readonly configService: ConfigService) {}

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest();
        const header = req.headers["api-key"];
        const providedKey = Array.isArray(header) ? header[0] : header;
        const expectedKey = this.configService.get<string>("SUB_API_KEY");
        if (!providedKey || !expectedKey || providedKey !== expectedKey) {
            throw new UnauthorizedException("Invalid API key");
        }
        return true;
    }
}
