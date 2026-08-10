import { applyDecorators, UseGuards } from "@nestjs/common";
import { ApiKeyGuard } from "../guards/api-key.guard";

export const ApiKey = () => applyDecorators(UseGuards(ApiKeyGuard));
