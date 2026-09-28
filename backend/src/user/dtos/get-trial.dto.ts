import { IsIn } from "class-validator";
import { TRIAL_TARIFFS } from "../trial-tariffs";

export class GetTrialDto {
    @IsIn(TRIAL_TARIFFS)
    tariffType: (typeof TRIAL_TARIFFS)[number];
}
