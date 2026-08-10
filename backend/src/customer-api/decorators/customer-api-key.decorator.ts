import { applyDecorators, UseGuards } from "@nestjs/common";
import { CustomerApiKeyGuard } from "../guards/customer-api-key.guard";

export const CustomerApiKey = () => applyDecorators(UseGuards(CustomerApiKeyGuard));

