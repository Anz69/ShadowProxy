import { ServerRegion } from "../../types/server-region.type";
import { ConfigService } from "@nestjs/config";
import { generateRandomString } from "../../../shared/utils/generate-random-string";
import { regionToServer } from "../../../shared/utils/region-to-server";
import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { UserService } from "../../../user/user.service";
import { LoggerService } from "../../../logger/logger.service";
import axios from "axios";

@Injectable()
export class Proxy922Provider {
    private readonly ipList: ServerRegion = {
        cis: "sg.922s5.net",
        europe: "de.922s5.net",
        usa: "us.922s5.net",
    };

    constructor(
        private readonly configService: ConfigService,
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        private readonly logger: LoggerService,
    ) {}

    createProxy(country: string) {
        return {
            username: `${this.configService.getOrThrow<string>("PROXY_NINE_TWO_TWO_USERNAME")}-zone-custom${country !== "GLOBAL" ? `-region-${country.toUpperCase()}` : ""}-sessid-${generateRandomString(8)}`,
            password: this.configService.getOrThrow<string>("PROXY_NINE_TWO_TWO_PASSWORD"),
            host: this.ipList[regionToServer(country)],
            port: 6300,
        };
    }

    async getAvailableLocations() {
        try {
            const locationsRes = await axios.get<{
                data: { country_code: string }[];
            }>("https://docapi.922proxy.com/api/general/regions", {
                params: {
                    token: this.configService.getOrThrow<string>("PROXY_NINE_TWO_TWO_API_TOKEN"),
                    key: this.configService.getOrThrow<string>("PROXY_NINE_TWO_TWO_API_PASSWORD"),
                },
            });
            return locationsRes.data.data.filter((el) => !!el.country_code.length).map((el) => el.country_code.toLowerCase());
        } catch (e: unknown) {
            await this.logger.error(`Ошибка при парсинге доступных локаций на 922 Proxy: ${String(e)}`, undefined, e && typeof e === "object" ? e : undefined);
            return [];
        }
    }
}
