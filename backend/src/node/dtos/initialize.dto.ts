import { BaseDto } from "./base.dto";

export class InitializeDto extends BaseDto {
    busyPorts: {
        id: string;
        port: number;
    }[];
}
