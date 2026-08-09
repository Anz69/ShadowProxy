import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Query,
    UploadedFiles,
    UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { SupportService } from "./support.service";
import { Authorization } from "../auth/decorators/auth.decorator";
import { User } from "../auth/decorators/user.decorator";
import { SendSupportMessageDto } from "./dtos/send-support-message.dto";
import { SUPPORT_MAX_FILES, supportMulterOptions, toAttachments } from "./support-upload";

/** Клиентская часть системы поддержки (ТЗ п.1.4): чат с вложениями, polling. */
@Controller("support")
export class SupportController {
    constructor(private readonly supportService: SupportService) {}

    @Get("thread")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async getThread(@User("id") userId: string, @Query("after") after?: string) {
        return this.supportService.getThreadForUser(userId, after);
    }

    @Post("messages")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    @UseInterceptors(FilesInterceptor("files", SUPPORT_MAX_FILES, supportMulterOptions))
    async sendMessage(
        @User("id") userId: string,
        @Body() dto: SendSupportMessageDto,
        @UploadedFiles() files?: Express.Multer.File[],
    ) {
        return this.supportService.sendUserMessage(userId, dto.text ?? "", toAttachments(files));
    }

    @Post("read")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async markRead(@User("id") userId: string) {
        return this.supportService.markReadByUser(userId);
    }

    @Get("unread-count")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async unreadCount(@User("id") userId: string) {
        return this.supportService.unreadCountForUser(userId);
    }
}
