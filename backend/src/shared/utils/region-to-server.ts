import { countryToContinent } from "../constants/regions";
import { ServerRegion } from "../../proxy/types/server-region.type";

export function regionToServer(region: string): keyof ServerRegion {
    const normalized = region.toUpperCase();

    const continentByName: Record<string, string> = {
        ASIA: "cis",
        EUROPE: "europe",
        NORTH_AMERICA: "usa",
        SOUTH_AMERICA: "usa",
        AFRICA: "europe",
        OCEANIA: "usa",
    };

    if (countryToContinent[normalized]) {
        return countryToContinent[normalized];
    }
    if (continentByName[normalized]) {
        return continentByName[normalized] as keyof ServerRegion;
    }
    return "europe";
}
