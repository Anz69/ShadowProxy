import { PackageType } from "@prisma/client";
import { isProxyTypeDisabled } from "../shared/constants/sprint-gating";

export const TRIAL_TARIFFS: readonly PackageType[] =
    (["RESIDENT_PREMIUM", "ISP_USA", "RESIDENTIAL_LITE"] as PackageType[]).filter(type => !isProxyTypeDisabled(type));
