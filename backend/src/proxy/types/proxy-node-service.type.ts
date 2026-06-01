import { Observable } from "rxjs";

export type ProxyNodeService = {
    getAvailablePorts(data: object): Observable<{ ports: number[] }>;
    reservePort({ port }: { port: number }): Observable<{ success: boolean }>;
    releasePort({ port }: { port: number }): Observable<{ success: boolean }>;

    registerProxy(dto: RegisterProxyDto): Observable<{ success: boolean }>;
    unlinkProxy({ id }: { id: string }): Observable<{ success: boolean }>;
};

export type RegisterProxyDto = {
    id: string;
    protocol: string;
    port: number;
    connectionString: string;
    username: string;
    password: string;
};
