import * as net from "net";
import { probeUpstreamTunnel, tunnelTargetFromUrl } from "./upstream-probe";

/**
 * FlashProxy держит HTTP CONNECT и SOCKS5 на одном порту, но HTTP периодически
 * отвечает 407 или висит до таймаута. Проверка страны обязана распознавать живой
 * SOCKS5 — иначе генерация отклоняется при полностью рабочем аккаунте провайдера.
 */
describe("probeUpstreamTunnel", () => {
    let server: net.Server | null = null;
    let port = 0;

    /**
     * Фейковый апстрим. Держит состояние на сокете, а не набор once("data"):
     * клиент присылает приветствие, логин и CONNECT отдельными пакетами, и
     * подписка «по факту» теряла часть из них.
     */
    const startServer = async (httpStatus: string | null, socksWorks: boolean) => {
        server = net.createServer((socket) => {
            let buffer = Buffer.alloc(0);
            let mode: "unknown" | "http" | "socks" = "unknown";
            let socksStage: "greet" | "auth" | "connect" | "done" = "greet";

            socket.on("data", (chunk: Buffer) => {
                buffer = Buffer.concat([buffer, chunk]);

                if (mode === "unknown") {
                    if (buffer[0] === 0x05) mode = "socks";
                    else mode = "http";
                }

                if (mode === "http") {
                    if (httpStatus) socket.end(httpStatus);
                    else socket.destroy();
                    return;
                }

                if (!socksWorks) {
                    socket.destroy();
                    return;
                }

                // SOCKS5: приветствие → выбор метода → аутентификация → CONNECT.
                if (socksStage === "greet" && buffer.length >= 2) {
                    buffer = Buffer.alloc(0);
                    socksStage = "auth";
                    socket.write(Buffer.from([0x05, 0x02]));
                    return;
                }
                if (socksStage === "auth" && buffer.length >= 2) {
                    buffer = Buffer.alloc(0);
                    socksStage = "connect";
                    socket.write(Buffer.from([0x01, 0x00]));
                    return;
                }
                if (socksStage === "connect" && buffer.length >= 5) {
                    buffer = Buffer.alloc(0);
                    socksStage = "done";
                    // REP=0 (успех), ATYP=1, BND.ADDR=0.0.0.0, BND.PORT=0
                    socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
                }
            });
            socket.on("error", () => socket.destroy());
        });
        await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
        port = (server!.address() as net.AddressInfo).port;
    };

    afterEach(async () => {
        if (server) {
            const s = server;
            server = null;
            await new Promise<void>((resolve) => s.close(() => resolve()));
        }
    });

    const upstream = () => ({ host: "127.0.0.1", port, username: "u", password: "p" });
    const target = { host: "example.com", port: 443 };

    it("распознаёт туннель SOCKS5, когда HTTP CONNECT отвечает 407", async () => {
        await startServer("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n", true);
        const result = await probeUpstreamTunnel(upstream(), target);
        expect(result.ok).toBe(true);
        expect(result.protocol).toBe("socks5");
        // 407 от HTTP не должен превращаться в «аккаунт провайдера не авторизован»,
        // если SOCKS5 тем же кредам туннель поднимает.
        expect(result.authRejected).toBe(false);
    }, 20000);

    it("возвращает ok при живом HTTP CONNECT", async () => {
        await startServer("HTTP/1.1 200 Connection Established\r\n\r\n", true);
        const result = await probeUpstreamTunnel(upstream(), target);
        expect(result.ok).toBe(true);
        expect(result.protocol).toBe("http");
    }, 20000);

    it("сообщает ok=false, когда оба протокола недоступны", async () => {
        await startServer("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n", false);
        const result = await probeUpstreamTunnel(upstream(), target);
        expect(result.ok).toBe(false);
        expect(result.protocol).toBeNull();
        expect(result.error).toBeTruthy();
    }, 20000);

    it("извлекает хост и порт из health-URL", () => {
        expect(tunnelTargetFromUrl("https://shadowproxy.io/api/health/check")).toEqual({
            host: "shadowproxy.io",
            port: 443,
        });
        expect(tunnelTargetFromUrl("http://example.com:8080/x")).toEqual({ host: "example.com", port: 8080 });
    });
});
