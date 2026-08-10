import { Module } from "@nestjs/common";
import { ReviewService } from "./review.service";
import { ReviewController } from "./review.controller";
import { AuthModule } from "../auth/auth.module";
import { UserModule } from "../user/user.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
    imports: [AuthModule, UserModule, NotificationModule],
    controllers: [ReviewController],
    providers: [ReviewService],
    exports: [ReviewService],
})
export class ReviewModule {}
