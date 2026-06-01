import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { ResetPasswordService } from "./reset-password.service";
import { type Request } from "express";
import { ResetPasswordDto } from "./dtos/reset-password.dto";
import { Recaptcha } from "@nestlab/google-recaptcha";
import { RequestPasswordResetDto } from "./dtos/request-password-reset.dto";

@Controller("auth/reset-password")
export class ResetPasswordController {
    constructor(private readonly resetPasswordService: ResetPasswordService) {}

    @Recaptcha()
    @Post("/request")
    @HttpCode(HttpStatus.OK)
    async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
        return this.resetPasswordService.sendResetEmail(dto.email);
    }

    @Post()
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Req() req: Request, @Body() dto: ResetPasswordDto) {
        return this.resetPasswordService.resetPassword(req, dto);
    }
}
