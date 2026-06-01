import { Module } from "@nestjs/common";
import { KeyService } from "./key.service";
import { KeyController } from "./key.controller";
import { AuthModule } from "../auth/auth.module";
import { UserModule } from "../user/user.module";

@Module({
    imports: [AuthModule, UserModule],
    controllers: [KeyController],
    providers: [KeyService],
    exports: [KeyService]
})
export class KeyModule {}
