import { Global, Module } from "@nestjs/common";
import { ProvisioningQueueService } from "./provisioning-queue.service";

/**
 * @Global — чтобы ProvisioningQueueService можно было инжектить из любого модуля
 * (user/key/customer-api/payments) без правок их imports. Зависит только от
 * глобальных PrismaService + EventEmitter2, поэтому циклов не создаёт.
 */
@Global()
@Module({
    providers: [ProvisioningQueueService],
    exports: [ProvisioningQueueService],
})
export class ProvisioningModule {}
