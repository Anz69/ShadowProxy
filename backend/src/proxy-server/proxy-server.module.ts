import { forwardRef, Module } from '@nestjs/common';
import { ProxyServerController } from './proxy-server.controller';
import { ProxyServerService } from './proxy-server.service';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [forwardRef(() => AuthModule), forwardRef(() => UserModule), PrismaModule],
    controllers: [ProxyServerController],
    providers: [ProxyServerService],
    exports: [ProxyServerService],
})
export class ProxyServerModule {}

