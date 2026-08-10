import { forwardRef, Module } from "@nestjs/common";
import { NodeService } from "./node.service";
import { NodeGateway } from "./node.gateway";
import { UserModule } from "../user/user.module";

@Module({
    imports: [forwardRef(() => UserModule)],
    providers: [NodeGateway, NodeService],
    exports: [NodeService],
})
export class NodeModule {}
