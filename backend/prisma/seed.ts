import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    await prisma.setting.createMany({
        data: [
            {
                key: "proxy_tariffications",
                value: {
                    resident: 0.1,
                    resident_premium: 0.2,
                },
            },
            {
                key: "mobile_tariffications",
                value: {
                    options: [
                        { price: 0.25, rentTime: 300 },
                        {
                            price: 0.45,
                            rentTime: 600,
                        },
                        { price: 0.65, rentTime: 900 },
                        { price: 0.85, rentTime: 1200 },
                        {
                            price: 1.2,
                            rentTime: 1800,
                        },
                        { price: 1.8, rentTime: 2700 },
                        { price: 2, rentTime: 3600 },
                        {
                            price: 4,
                            rentTime: 7200,
                        },
                        { price: 8, rentTime: 14400 },
                        { price: 16, rentTime: 28800 },
                        {
                            price: 22,
                            rentTime: 43200,
                        },
                        { price: 31, rentTime: 86400 },
                    ],
                },
            },
        ],
        skipDuplicates: true,
    });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
