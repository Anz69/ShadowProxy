import { Module } from "@nestjs/common";
import { CryptoBotProvider } from "./services/crypto-bot.provider";
import { HeleketProvider } from "./services/heleket.provider";
import { XRocketProvider } from "./services/xrocket.provider";

@Module({
    providers: [CryptoBotProvider, HeleketProvider, XRocketProvider],
    exports: [CryptoBotProvider, HeleketProvider, XRocketProvider],
})
export class PaymentProvidersModule {}
