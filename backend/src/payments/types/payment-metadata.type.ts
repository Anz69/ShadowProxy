import { PackageType } from "@prisma/client";

export type PaymentMetadata = {
    contents: Array<
        | {
              type: "package";
              packageId: string;
          }
        | {
              type: "resident";
              tariff: PackageType;
              traffic: number;
          }
        | {
              type: "isp";
              quantity: number;
          }
        | {
              type: "mobile";
              plan: string;
              rentTime: number;
              userPackageId?: string; // ID существующего UserPackage для пополнения времени
          }
        | {
              type: "balance";
              amount: number;
          }
    >;
};
