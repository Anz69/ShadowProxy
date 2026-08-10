import { forwardRef, Module } from "@nestjs/common";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";
import { PackageModule } from "../package/package.module";
import { ProxyModule } from "../proxy/proxy.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
    imports: [
        forwardRef(() => PackageModule),
        forwardRef(() => ProxyModule),
        forwardRef(() => NotificationModule),
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService],
})
export class UserModule {}
