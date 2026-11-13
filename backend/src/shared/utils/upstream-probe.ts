import * as net from "net";
import { URL } from "url";

/**
 * Проверка туннеля до апстрим-провайдера без внешних зависимостей.
 *
 * FlashProxy держит на одном и том же порту и HTTP CONNECT, и SOCKS5, причём HTTP
 * периодически отвечает 407 либо висит до таймаута, пока SOCKS5 с теми же кредами
 * поднимает туннель. Раньше проверка ходила только по HTTP CONNECT и объявляла
 * страну недоступной, хотя прокси рабочий. Теперь пробуем оба протокола.
 */

export type UpstreamProbeResult = {
    /** Туннель поднят хотя бы одним протоколом. */
    ok: boolean;
    /** Протокол, которым удалось поднять туннель (null — ни одним). */
    protocol: "http" | "socks5" | null;
    /** Апстрим отверг наши креды (407/401) — проблема аккаунта, а не страны. */
    authRejected: boolean;
    /** Последняя ошибка для лога/диагностики. */
    error: string | null;
};

type ProbeTarget = { host: string; port: number; username: string; password: string };
type Target = { host: string; port: number };

const PROBE_TIMEOUT_MS = 12_000;

/**
 * Пробует HTTP CONNECT и SOCKS5 на одном host:port ПАРАЛЛЕЛЬНО и берёт первый
 * успешный. Последовательный вариант ждал полный таймаут HTTP (у Flash HTTP
 * CONNECT молчит до 12 с), и проверка страны занимала ~13 с на каждый вызов.
 */
export async function probeUpstreamTunnel(upstream: ProbeTarget, target: Target): Promise<UpstreamProbeResult> {
    const protocols: Array<"http" | "socks5"> = ["http", "socks5"];
    const attempts = [tryHttpConnect(upstream, target), trySocks5Connect(upstream, target)];

    // Возвращаемся по первому успеху, не дожидаясь второго протокола: у Flash HTTP
    // CONNECT молчит до таймаута, и ожидание обоих растягивало проверку до 12 с.
    const firstSuccess = await Promise.any(
        attempts.map((p, i) =>
            p.then((r) => {
                if (!r.ok) throw new Error(r.error ?? "недоступно");
                return protocols[i];
            }),
        ),
    ).catch(() => null);
    if (firstSuccess) {
        return { ok: true, protocol: firstSuccess, authRejected: false, error: null };
    }

    const results = await Promise.all(attempts);
    // «Аккаунт не авторизован» сообщаем только когда оба протокола отвергли креды —
    // иначе это отсутствие пула у страны, а не проблема аккаунта провайдера.
    const authRejected = results.every((r) => r.authRejected);
    const errors = results.map((r, i) => `${protocols[i]}: ${r.error ?? "неизвестная ошибка"}`);
    return { ok: false, protocol: null, authRejected, error: errors.join("; ").slice(0, 200) };
}

/** Разбирает health-URL в цель для CONNECT (хост и порт). */
export function tunnelTargetFromUrl(url: string): Target {
    const parsed = new URL(url);
    const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
    return { host: parsed.hostname, port };
}

function connect(upstream: ProbeTarget): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: upstream.host, port: upstream.port });
        const timer = setTimeout(() => {
            socket.destroy();
            reject(new Error("таймаут подключения к апстриму"));
        }, PROBE_TIMEOUT_MS);
        socket.once("connect", () => {
            clearTimeout(timer);
            socket.setTimeout(PROBE_TIMEOUT_MS);
            resolve(socket);
        });
        socket.once("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

/** Читает из сокета до разделителя или до конца ответа. */
function readUntil(socket: net.Socket, marker: string, limit = 4096): Promise<string> {
    return new Promise((resolve, reject) => {
        let buffer = "";
        const onData = (chunk: Buffer) => {
            buffer += chunk.toString("latin1");
            if (buffer.includes(marker) || buffer.length >= limit) {
                cleanup();
                resolve(buffer);
            }
        };
        const onError = (err: Error) => {
            cleanup();
            reject(err);
        };
        const onTimeout = () => {
            cleanup();
            reject(new Error("таймаут ответа апстрима"));
        };
        const cleanup = () => {
            socket.off("data", onData);
            socket.off("error", onError);
            socket.off("timeout", onTimeout);
        };
        socket.on("data", onData);
        socket.once("error", onError);
        socket.once("timeout", onTimeout);
    });
}

async function tryHttpConnect(
    upstream: ProbeTarget,
    target: Target,
): Promise<{ ok: boolean; authRejected: boolean; error: string | null }> {
    let socket: net.Socket | null = null;
    try {
        socket = await connect(upstream);
        const auth = Buffer.from(`${upstream.username}:${upstream.password}`).toString("base64");
        const authority = `${target.host}:${target.port}`;
        socket.write(
            `CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\nProxy-Authorization: Basic ${auth}\r\nProxy-Connection: keep-alive\r\n\r\n`,
        );
        const head = await readUntil(socket, "\r\n\r\n");
        const statusLine = head.split("\r\n")[0] ?? "";
        const status = Number(statusLine.split(" ")[1] ?? 0);
        if (status >= 200 && status < 300) return { ok: true, authRejected: false, error: null };
        const authRejected = status === 407 || status === 401;
        return { ok: false, authRejected, error: status ? `HTTP ${status}` : "пустой ответ" };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, authRejected: /407|401|authentication/i.test(message), error: message };
    } finally {
        socket?.destroy();
    }
}

