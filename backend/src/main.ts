import "./shared/prototypes/string";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import cookieParser from "cookie-parser";
import { ConfigService } from "@nestjs/config";
import session from "express-session";
import ms from "ms";
import { type StringValue } from "ms";
import { I18nService, I18nValidationExceptionFilter, I18nValidationPipe } from "nestjs-i18n";
import { I18nHttpExceptionFilter } from "./i18n/i18n-exception.filter";
import { ClientRequestAbortedExceptionFilter } from "./filters/client-request-aborted.filter";
import { RedisStore } from "connect-redis";
import { createClient } from "redis";
import { isDev } from "./shared/utils/is-dev";
import process from "node:process";
import { NestExpressApplication } from "@nestjs/platform-express";
import { UPLOADS_ROOT } from "./support/support-upload";

// Build URLs if they contain interpolation (for local dev when .env has ${...})
function buildPostgresUrl(): string {
    const host = (process.env.POSTGRES_HOST || 'postgres').replace(/"/g, '');
    const port = String(process.env.POSTGRES_PORT || '5432').replace(/"/g, '');
    const username = (process.env.POSTGRES_USERNAME || 'postgres').replace(/"/g, '');
    const password = (process.env.POSTGRES_PASSWORD || '').replace(/"/g, '');
    const database = (process.env.POSTGRES_DATABASE || 'shadow_proxy').replace(/"/g, '');
    
    return `postgresql://${username}:${password}@${host}:${port}/${database}`;
}

function buildRedisUrl(): string {
    const host = (process.env.REDIS_HOST || 'redis').replace(/"/g, '');
    const port = String(process.env.REDIS_PORT || '6379').replace(/"/g, '');
    const username = (process.env.REDIS_USERNAME || 'default').replace(/"/g, '');
    const password = (process.env.REDIS_PASSWORD || '').replace(/"/g, '');
    
    return `redis://${username}:${password}@${host}:${port}`;
}

// Auto-build URLs if they contain interpolation (BEFORE app creation, Prisma needs it!)
if (!process.env.POSTGRES_URI || process.env.POSTGRES_URI.includes('${')) {
    process.env.POSTGRES_URI = buildPostgresUrl();
}

if (!process.env.REDIS_URI || process.env.REDIS_URI.includes('${')) {
    process.env.REDIS_URI = buildRedisUrl();
}

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    const config = app.get(ConfigService);
    const useRedis = process.env.REDIS_ENABLED !== "false";
    let sessionStore: session.Store;

    if (useRedis) {
        try {
            const redisClient = createClient({ url: config.getOrThrow<string>("REDIS_URI") });
            await redisClient.connect();
            sessionStore = new RedisStore({
                client: redisClient,
                prefix: "sessions:",
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (isDev(config)) {
                console.warn("[main] Redis недоступен, сессии в памяти:", msg);
                sessionStore = new session.MemoryStore();
            } else {
                throw err;
            }
        }
    } else {
        console.warn("[main] REDIS_ENABLED=false, сессии в памяти (только для разработки)");
        sessionStore = new session.MemoryStore();
    }

    const i18n = app.get<I18nService<Record<string, unknown>>>(I18nService);

    app.useGlobalFilters(new I18nHttpExceptionFilter(i18n));
    app.useGlobalFilters(new I18nValidationExceptionFilter({ detailedErrors: false }));
    app.useGlobalFilters(new ClientRequestAbortedExceptionFilter(app.get(HttpAdapterHost)));
    app.useGlobalPipes(new I18nValidationPipe());

    app.enableCors({
        origin: isDev(config) ? "http://localhost:3000" : config.getOrThrow<string>("HOST"),
        credentials: true,
        exposedHeaders: ["set-cookie"],
    });

    
    app.set("trust proxy", 1);

    app.use(cookieParser(config.getOrThrow<string>("COOKIE_SECRET")));
    app.use(
        session({
            secret: config.getOrThrow<string>("SESSION_SECRET"),
            name: "session",
            resave: true,
            saveUninitialized: false,
            store: sessionStore,
            cookie: {
                maxAge: ms(config.getOrThrow<StringValue>("SESSION_MAX_AGE")),
                httpOnly: true,
                secure: !isDev(config),
                sameSite: !isDev(config) ? "none" : "lax",
            },
        }),
    );

    app.setGlobalPrefix("api");

    // Вложения поддержки (скриншоты/видео): лежат в uploads-volume, раздаются
    // статикой под /api/uploads/* — тот же nginx-маршрут, что и API.
    app.useStaticAssets(UPLOADS_ROOT, {
        prefix: "/api/uploads/",
        maxAge: "30d",
        index: false,
        dotfiles: "deny",
    });

    await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
