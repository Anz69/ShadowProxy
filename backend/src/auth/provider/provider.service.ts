import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { type OptionsType, ProviderOptionsSymbol } from "./provider.constants";
import { BaseOauthService } from "./services/base-oauth.service";

@Injectable()
export class ProviderService implements OnModuleInit {
    constructor(@Inject(ProviderOptionsSymbol) private readonly options: OptionsType) {}

    onModuleInit() {
        for (const provider of this.options.services) {
            provider.baseUrl = this.options.baseUrl;
        }
    }

    findByService(service: string): BaseOauthService | undefined {
        return this.options.services.find((el) => el.name === service);
    }
}
