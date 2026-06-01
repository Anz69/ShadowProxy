import { randomBytes } from "crypto";

export function generateRandomString(length: number = 24): string {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const chars = letters + "0123456789";

    let result = letters[randomBytes(1)[0] % letters.length];
    const bytes = randomBytes(length - 1);

    for (let i = 0; i < length - 1; i++) {
        result += chars[bytes[i] % chars.length];
    }

    return result[0].toLowerCase() + result.slice(1);
}
