import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, TokenType } from "@prisma/client";
import { v4 } from "uuid";

@Injectable()
export class TokenService {
    private readonly tokensTTL: Record<TokenType, number> = {
        VERIFICATION: 1000 * 60 * 15, // 15 min
        PASSWORD_RESET: 1000 * 60 * 15, // 15 min
    };

    constructor(private readonly prisma: PrismaService) {}

    async issueToken(email: string, type: TokenType) {
        const token = v4();
        const expiresIn = new Date(new Date().getTime() + this.tokensTTL[type]);

        const isExists = await this.prisma.token.findFirst({
            where: {
                email,
                type,
            },
        });

        if (isExists) {
            await this.prisma.token.delete({
                where: {
                    id: isExists.id,
                },
            });
        }

        return this.prisma.token.create({
            data: {
                email,
                token,
                type,
                expiresIn,
            },
        });
    }

    async findUnique(query: Prisma.TokenFindUniqueArgs) {
        return this.prisma.token.findUnique(query);
    }

    async findFirst(query: Prisma.TokenFindFirstArgs) {
        return this.prisma.token.findFirst(query);
    }

    async deleteById(id: string) {
        return this.prisma.token.delete({ where: { id } });
    }
}
