"use client"

import Image from "next/image"
import { usePathname } from "next/navigation"
import { type FC, type ReactNode } from "react"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

const carouselIcons = [
	{ src: "/carousel-1.svg", alt: "Instagram", width: 50, height: 50 },
	{ src: "/carousel-2.svg", alt: "YouTube", width: 60, height: 42 },
	{ src: "/carousel-3.svg", alt: "Discord", width: 60, height: 60 },
	{ src: "/carousel-4.svg", alt: "GPT", width: 40, height: 40 },
	{ src: "/carousel-5.svg", alt: "Gemini", width: 160, height: 36 }
]

interface AuthBackgroundProps {
	children: ReactNode
}

const AuthBackground: FC<AuthBackgroundProps> = ({ children }) => {
	const pathname = usePathname()
	const locale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, locale)

	return (
		<div className="login-container">
			<div className="login-background" />
			<div className="login-content">
				<div className="login-left-section">
					<div className="login-text-container">
						<p className="login-subtitle">{T("auth.subtitle")}</p>
						<p className="login-lead">{T("main.hero.description")}</p>
					</div>
					<div className="login-carousel">
						<div className="login-carousel-track">
							{Array.from({ length: 4 }, (_, groupIndex) =>
								carouselIcons.map((icon, iconIndex) => (
									<div key={`${groupIndex}-${iconIndex}`} className="login-carousel-item">
										<Image
											src={icon.src}
											alt={icon.alt}
											width={icon.width}
											height={icon.height}
											className="login-carousel-image"
										/>
									</div>
								))
							)}
						</div>
					</div>
				</div>
				<div className="login-right-section">
					<div className="login-form-wrap">
						{children}
					</div>
				</div>
			</div>
		</div>
	)
}

export default AuthBackground
