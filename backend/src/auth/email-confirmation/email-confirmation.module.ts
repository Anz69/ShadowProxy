import { forwardRef, Module } from "@nestjs/common";
import { EmailConfirmationService } from "./email-confirmation.service";
import { EmailConfirmationController } from "./email-confirmation.controller";
import { MailingModule } from "../../mailing/mailing.module";
import { UserModule } from "../../user/user.module";
import { AuthModule } from "../auth.module";
import { MailingService } from "../../mailing/mailing.service";
import { TokenService } from "../../token/token.service";

@Module({
    imports: [MailingModule, forwardRef(() => AuthModule), forwardRef(() => UserModule)],
    controllers: [EmailConfirmationController],
    providers: [EmailConfirmationService, MailingService, TokenService],
    exports: [EmailConfirmationService],
})
export class EmailConfirmationModule {}
