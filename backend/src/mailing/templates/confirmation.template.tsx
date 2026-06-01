import * as React from "react";
import { Html } from "@react-email/html";
import { Body, Heading, Container, Text, Link, Tailwind, Head, Preview, Section, Row, Column, Button } from "@react-email/components";
import { I18nService } from "nestjs-i18n";

type ConfirmationTemplateProps = {
    domain: string;
    token: string;
    i18n: I18nService;
    isDev: boolean;
};

const devImageLinks = {
    logo: "https://i.ibb.co/T3Kv0h7/logo.png",
    body: "https://i.ibb.co/VchXf4Hs/body.png",
    telegram: "https://i.ibb.co/CdLZ8vm/telegram.png",
};

export const ConfirmationTemplate = ({ domain, token, i18n, isDev }: ConfirmationTemplateProps) => {
    const confirmationLink = `${domain}/auth/email-verification?token=${token}`;

    return (
        <Tailwind>
            <Html>
                <Head>
                    <meta name="color-scheme" content="dark" />
                    <meta name="supported-color-schemes" content="dark" />
                </Head>
                <Body className="bg-[#18191D] font-sans">
                    <Container className="max-w-[600px] p-6">
                        <Section className="w-full mb-12">
                            <Row>
                                <Column align="left">
                                    <img src={isDev ? devImageLinks.logo : `${domain}/mailing/logo.png`} width={168} height={22} className="w-[168px] h-[22px]" alt="Лого" />
                                </Column>
                                <Column align="right">
                                    <Link href="https://t.me/shadowproxysupport_bot">
                                        <img src={isDev ? devImageLinks.telegram : `${domain}/mailing/telegram.png`} width={28} height={28} className="w-7 h-7" alt="Телеграм" />
                                    </Link>
                                </Column>
                            </Row>
                        </Section>
                        <Section className="w-full rounded-xl bg-[#060609]/50 overflow-hidden">
                            <img src={isDev ? devImageLinks.body : `${domain}/mailing/body.png`} width={472} height={175} className="w-full object-cover" alt="" />
                            <Section className="w-full p-4">
                                <Text className="text-[#EDF6F9] text-base font-bold mb-5 text-left mt-0">{i18n.t("mailing.confirmation.heading")}</Text>
                                <Text className="text-[#EDF6F9]/80 text-sm font-medium mb-5 whitespace-pre-wrap">{i18n.t("mailing.confirmation.body")}</Text>
                                <Button href={confirmationLink} className="text-sm text-[#EDF6F9] w-full py-3 text-center bg-[#0067FF] rounded-xl font-semibold mb-2">
                                    {i18n.t("mailing.confirmation.confirm_email_button")}
                                </Button>
                                <Text className="text-[#EDF6F9]/50 text-sm font-medium mb-2 text-center w-full mt-0">{i18n.t("mailing.confirmation.or")}</Text>
                                <Text className="text-[#EDF6F9] text-sm font-medium text-center w-full mt-0 mb-0">
                                    {i18n.t("mailing.confirmation.follow_link")}
                                    <Link href={confirmationLink} className="text-[#0067FF] ml-1">
                                        {i18n.t("mailing.confirmation.link")}
                                    </Link>
                                </Text>
                            </Section>
                        </Section>
                        <Text className="text-[#EDF6F9]/50 text-sm font-medium mb-2 text-left w-full mt-4">{i18n.t("mailing.common.automatic_mail")}</Text>
                        <Text className="text-[#EDF6F9] text-sm font-medium text-left w-full mt-0">{i18n.t("mailing.common.all_right_reserved")}</Text>
                    </Container>
                </Body>
            </Html>
        </Tailwind>
    );
};
