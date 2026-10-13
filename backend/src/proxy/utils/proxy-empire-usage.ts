export type ProxyEmpireBandwidth = { total: number; used: number; remaining: number };

const TOLERANCE = 1024n * 1024n;

function bytes(value: number): bigint {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid ProxyEmpire bandwidth counter");
    return BigInt(value);
}

export function reconcileProxyEmpireUsage(
    localLeft: string,
    previousUsed: string,
    bandwidth: ProxyEmpireBandwidth | undefined,
): { left: string; snapshot: string; charged: bigint; mismatch: boolean } {
    const left = BigInt(localLeft || "0");
    const snapshot = BigInt(previousUsed || "0");
    if (!bandwidth) return { left: String(left), snapshot: String(snapshot), charged: 0n, mismatch: false };

    const total = bytes(bandwidth.total);
    const used = bytes(bandwidth.used);
    const remaining = bytes(bandwidth.remaining);
    const calculatedRemaining = total > used ? total - used : 0n;
    if (remaining > total || (remaining > calculatedRemaining ? remaining - calculatedRemaining : calculatedRemaining - remaining) > TOLERANCE) {
        throw new Error("Inconsistent ProxyEmpire bandwidth counters");
    }

    // Zero is the old sentinel for "never synced". We cannot know from the
    // counter alone whether an earlier purchase/adjustment already charged it.
    const mismatch = total + TOLERANCE < left;
    if (mismatch) return { left: String(left), snapshot: String(snapshot), charged: 0n, mismatch: true };

    const delta = snapshot === 0n ? 0n : used > snapshot ? used - snapshot : 0n;
    let nextLeft = left > delta ? left - delta : 0n;
    // A disabled cron (or its old first-run shortcut) can leave the local balance
    // untouched while the provider has already exhausted the quota. Only use the
    // provider's remaining value when its total plausibly covers our local balance.
    // A lower total means a separate provisioning/drift issue, not proof of usage.
    if (remaining < nextLeft) nextLeft = remaining;

    return {
        left: String(nextLeft),
        snapshot: String(used),
        charged: left - nextLeft,
        mismatch: false,
    };
}
