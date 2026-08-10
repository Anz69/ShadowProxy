import { ServerRegion } from "../../types/server-region.type";
import axios, { AxiosInstance } from "axios";
import { ConfigService } from "@nestjs/config";
import { generateRandomString } from "../../../shared/utils/generate-random-string";
import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { UserService } from "../../../user/user.service";
import { LoggerService } from "../../../logger/logger.service";
import { PackageType, User } from "@prisma/client";
import { Cron } from "@nestjs/schedule";
import { sleep } from "../../../shared/utils/sleep";
import { OnEvent } from "@nestjs/event-emitter";
import { regionToServer } from "../../../shared/utils/region-to-server";
import { ModifyProxiesDto } from "../../dtos/modify-proxies.dto";

@Injectable()
export class LunaProxyProvider {
    private readonly ipList: ServerRegion = {
        cis: "124.243.141.102",
        europe: "43.157.15.127",
        usa: "43.159.20.117",
    };
    private readonly lunaProxyApi: AxiosInstance;

    constructor(
        private readonly configService: ConfigService,
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        private readonly logger: LoggerService,
    ) {
        this.lunaProxyApi = axios.create({
            baseURL: configService.getOrThrow<string>("LUNA_PROXY_BASE_URL"),
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        this.lunaProxyApi.interceptors.request.use((config) => {
            config.data.append("neek", configService.getOrThrow<string>("LUNA_PROXY_NEEK"));
            config.data.append("appkey", configService.getOrThrow<string>("LUNA_PROXY_APP_KEY"));
            return config;
        });
    }

    createProxy(country: string, user: User, rotationTime?: number) {
        const continentLabels = {
            ASIA: "-region-asia",
            EUROPE: "-region-eu",
            NORTH_AMERICA: "-region-north_america",
            SOUTH_AMERICA: "-region-south_america",
            AFRICA: "-region-africa",
        };
        const region = country.length === 2 ? `-region-${country}` : (continentLabels[country] as string);

        console.log(`[LUNA PROVIDER] createProxy called with:`);
        console.log(`[LUNA PROVIDER] country: "${country}"`);
        console.log(`[LUNA PROVIDER] user.residentData: "${user.residentData}"`);
        console.log(`[LUNA PROVIDER] region: "${region}"`);
        console.log(`[LUNA PROVIDER] regionToServer(country): "${regionToServer(country)}"`);
        console.log(`[LUNA PROVIDER] rotationTime: "${rotationTime}"`);
        console.log(`[LUNA PROVIDER] rotationTime type: ${typeof rotationTime}`);
        console.log(`[LUNA PROVIDER] rotationTime truthy: ${!!rotationTime}`);

        const sessionPart = rotationTime ? `-sessid-${generateRandomString(12)}-sesstime-${rotationTime}` : "";
        console.log(`[LUNA PROVIDER] sessionPart: "${sessionPart}"`);

        const result = {
            username: `user-${user.residentData.split(":")[0]}${region}${sessionPart}`,
            password: user.residentData.split(":")[1],
            host: this.ipList[regionToServer(country)],
            port: 12233,
        };

        console.log(`[LUNA PROVIDER] Generated proxy:`, result);
        console.log(`[LUNA PROVIDER] Generated username: "${result.username}"`);

        return result;
    }

    modifyProxy(modifier: Omit<ModifyProxiesDto, "proxies">, username: string) {
        let result = username;

        if (modifier.location) {
            const regionRegex = /-region-[^-]*(?=(?:-sessid-|$))/;
            const newRegion = `-region-${modifier.location.toLowerCase()}`;
            result = result.replace(regionRegex, newRegion);
        }

        if (modifier.rotation) {
            const sessidPattern = /-sessid-([a-zA-Z0-9]{12})-sesstime-(\d+)/;

            if (modifier.rotation === "AUTO") {
                result = result.replace(sessidPattern, "");
            } else if (modifier.rotation === "BY_TIME" && modifier.rotationInterval) {
                if (sessidPattern.test(result)) {
                    result = result.replace(sessidPattern, `-sessid-$1-sesstime-${modifier.rotationInterval}`);
                } else {
                    const sessionId = generateRandomString(12);
                    result += `-sessid-${sessionId}-sesstime-${modifier.rotationInterval}`;
                }
            }
        }

        return result;
    }

    @OnEvent("proxy.create_account")
    async createUser({ userId, type }: { userId: string; type: PackageType }) {
        if (type === "RESIDENT") {
            const user = await this.userService.findById(userId);
            if (!user.residentData.length) {
                try {
                    const username = generateRandomString(12);
                    const password = generateRandomString(12);

                    const data = new FormData();
                    data.append("username", username);
                    data.append("password", password);
                    data.append("flow_limit", "0");
                    const userRes = await this.lunaProxyApi.post<{
                        ret_data: { uid: number };
                    }>("/save_child_user", data);
                    await this.userService.updateById(userId, {
                        residentData: `${username}:${password}:${userRes.data.ret_data.uid}`,
                    });
                    await this.logger.log("SYSTEM", `Успешно создан аккаунт Luna Proxy для пользователя ${userId}`, userId);
                    return true;
                } catch (e: unknown) {
                    await this.logger.error(`Ошибка при создании аккаунта Luna Proxy для юзера ${userId}`, userId, {
                        error: e,
                    });
                    return false;
                }
            }
        }
        return true;
    }

    @OnEvent("user.distribute_traffic")
    async distributeTraffic({ tariff, traffic, userId }: { tariff: PackageType; traffic: string; userId: string }) {
        if (tariff === "RESIDENT") {
            const user = await this.userService.findById(userId);
            const [username, password, id] = user.residentData.split(":");
            try {
                const actualUserRes = await this.getUserById(id);
                const newUserLimit = Number(actualUserRes.data.ret_data.flow_limit) + Number((BigInt(+traffic) * 1000n ** 2n) / 1024n ** 3n) / 1000;
                const data = new FormData();
                data.append("id", id);
                data.append("username", username);
                data.append("password", password);
                data.append("flow_limit", Math.floor(newUserLimit).toString());
                await this.lunaProxyApi.post("/save_child_user", data);
                return true;
            } catch (e: unknown) {
                await this.logger.error(`Ошибка при дистрибуции трафика на аккаунт ${username} (Luna Proxy)`, undefined, {
                    error: e,
                });
                return false;
            }
        }
        return true;
    }

    async getUserById(id: string) {
        const data = new FormData();
        data.append("id", id);
        return this.lunaProxyApi.post<{
            ret_data: { flow_used: bigint | number | string; flow_limit: bigint | number | string };
        }>("/get_child_info", data);
    }

    async getAvailableLocations() {
        try {
            const data = new FormData();
            const locationsRes = await this.lunaProxyApi.post<{
                ret_data: {
                    hosting: { list: { region_code: string }[] }[];
                    isp: { list: { region_code: string }[] }[];
                };
            }>("/get_listppondnew", data);
            return [...locationsRes.data.ret_data.hosting, ...locationsRes.data.ret_data.isp]
                .map((el) => el.list)
                .flat(4)
                .map((el) => el.region_code.split("-")[0])
                .filter((el) => el.length === 2);
        } catch (e: unknown) {
            await this.logger.error(`Ошибка при парсинге доступных локаций на Luna Proxy: ${String(e)}`, undefined, e && typeof e === "object" ? e : undefined);
            return [];
        }
    }

    // @Cron("0 */1 * * * *")
    // async updateUserBalances() {
    //     const allUsers = await this.userService.findMany({
    //         where: {
    //             residentData: {
    //                 not: "",
    //             },
    //         },
    //     });

    //     for (const user of allUsers) {
    //         const userRes = await this.getUserById(user.residentData.split(":")[2]);
    //         if (!userRes?.data?.ret_data?.flow_used || !userRes?.data?.ret_data?.flow_limit) {
    //             continue;
    //         }
    //         const flowUsed = (BigInt(userRes.data.ret_data.flow_used) * 1024n) / 1000n;
    //         const trafficLeft = ((BigInt(userRes.data.ret_data.flow_limit) * 1024n) / 1000n) * 1024n ** 2n - flowUsed;
    //         if (flowUsed > 100n && BigInt(user.residentTrafficLeft) - trafficLeft > 0n) {
    //             await this.logger.log(
    //                 "USAGE",
    //                 `Пользователь ${user.id} потратил ${BigInt(user.residentTrafficLeft) - trafficLeft} байт трафик на резидентские прокси.`,
    //                 user.id,
    //                 {
    //                     used: String(BigInt(user.residentTrafficLeft) - trafficLeft),
    //                     type: "RESIDENT",
    //                 },
    //                 true,
    //             );
    //             await this.userService.updateById(user.id, {
    //                 residentTrafficLeft: String(trafficLeft),
    //                 residentTotalUsed: String(flowUsed),
    //             });
    //         }
    //         await sleep(1000);
    //     }
    // }
}
