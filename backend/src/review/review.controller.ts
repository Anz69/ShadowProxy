import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ReviewService } from "./review.service";
import { CreateReviewDto } from "./dtos/create-review.dto";
import { Authorization } from "../auth/decorators/auth.decorator";
import { User } from "../auth/decorators/user.decorator";
import { UserRole } from "@prisma/client";

@Controller()
export class ReviewController {
    constructor(private readonly reviewService: ReviewService) {}

    @Post("/reviews")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async create(@Body() dto: CreateReviewDto, @User("id") userId: string) {
        return this.reviewService.create(userId, dto);
    }

    @Get("/reviews/me")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async myReview(@User("id") userId: string) {
        const review = await this.reviewService.findOneByUser(userId);
        const eligible = await this.reviewService.hasPaidPurchase(userId);
        const reviewDiscountGranted =
            await this.reviewService.wasReviewDiscountGranted(userId);
        return { hasReview: !!review, review, eligible, reviewDiscountGranted };
    }

    @Get("/admin/reviews")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async adminList(
        @Query("ratings") ratings?: string,
        @Query("rating") rating?: string,
        @Query("sort") sort?: "new" | "old",
        @Query("q") q?: string,
        @Query("page") page?: string,
    ) {
        const rawRatings = ratings ?? rating;
        return this.reviewService.adminList({
            ratings: rawRatings
                ? rawRatings
                      .split(",")
                      .map((s) => parseInt(s, 10))
                      .filter((n) => !Number.isNaN(n))
                : undefined,
            sort: sort === "old" ? "old" : "new",
            q: q || undefined,
            page: page ? parseInt(page, 10) : 1,
        });
    }

    @Get("/admin/reviews/stats")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async adminStats() {
        return this.reviewService.adminStats();
    }

    @Delete("/admin/reviews/:id")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async adminDelete(@Param("id") id: string) {
        return this.reviewService.adminDelete(id);
    }
}
