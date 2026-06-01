import { Module } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { PaymentProvidersModule } from "./providers/payment-providers.module";
import { AuthModule } from "../auth/auth.module";
import { UserModule } from "../user/user.module";
import { SettingsModule } from "../settings/settings.module";
import { PackageModule } from "../package/package.module";
import { ProxyModule } from "../proxy/proxy.module";
import { ReferralModule } from "../referral/referral.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
    imports: [PaymentProvidersModule, AuthModule, UserModule, SettingsModule, PackageModule, ProxyModule, ReferralModule, NotificationModule],
    controllers: [PaymentsController],
    providers: [PaymentsService],
})
export class PaymentsModule {}
