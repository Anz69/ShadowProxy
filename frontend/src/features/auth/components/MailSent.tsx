"use client"
import { ChevronRight } from "lucide-react"
import { usePathname } from "next/navigation"
import type { FC } from "react"

import Button from "@/shared/components/ui/Button"
import Card from "@/shared/components/ui/Card"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

type MailSentProps = {
	overlay: "email-confirmation" | "password-reset"
	email: string
}

const MailSent: FC<MailSentProps> = ({ overlay, email }) => {
	const pathname = usePathname()
	const currentLocale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, currentLocale)
	const mailDomain = email.split("@")[1]

	return (
		<Card className="w-full md:w-[526px]">
			<h1 className="text-body text-center text-2xl leading-[24px] font-semibold">
				{overlay === "email-confirmation"
					? T("auth.mailSent.emailConfirmationTitle")
					: T("auth.mailSent.passwordResetTitle")}
			</h1>
			<p className="text-body flex w-full flex-col items-center text-center text-base leading-tight">
				{overlay === "email-confirmation"
					? T("auth.mailSent.emailConfirmationMessage")
					: T("auth.mailSent.passwordResetMessage")}
				<a className="text-primary cursor-pointer" target="_blank">
					{email}
				</a>
			</p>
			{mailboxMap[mailDomain] && (
				<Button
					variant="outline"
					type="button"
					onClick={() => {
						window.location.replace(mailboxMap[mailDomain])
					}}
				>
					{T("auth.mailSent.goToMail")}
					<ChevronRight className="h-4 w-4" />
				</Button>
			)}
		</Card>
	)
}

export default MailSent

const mailboxMap: Record<string, string> = {
	"gmail.com": "https://mail.google.com",
	"yandex.ru": "https://mail.yandex.ru",
	"ya.ru": "https://mail.yandex.ru",
	"mail.ru": "https://e.mail.ru",
	"inbox.ru": "https://e.mail.ru",
	"bk.ru": "https://e.mail.ru",
	"list.ru": "https://e.mail.ru",
	"outlook.com": "https://outlook.live.com",
	"hotmail.com": "https://outlook.live.com",
	"live.com": "https://outlook.live.com",
	"rambler.ru": "https://mail.rambler.ru",
	"proton.me": "https://mail.proton.me",
	"protonmail.com": "https://mail.proton.me",
	"icloud.com": "https://www.icloud.com/mail",
	"zoho.com": "https://mail.zoho.com",
	"gmx.com": "https://www.gmx.com",
	"tutanota.com": "https://mail.tutanota.com"
}
