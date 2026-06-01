import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { EmailConfirmationService } from "./email-confirmation.service";
import { type Request } from "express";
import { ConfirmationDto } from "./dtos/confirmation.dto";

@Controller("auth/email-confirmation")
export class EmailConfirmationController {
    constructor(private readonly emailConfirmationService: EmailConfirmationService) {}

    @Post("/")
    @HttpCode(HttpStatus.OK)
    async verifyEmail(@Req() req: Request, @Body() dto: ConfirmationDto) {
        return this.emailConfirmationService.verifyEmail(req, dto);
    }
}
