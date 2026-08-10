import { ServerRegion } from "../../proxy/types/server-region.type";

export class BaseDto {
    signature: string;
    timestamp: number;
    nodeLocation: keyof ServerRegion;
    correlationId?: string
}