async function trySocks5Connect(
    upstream: ProbeTarget,
    target: Target,
): Promise<{ ok: boolean; authRejected: boolean; error: string | null }> {
    let socket: net.Socket | null = null;
    try {
        socket = await connect(upstream);
        const sock = socket;
        const read = createReader(sock);
        const hasCreds = Boolean(upstream.username || upstream.password);
        const methods = hasCreds ? [0x00, 0x02] : [0x00];
        sock.write(Buffer.from([0x05, methods.length, ...methods]));

        const sel = await read(2);
        if (sel[0] !== 0x05) return { ok: false, authRejected: false, error: `не SOCKS5 (версия ${sel[0]})` };
        if (sel[1] === 0xff) return { ok: false, authRejected: true, error: "апстрим отклонил методы аутентификации" };
        if (sel[1] === 0x02) {
            const user = Buffer.from(upstream.username);
            const pass = Buffer.from(upstream.password);
            sock.write(Buffer.concat([Buffer.from([0x01, user.length]), user, Buffer.from([pass.length]), pass]));
            const authRes = await read(2);
            if (authRes[1] !== 0x00) return { ok: false, authRejected: true, error: `SOCKS5 auth отклонён (${authRes[1]})` };
        } else if (sel[1] !== 0x00) {
            return { ok: false, authRejected: false, error: `неподдерживаемый метод ${sel[1]}` };
        }

        const hostBytes = Buffer.from(target.host);
        const portBytes = Buffer.alloc(2);
        portBytes.writeUInt16BE(target.port, 0);
        sock.write(Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x03, hostBytes.length]), hostBytes, portBytes]));

        const head = await read(4);
        if (head[0] !== 0x05) return { ok: false, authRejected: false, error: `битый ответ SOCKS5 (${head[0]})` };
        if (head[1] !== 0x00) return { ok: false, authRejected: head[1] === 0x02, error: `SOCKS5 CONNECT отклонён (${head[1]})` };

        // Дочитываем BND.ADDR + BND.PORT, иначе их байты остались бы в туннеле.
        let addrLen: number;
        if (head[3] === 0x01) addrLen = 4;
        else if (head[3] === 0x04) addrLen = 16;
        else if (head[3] === 0x03) addrLen = (await read(1))[0];
        else return { ok: false, authRejected: false, error: `неизвестный ATYP ${head[3]}` };
        await read(addrLen + 2);
        return { ok: true, authRejected: false, error: null };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, authRejected: /auth/i.test(message), error: message };
    } finally {
        socket?.destroy();
    }
}

/**
 * Буферизующий читатель SOCKS5-ответов.
 *
 * Подписка на "data" делается ОДИН раз при создании, а не внутри каждого
 * readBytes: апстрим успевает ответить между write() и навешиванием обработчика,
 * и такой ответ терялся — probe уходил в таймаут на живом сервере.
 */
function createReader(socket: net.Socket) {
    let buffer = Buffer.alloc(0);
    let waiter: { n: number; resolve: (b: Buffer) => void; reject: (e: Error) => void } | null = null;
    let failure: Error | null = null;

    const settle = () => {
        if (!waiter) return;
        if (failure) {
            const w = waiter;
            waiter = null;
            w.reject(failure);
            return;
        }
        if (buffer.length >= waiter.n) {
            const out = buffer.subarray(0, waiter.n);
            buffer = buffer.subarray(waiter.n);
            const w = waiter;
            waiter = null;
            w.resolve(out);
        }
    };

    socket.on("data", (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        settle();
    });
    socket.on("error", (err: Error) => {
        failure = err;
        settle();
    });
    socket.on("timeout", () => {
        failure = new Error("таймаут ответа апстрима");
        settle();
    });
    socket.on("close", () => {
        if (!failure) failure = new Error("апстрим закрыл соединение");
        settle();
    });

    return (n: number): Promise<Buffer> =>
        new Promise<Buffer>((resolve, reject) => {
            waiter = { n, resolve, reject };
            settle();
        });
}

