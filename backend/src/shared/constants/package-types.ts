export const PACKAGE_TYPES = {
    RESIDENT: "RESIDENT",
    RESIDENT_PREMIUM: "RESIDENT_PREMIUM",
    MOBILE: "MOBILE",
    MOBILE_GB: "MOBILE_GB",
    ISP: "ISP",
    IPV6_GB: "IPV6_GB",
} as const;

export type PackageTypeValue = typeof PACKAGE_TYPES[keyof typeof PACKAGE_TYPES];

