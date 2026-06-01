import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Param, Delete, Query, BadRequestException } from "@nestjs/common";
import { PackageService } from "./package.service";
import { Authorization } from "../auth/decorators/auth.decorator";
import { UserRole } from "@prisma/client";
import { CreatePackageDto } from "./dto/create-package.dto";
import { UpdatePackageDto } from "./dto/update-package.dto";
import { ActivatePackageDto } from "./dto/activate-package.dto";
import { ActivatePackageByTypeDto } from "./dto/activate-package-by-type.dto";
import { GeneratePackageProxyDto } from "./dto/generate-package-proxy.dto";
import { User } from "../auth/decorators/user.decorator";

@Controller("package")
export class PackageController {
    constructor(private readonly packageService: PackageService) {}

    @Get("/all")
    @HttpCode(HttpStatus.OK)
    async getAllPackages() {
        return this.packageService.findMany({});
    }

    @Post("/")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async createPackage(@Body() dto: CreatePackageDto) {
        return this.packageService.create(dto);
    }

    @Delete("/:packageId")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async deletePackage(@Param("packageId") packageId: string) {
        return this.packageService.delete(packageId);
    }

    @Patch("/:packageId")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async editPackage(@Body() dto: UpdatePackageDto, @Param("packageId") id: string) {
        return this.packageService.update(id, dto);
    }

    @Post("/activate")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async activatePackage(@Body() dto: ActivatePackageDto, @User("id") userId: string) {
        return this.packageService.activatePackage(dto.packageId, userId);
    }

    @Post("/activate-by-type")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async activatePackageByType(@Body() dto: ActivatePackageByTypeDto, @User("id") userId: string) {
        return this.packageService.activatePackageByType(dto.type, userId);
    }

    @Get("/user/my")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async getMyPackages(@User("id") userId: string) {
        return this.packageService.getUserPackages(userId);
    }

    @Post("/:packageId/generate-proxy")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async generatePackageProxy(
        @Param("packageId") packageId: string,
        @Body() dto: GeneratePackageProxyDto,
        @User("id") userId: string,
    ) {
        return this.packageService.generatePackageProxy(packageId, dto, userId);
    }

    @Get("/:packageId/traffic-stats")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async getTrafficStats(
        @Param("packageId") packageId: string,
        @Query("startDate") startDateStr: string,
        @Query("endDate") endDateStr: string,
        @Query("groupBy") groupBy: 'hour' | 'day' = 'day',
    ) {
        if (!startDateStr || !endDateStr) {
            throw new BadRequestException("startDate and endDate are required");
        }

        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new BadRequestException("Invalid date format");
        }

        if (startDate > endDate) {
            throw new BadRequestException("startDate must be before endDate");
        }

        if (groupBy !== 'hour' && groupBy !== 'day') {
            throw new BadRequestException("groupBy must be 'hour' or 'day'");
        }

        return this.packageService.getTrafficStats(packageId, startDate, endDate, groupBy);
    }

    @Get("/:packageId/traffic-bounds")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async getTrafficBounds(@Param("packageId") packageId: string) {
        return this.packageService.getTrafficLogBounds(packageId);
    }

    @Get("/:packageId/info")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async getPackageInfo(@Param("packageId") packageId: string, @User("id") userId: string) {
        return this.packageService.getUserPackageInfo(packageId, userId);
    }

    @Post("/:packageId/refresh-all-proxies")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async refreshAllProxies(
        @Param("packageId") packageId: string,
        @User("id") userId: string,
    ) {
        return this.packageService.refreshAllPackageProxies(packageId, userId);
    }
}
