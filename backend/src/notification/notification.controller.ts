import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Query } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { Authorization } from "../auth/decorators/auth.decorator";
import { User } from "../auth/decorators/user.decorator";

@Controller("notifications")
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) {}

    @Get()
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async list(@User("id") userId: string, @Query("page") page?: string) {
        return this.notificationService.listForUser(userId, page ? parseInt(page, 10) : 1);
    }

    @Get("/unread-count")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async unreadCount(@User("id") userId: string) {
        return { count: await this.notificationService.unreadCount(userId) };
    }

    @Patch("/read-all")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async markAllRead(@User("id") userId: string) {
        return this.notificationService.markAllRead(userId);
    }

    @Patch("/:id/read")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async markRead(@Param("id") id: string, @User("id") userId: string) {
        return this.notificationService.markRead(id, userId);
    }
}
