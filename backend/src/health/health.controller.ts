import { Controller, Get, Header, HttpCode, HttpStatus } from "@nestjs/common";

@Controller("health")
export class HealthController {
    /**
     * Текстовый ответ для проверки цепочки прокси (GET через выданный прокси на HOST).
     */
    @Get("check")
    @HttpCode(HttpStatus.OK)
    @Header("Content-Type", "text/plain; charset=utf-8")
    check(): string {
        return "ok";
    }
}
