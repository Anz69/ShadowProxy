export type MobileProxyPlan = {
    id: string;
    name: string;
    description: string;
    availablePorts: number;
    countryCode: string;
    tarifications: MobileProxyPlanTarfication[];
};

export type MobileProxyPlanTarfication = {
    time: number;
    traffic: number;
    price: number;
};
