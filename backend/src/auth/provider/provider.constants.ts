import { BaseOauthService } from "./services/base-oauth.service";
import { FactoryProvider, ModuleMetadata } from "@nestjs/common";

export const ProviderOptionsSymbol = Symbol("PROVIDER_OPTIONS");

export type OptionsType = {
    baseUrl: string;
    services: BaseOauthService[];
};

export type AsyncOptionsType = Pick<ModuleMetadata, "imports"> &
    Pick<FactoryProvider<OptionsType>, "useFactory" | "inject">;
