import { IsInt, IsString, Max, Min, MinLength } from "class-validator";

export class CreateReviewDto {
    @IsInt({ message: "errors.review_invalid_rating" })
    @Min(1, { message: "errors.review_invalid_rating" })
    @Max(5, { message: "errors.review_invalid_rating" })
    rating: number;

    @IsString()
    @MinLength(20, { message: "errors.review_text_too_short" })
    text: string;
}
