import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { NodeService } from "./node.service";
import { Server, Socket } from "socket.io";
import { InitializeDto } from "./dtos/initialize.dto";
import { ActivatedReportDto } from "./dtos/activated-report.dto";

@WebSocketGateway(8081, {
    cors: { origin: "*" },
    transports: ["websocket"],
    namespace: "node",
    maxHttpBufferSize: 52428800,
})
export class NodeGateway {
    constructor(private readonly nodeService: NodeService) {}

    @WebSocketServer()
    server: Server;

    @SubscribeMessage("initialize")
    initializeNode(@MessageBody() dto: InitializeDto, @ConnectedSocket() client: Socket) {
        void this.nodeService.initializeNode(dto, client);
        return { success: true };
    }

    @SubscribeMessage("activated_report")
    async processActivatedReport(@MessageBody() dto: ActivatedReportDto, @ConnectedSocket() client: Socket) {
        await this.nodeService.processActivatedReport(dto, client);
        return { success: true };
    }

    @SubscribeMessage("sync_active_ports")
    async syncActivePorts(@MessageBody() dto: { activePorts: string[]; timestamp: number }, @ConnectedSocket() client: Socket) {
        console.log(`[NODE SYNC] Получен запрос на синхронизацию ${dto.activePorts.length} активных портов`);
        // Здесь можно добавить логику обработки синхронизации на стороне сервера
        return { success: true };
    }
}
