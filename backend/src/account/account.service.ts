import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

@Injectable()
export class AccountService {
    constructor(private readonly prisma: PrismaService) {}

    async findMany(query: Prisma.AccountFindManyArgs) {
        return this.prisma.account.findMany(query);
    }

    async findById(id: string) {
        return this.prisma.account.findUnique({
            where: {
                id,
            },
        });
    }

    async findFirst(query: Prisma.AccountFindFirstArgs) {
        return this.prisma.account.findFirst(query);
    }

    async create(data: Prisma.AccountCreateInput) {
        return this.prisma.account.create({
            data,
        });
    }

    async update(id: string, data: Prisma.AccountUpdateInput) {
        return this.prisma.account.update({
            where: {
                id,
            },
            data,
        });
    }

    async delete(id: string) {
        return this.prisma.account.delete({
            where: {
                id,
            },
        });
    }
}
