import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { isDevEnv } from "../../shared/utils/is-dev";

export const RealIp = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    if (isDevEnv) {
        return "1.178.1.1";
    }
    const forwarded = request.headers["x-forwarded-for"];
    const ip =
        (typeof forwarded === "string" ? forwarded.split(",")[0] : request.socket.remoteAddress) ||
        "";
    return ip.replace(/^::ffff:/, "");
});
