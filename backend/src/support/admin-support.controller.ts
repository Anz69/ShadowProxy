import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    UploadedFiles,
    UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { UserRole } from "@prisma/client";
import { SupportService } from "./support.service";
import { ProxyService } from "../proxy/proxy.service";
import { Authorization } from "../auth/decorators/auth.decorator";
import { ListSupportTicketsDto, SetTicketStatusDto } from "./dtos/admin-support.dto";
import { SendSupportMessageDto } from "./dtos/send-support-message.dto";
import { SUPPORT_MAX_FILES, supportMulterOptions, toAttachments } from "./support-upload";

/** Админ-часть системы поддержки (ТЗ п.2): диалоги, быстрые действия, чекер прокси. */
@Controller("admin/support")
@Authorization(UserRole.ADMIN)
export class AdminSupportController {
    constructor(
        private readonly supportService: SupportService,
        private readonly proxyService: ProxyService,
    ) {}

    /** Список обращений: фильтр статус + поиск (email/id/tg) + пагинация (ТЗ 2.1). */
    @Get("tickets")
    @HttpCode(HttpStatus.OK)
    async listTickets(@Query() dto: ListSupportTicketsDto) {
        return this.supportService.listTicketsForAdmin(dto);
    }

    /** Число тикетов с непрочитанными сообщениями юзеров (бейдж в AdminNav). */
    @Get("unread-count")
    @HttpCode(HttpStatus.OK)
    async unreadCount() {
        return this.supportService.unreadCountForAdmin();
    }

    /** Диалог + данные юзера для быстрых действий. */
    @Get("tickets/:ticketId")
    @HttpCode(HttpStatus.OK)
    async getTicket(@Param("ticketId") ticketId: string) {
        return this.supportService.getTicketForAdmin(ticketId);
    }

    /** Отметить сообщения юзера прочитанными (админ открыл диалог). */
    @Post("tickets/:ticketId/read")
    @HttpCode(HttpStatus.OK)
    async markRead(@Param("ticketId") ticketId: string) {
        return this.supportService.markReadByAdmin(ticketId);
    }

    /** Ответ поддержки (с вложениями) — уведомление + email юзеру. */
    @Post("tickets/:ticketId/messages")
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(FilesInterceptor("files", SUPPORT_MAX_FILES, supportMulterOptions))
    async reply(
        @Param("ticketId") ticketId: string,
        @Body() dto: SendSupportMessageDto,
        @UploadedFiles() files?: Express.Multer.File[],
    ) {
        return this.supportService.sendAdminMessage(ticketId, dto.text ?? "", toAttachments(files));
    }

    @Patch("tickets/:ticketId/status")
    @HttpCode(HttpStatus.OK)
    async setStatus(@Param("ticketId") ticketId: string, @Body() dto: SetTicketStatusDto) {
        return this.supportService.setTicketStatus(ticketId, dto.status);
    }

    // ── Быстрые действия по прокси клиента (ТЗ 2.2в, 2.3) ─────────────────────

    /** Прокси клиента + история генераций. */
    @Get("users/:userId/proxies")
    @HttpCode(HttpStatus.OK)
    async userProxies(@Param("userId") userId: string) {
        return this.proxyService.getUserProxiesForAdmin(userId);
    }

    /** Чекер прокси (ТЗ 2.3): works/exitIp/country/ping. */
    @Post("proxies/:proxyId/check")
    @HttpCode(HttpStatus.OK)
    async checkProxy(@Param("proxyId") proxyId: string) {
        return this.proxyService.checkProxyForSupport(proxyId);
    }
}
