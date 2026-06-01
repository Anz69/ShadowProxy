import * as dns from "dns";

export async function resolveHost(domain: string): Promise<string> {
    try {
        const { address } = await dns.promises.lookup(domain);
        return address;
    } catch {
        return domain;
    }
}
