import { forwardRef, Module } from "@nestjs/common";
import { SupportService } from "./support.service";
import { SupportController } from "./support.controller";
import { AuthModule } from "../auth/auth.module";
import { UserModule } from "../user/user.module";
import { NotificationModule } from "../notification/notification.module";
import { MailingModule } from "../mailing/mailing.module";

@Module({
    imports: [AuthModule, forwardRef(() => UserModule), NotificationModule, MailingModule],
    controllers: [SupportController],
    providers: [SupportService],
    exports: [SupportService],
})
export class SupportModule {}
