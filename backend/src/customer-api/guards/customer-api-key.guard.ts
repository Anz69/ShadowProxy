import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { UserService } from "../../user/user.service";
import { ApiKeyNotFoundException, InvalidApiKeyException } from "../exceptions/api-key.exception";

@Injectable()
export class CustomerApiKeyGuard implements CanActivate {
    constructor(private readonly userService: UserService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const header = req.headers["api-key"] || req.headers["authorization"];
        
        let apiKey: string | undefined;
        
        if (header) {
            const headerValue = Array.isArray(header) ? header[0] : header;
            // Если это Authorization header, проверяем формат Bearer TOKEN
            if (typeof headerValue === "string" && headerValue.startsWith("Bearer ")) {
                apiKey = headerValue.substring(7);
            } else if (typeof headerValue === "string") {
                apiKey = headerValue;
            }
        }

        if (!apiKey) {
            throw new ApiKeyNotFoundException();
        }

        const user = await this.userService.findByApiKey(apiKey);
        
        if (!user) {
            throw new InvalidApiKeyException();
        }

        // Сохраняем пользователя в request для использования в контроллере
        req.user = user;
        
        return true;
    }
}

