import { Module } from "@nestjs/common";
import { CryptoBotProvider } from "./services/crypto-bot.provider";
import { HeleketProvider } from "./services/heleket.provider";

@Module({
    providers: [CryptoBotProvider, HeleketProvider],
    exports: [CryptoBotProvider, HeleketProvider],
})
export class PaymentProvidersModule {}
