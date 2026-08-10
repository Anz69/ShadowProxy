import { Body, Controller, Get, Param, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { type CryptoBotWebhookDataType } from "./providers/types/crypto-bot/crypto-bot-webhook-data.type";
import { type Request } from "express";
import { Authorization } from "../auth/decorators/auth.decorator";
import { CreateResidentInvoiceDto } from "./dtos/create-resident-invoice.dto";
import { User } from "../auth/decorators/user.decorator";
import { type HeleketWebhookData } from "./providers/types/heleket/heleket-webhook.type";
import { CreatePackageInvoiceDto } from "./dtos/create-package-invoice.dto";
import { CreateMobileInvoiceDto } from "./dtos/create-mobile-invoice.dto";
import { UserRole } from "@prisma/client";
import { CreateIspInvoiceDto } from "./dtos/create-isp-invoice.dto";
import { CreateBalanceInvoiceDto } from "./dtos/create-balance-invoice.dto";

@Controller("payments")
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Post("/webhook/crypto-bot")
    @HttpCode(HttpStatus.OK)
    async cryptoBotWebhook(@Req() req: Request, @Body() data: CryptoBotWebhookDataType) {
        return this.paymentsService.processCryptoBotWebhook(req, data);
    }

    @Post("/webhook/heleket")
    @HttpCode(HttpStatus.OK)
    async heleketWebhook(@Body() data: HeleketWebhookData) {
        return this.paymentsService.processHeleketWebhook(data);
    }

    @Post("/invoice/resident")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async createResidentInvoice(@Body() dto: CreateResidentInvoiceDto, @User("id") userId: string) {
        return this.paymentsService.createResidentInvoice(dto, userId);
    }

    @Post("/invoice/isp")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async createISPInvoice(@Body() dto: CreateIspInvoiceDto, @User("id") userId: string) {
        return this.paymentsService.createISPInvoice(dto, userId);
    }

    @Post("/invoice/package")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async createPackageInvoice(@Body() dto: CreatePackageInvoiceDto, @User("id") userId: string) {
        return this.paymentsService.createPackageInvoice(dto, userId);
    }

    @Post("/invoice/mobile")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async createMobileInvoice(@Body() dto: CreateMobileInvoiceDto, @User("id") userId: string) {
        return this.paymentsService.createMobileInvoice(dto, userId);
    }

    @Post("/invoice/balance")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async createBalanceInvoice(@Body() dto: CreateBalanceInvoiceDto, @User("id") userId: string) {
        return this.paymentsService.createBalanceInvoice(dto, userId);
    }

    @Get("/my")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    getMyPayments(@User("id") userId: string) {
        return this.paymentsService.findManyByUserId(userId);
    }

    @Get("/active-discount")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    getActiveDiscount(@User("id") userId: string) {
        return this.paymentsService.getActiveDiscountForUser(userId);
    }

    @Get("/exchange-rates")
    @HttpCode(HttpStatus.OK)
    getExchangeRates() {
        const rawRates = Object.fromEntries(this.paymentsService.exchangeCache.entries());
        return Object.fromEntries(Object.entries(rawRates).map((el) => [el[0], el[1].value]));
    }

    @Get("/user/:userId")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async getUserPayments(@Param("userId") userId: string) {
        return this.paymentsService.findManyByUserId(userId);
    }

    @Get("/test/complete/:paymentId")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async testCompletePayment(@Param("paymentId") paymentId: string) {
        return this.paymentsService.testCompletePayment(paymentId);
    }
}
