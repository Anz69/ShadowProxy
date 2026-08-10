import { AvailableAssets } from "../../types/available-assets.type";

export class CreateInvoiceDto {
    paymentId: string;
    asset: AvailableAssets;
    amount: string;
    description?: string;
}
