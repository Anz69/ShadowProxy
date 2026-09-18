import axios from 'axios';
import { ServiceUnavailableException } from '@nestjs/common';
import { ProxyServerStatus } from '@prisma/client';
import { ProxyServerService } from './proxy-server.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ProxyServerService gateway selection', () => {
    const config = { get: jest.fn().mockReturnValue('') } as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('skips an unreachable ACTIVE gateway and selects the healthy one', async () => {
        const prisma = {
            proxyServer: {
                findMany: jest.fn().mockResolvedValue([
                    { host: '10.0.0.1', token: 'dead', status: ProxyServerStatus.ACTIVE },
                    { host: '10.0.0.2', token: 'healthy', status: ProxyServerStatus.ACTIVE },
                ]),
            },
            proxy: {
                count: jest.fn().mockResolvedValue(7),
            },
        } as any;
        mockedAxios.get
            .mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }))
            .mockResolvedValueOnce({ status: 200, data: { status: 'ok' } } as any);

        const service = new ProxyServerService(prisma, config);

        await expect(service.getServerForProxy()).resolves.toEqual({ serverHost: '10.0.0.2' });
        expect(prisma.proxy.count).toHaveBeenCalledTimes(1);
        expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('chooses the least loaded gateway among healthy nodes', async () => {
        const prisma = {
            proxyServer: {
                findMany: jest.fn().mockResolvedValue([
                    { host: '10.0.0.1', token: 'one', status: ProxyServerStatus.ACTIVE },
                    { host: '10.0.0.2', token: 'two', status: ProxyServerStatus.ACTIVE },
                ]),
            },
            proxy: {
                count: jest.fn(({ where }: any) => Promise.resolve(where.serverHost === '10.0.0.1' ? 8 : 2)),
            },
        } as any;
        mockedAxios.get.mockResolvedValue({ status: 200, data: { status: 'ok' } } as any);

        const service = new ProxyServerService(prisma, config);

        await expect(service.getServerForProxy()).resolves.toEqual({ serverHost: '10.0.0.2' });
    });

    it('fails clearly when every ACTIVE gateway is unreachable', async () => {
        const prisma = {
            proxyServer: {
                findMany: jest.fn().mockResolvedValue([
                    { host: '10.0.0.1', token: 'dead', status: ProxyServerStatus.ACTIVE },
                ]),
            },
            proxy: { count: jest.fn() },
        } as any;
        mockedAxios.get.mockRejectedValue(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }));

        const service = new ProxyServerService(prisma, config);

        await expect(service.getServerForProxy()).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(prisma.proxy.count).not.toHaveBeenCalled();
    });
});
