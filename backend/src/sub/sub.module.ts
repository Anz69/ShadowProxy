import { Module } from "@nestjs/common";
import { SubController } from "./sub.controller";
import { SubService } from "./sub.service";
import { ProxyModule } from "../proxy/proxy.module";
import { KeyModule } from "../key/key.module";

@Module({
    imports: [ProxyModule, KeyModule],
    controllers: [SubController],
    providers: [SubService],
})
export class SubModule {}
