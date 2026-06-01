import * as process from "node:process";
import * as dotenv from "dotenv";
import { ConfigService } from "@nestjs/config";

dotenv.config();

export const isDev = (configService: ConfigService) => {
    return configService.getOrThrow<string>("NODE_ENV") === "development";
};

export const isDevEnv = process.env.NODE_ENV === "development";
