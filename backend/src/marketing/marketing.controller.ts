import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Authorization } from "../auth/decorators/auth.decorator";
import { User } from "../auth/decorators/user.decorator";
import { AddExpenseDto, AddNoteDto, CampaignStatsQueryDto, CreateCampaignDto, UpdateCampaignDto } from "./dtos/campaign.dto";
import { MarketingService } from "./marketing.service";

@Controller("admin/marketing/campaigns")
export class MarketingController {
    constructor(private readonly marketingService: MarketingService) {}

    @Get()
    @Authorization(UserRole.ADMIN)
    list() {
        return this.marketingService.list();
    }

    @Post()
    @Authorization(UserRole.ADMIN)
    create(@Body() dto: CreateCampaignDto, @User("id") adminId: string) {
        return this.marketingService.create(dto, adminId);
    }

    @Get(":id")
    @Authorization(UserRole.ADMIN)
    detail(@Param("id") id: string, @Query() query: CampaignStatsQueryDto) {
        return this.marketingService.detail(id, query);
    }

    @Patch(":id")
    @Authorization(UserRole.ADMIN)
    update(@Param("id") id: string, @Body() dto: UpdateCampaignDto, @User("id") adminId: string) {
        return this.marketingService.update(id, dto, adminId);
    }

    @Post(":id/expenses")
    @Authorization(UserRole.ADMIN)
    addExpense(@Param("id") id: string, @Body() dto: AddExpenseDto, @User("id") adminId: string) {
        return this.marketingService.addExpense(id, dto, adminId);
    }

    @Delete(":id/expenses/:expenseId")
    @Authorization(UserRole.ADMIN)
    removeExpense(@Param("id") id: string, @Param("expenseId") expenseId: string, @User("id") adminId: string) {
        return this.marketingService.removeExpense(id, expenseId, adminId);
    }

    @Post(":id/notes")
    @Authorization(UserRole.ADMIN)
    addNote(@Param("id") id: string, @Body() dto: AddNoteDto, @User("id") adminId: string) {
        return this.marketingService.addNote(id, dto, adminId);
    }

    @Delete(":id/notes/:noteId")
    @Authorization(UserRole.ADMIN)
    removeNote(@Param("id") id: string, @Param("noteId") noteId: string, @User("id") adminId: string) {
        return this.marketingService.removeNote(id, noteId, adminId);
    }
}
