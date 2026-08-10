import { forwardRef, Module } from "@nestjs/common";
import { ResetPasswordService } from "./reset-password.service";
import { ResetPasswordController } from "./reset-password.controller";
import { TokenService } from "../../token/token.service";
import { UserModule } from "../../user/user.module";
import { MailingService } from "../../mailing/mailing.service";
import { AuthModule } from "../auth.module";

@Module({
    imports: [AuthModule, forwardRef(() => UserModule)],
    controllers: [ResetPasswordController],
    providers: [ResetPasswordService, TokenService, MailingService],
})
export class ResetPasswordModule {}
