import { DynamicModule, Module } from "@nestjs/common";
import { AsyncOptionsType, OptionsType, ProviderOptionsSymbol } from "./provider.constants";
import { ProviderService } from "./provider.service";

@Module({})
export class ProviderModule {
    static forRoot(options: OptionsType): DynamicModule {
        return {
            module: ProviderModule,
            providers: [
                {
                    useValue: options.services,
                    provide: ProviderOptionsSymbol,
                },
                ProviderService,
            ],
            exports: [ProviderService],
        };
    }

    static forRootAsync(options: AsyncOptionsType): DynamicModule {
        return {
            module: ProviderModule,
            imports: options.imports,
            providers: [
                {
                    useFactory: options.useFactory,
                    provide: ProviderOptionsSymbol,
                    inject: options.inject,
                },
                ProviderService,
            ],
            exports: [ProviderService],
        };
    }
}
