import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type UtmTouch = {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
};

@Injectable()
export class UtmAttributionService {
    constructor(private readonly prisma: PrismaService) {}

    private clean(value: unknown) {
        if (typeof value !== "string") return undefined;
        const v = value.trim().slice(0, 200);
        return v || undefined;
    }

    /** Обрезанные UTM-поля или undefined, если меток нет совсем. */
    normalize(touch?: Record<string, unknown> | null): UtmTouch | undefined {
        const utm = { utmSource: this.clean(touch?.utmSource), utmMedium: this.clean(touch?.utmMedium), utmCampaign: this.clean(touch?.utmCampaign) };
        return utm.utmSource || utm.utmMedium || utm.utmCampaign ? utm : undefined;
    }

    /** UTM из cookie OAuth-флоу (JSON, выставляется в /auth/oauth/connect). */
    parseCookie(raw?: string): UtmTouch | undefined {
        if (!raw) return undefined;
        try {
            return this.normalize(JSON.parse(raw));
        } catch {
            return undefined;
        }
    }

    /** Поля users для новой регистрации: сырые UTM + кампания, если utm_campaign совпал со slug. */
    async resolve(touch?: UtmTouch): Promise<UtmTouch & { utmCampaignId?: string }> {
        const utm = this.normalize(touch);
        if (!utm) return {};

        const campaign = utm.utmCampaign
            ? await this.prisma.marketingCampaign.findUnique({ where: { slug: utm.utmCampaign.toLowerCase() }, select: { id: true } }).catch(() => null)
            : null;

        return { ...utm, ...(campaign ? { utmCampaignId: campaign.id } : {}) };
    }
}
