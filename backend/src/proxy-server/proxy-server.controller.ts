import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ProxyServerService } from './proxy-server.service';
import { Authorization } from '../auth/decorators/auth.decorator';
import { UserRole } from '@prisma/client';

@Controller('proxy-server')
export class ProxyServerController {
    constructor(private proxyServerService: ProxyServerService) {}

    // Получить все серверы (только для админов)
    @Get()
    @Authorization(UserRole.ADMIN)
    async getAllServers() {
        return this.proxyServerService.getAllServers();
    }

    // Получить сервер по ID (только для админов)
    @Get('/:id')
    @Authorization(UserRole.ADMIN)
    async getServerById(@Param('id') id: string) {
        return this.proxyServerService.getServerById(id);
    }

    // Создать сервер (только для админов)
    @Post()
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.CREATED)
    async createServer(
        @Body()
        body: {
            host: string;
        },
    ) {
        return this.proxyServerService.createServer(body);
    }

    // Обновить сервер (только для админов)
    @Put('/:id')
    @Authorization(UserRole.ADMIN)
    async updateServer(
        @Param('id') id: string,
        @Body()
        body: {
            host?: string;
            status?: 'ACTIVE' | 'OFFLINE';
        },
    ) {
        return this.proxyServerService.updateServer(id, body);
    }

    // Удалить сервер (только для админов)
    @Delete('/:id')
    @Authorization(UserRole.ADMIN)
    async deleteServer(@Param('id') id: string) {
        return this.proxyServerService.deleteServer(id);
    }

    // Переключить статус сервера (только для админов)
    @Post('/:id/toggle-status')
    @Authorization(UserRole.ADMIN)
    async toggleServerStatus(@Param('id') id: string) {
        return this.proxyServerService.toggleServerStatus(id);
    }

    // Сгенерировать токен для сервера (только для админов)
    @Post('/:id/generate-token')
    @Authorization(UserRole.ADMIN)
    async generateServerToken(@Param('id') id: string) {
        return this.proxyServerService.generateServerToken(id);
    }
}

