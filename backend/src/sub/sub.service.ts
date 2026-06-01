import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAccountDto } from "./dtos/create-account.dto";
import { DistributeTrafficDto } from "./dtos/distribute-traffic.dto";
import { ProxyService } from "../proxy/proxy.service";
import { IssueSubIspProxyDto } from "./dtos/issue-sub-isp-proxy.dto";
import { RedeemSubKeyDto } from "./dtos/activate-sub-key.dto";
import { KeyService } from "../key/key.service";

@Injectable()
export class SubService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly proxyService: ProxyService,
        private readonly keyService: KeyService,
    ) {}

    async createAccount(dto: CreateAccountDto) {
        const isExists = await this.findByUsername(dto.username);
        if (isExists) {
            throw new BadRequestException("errors.sub_account_username_taken");
        }
        return this.prisma.subAccount.create({
            data: dto,
        });
    }

    async distributeTraffic(username: string, dto: DistributeTrafficDto) {
        const account = await this.findByUsername(username);
        if (!account) {
            throw new BadRequestException("errors.sub_account_not_exists");
        }
        return this.prisma.subAccount.update({
            where: {
                username,
            },
            data: {
                ipLeft: {
                    increment: dto.traffic,
                },
            },
        });
    }

    async getAccount(username: string) {
        const account = await this.findByUsername(username);
        if (!account) {
            throw new BadRequestException("errors.sub_account_not_exists");
        }
        return account;
    }

    async issueProxy(dto: IssueSubIspProxyDto) {
        const account = await this.findByUsername(dto.username);
        if (!account) {
            throw new BadRequestException("errors.sub_account_not_exists");
        }
        return this.proxyService.issueSubIspProxy(dto);
    }

    async activateKey(dto: RedeemSubKeyDto) {
        const account = await this.findByUsername(dto.username);
        if (!account) {
            throw new BadRequestException("errors.sub_account_not_exists");
        }
        const activatedKey = await this.keyService.redeemSubKey({ key: dto.key });
        return this.prisma.subAccount.update({
            where: {
                username: dto.username,
            },
            data: {
                ipLeft: {
                    increment: activatedKey.contents,
                },
            },
        });
    }

    async findByUsername(username: string) {
        return this.prisma.subAccount.findUnique({
            where: {
                username,
            },
        });
    }

    async findById(id: string) {
        return this.prisma.subAccount.findUnique({
            where: {
                id,
            },
        });
    }
}
