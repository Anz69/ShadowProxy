/**
 * Генерация коротких логинов и паролей на основе CRC32 + Base62
 */

import { createHash } from "crypto";

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Фиксированный порт прокси (V2 — один порт для всех) */
export const PROXY_SERVER_PORT = 10000;

/**
 * Формирует логин в формате package-{shortHash}-user-{providerUsername}
 * shortHash — первые 8 символов sha256 от packageId (для разделения по пакетам)
 */
export function buildProxyLogin(packageId: string, providerUsername: string): string {
    const hash = createHash("sha256").update(packageId).digest("hex").slice(0, 8);
    return `package-${hash}-user-${providerUsername}`;
}

/**
 * Вычисление CRC32
 */
function crc32(input: string): number {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < input.length; i++) {
        crc ^= input.charCodeAt(i);
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Конвертация числа в Base62
 */
function toBase62(value: number, minLength: number = 6): string {
    let result = "";
    let num = value;
    do {
        result = BASE62[num % 62] + result;
        num = Math.floor(num / 62);
    } while (num > 0);
    return result.padStart(minLength, "0");
}

/**
 * Генерация логина на основе packageId, port и итерации
 */
export function generateLogin(packageId: string, port: number, iteration: number = 0): string {
    const input = `${packageId}_${port}_${iteration}`;
    const hash = crc32(input);
    return toBase62(hash, 6);
}

/**
 * Генерация пароля на основе packageId, port и итерации (V1)
 * Пароль отличается от логина добавлением одного символа
 */
export function generatePassword(packageId: string, port: number, iteration: number = 0): string {
    const input = `${packageId}_${port}_${iteration}_pwd`;
    const hash = crc32(input);
    const base62 = toBase62(hash, 6);
    const extraChar = BASE62[(hash % 62)];
    return base62 + extraChar; // 7 символов
}

/**
 * Генерация пароля для V2 (без портов): packageId + loginSuffix для уникальности
 */
export function generatePasswordV2(packageId: string, loginSuffix: string, iteration: number = 0): string {
    const input = `${packageId}_${loginSuffix}_${iteration}_pwd`;
    const hash = crc32(input);
    const base62 = toBase62(hash, 8);
    const extraChar = BASE62[(hash % 62)];
    return base62 + extraChar;
}


