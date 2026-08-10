import { Module } from '@nestjs/common';
import { ProxyNodeController } from './proxy-node.controller';
import { ProxyServerModule } from '../proxy-server/proxy-server.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LoggerModule } from '../logger/logger.module';
import { UserModule } from '../user/user.module';
import { NodeModule } from '../node/node.module';

@Module({
    imports: [ProxyServerModule, PrismaModule, LoggerModule, UserModule, NodeModule],
    controllers: [ProxyNodeController],
})
export class ProxyNodeModule {}
