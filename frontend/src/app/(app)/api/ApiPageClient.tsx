"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Copy, RefreshCw, KeyRound, ChevronRight, Terminal } from "lucide-react"
import toast from "react-hot-toast"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import type { User } from "@/features/user/types/user.types"
import { userService } from "@/features/user/services/user.service"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import PageBackground from "@/shared/components/widgets/PageBackground"

type CodeLanguage = "curl" | "javascript" | "python"

// API methods (names come from i18n by key).
const methodsStructure = [
	{ id: "1", key: "balance", icon: "/api-icons/balance.svg" },
	{ id: "2", key: "referral-balance", icon: "/api-icons/balance.svg" },
	{ id: "3", key: "countries", icon: "/api-icons/packages.svg" },
	{ id: "4", key: "tariffs", icon: "/api-icons/packages.svg" },
	{ id: "4a", key: "purchase-traffic", icon: "/api-icons/packages.svg" },
	{ id: "5", key: "packages", icon: "/api-icons/packages.svg" },
	{ id: "6", key: "create-package", icon: "/api-icons/create.svg" },
	{ id: "7", key: "create-proxy", icon: "/api-icons/create.svg" },
	{ id: "8", key: "traffic", icon: "/api-icons/stats.svg" },
	{ id: "9", key: "error", icon: "/api-icons/error.svg" }
]

const LANGUAGES: { id: CodeLanguage; label: string }[] = [
	{ id: "curl", label: "cURL" },
	{ id: "javascript", label: "JavaScript" },
	{ id: "python", label: "Python" }
]

// Theme-aware card surface (matches the rest of the redesigned app).
const CARD =
	"relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] shadow-[0_30px_70px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] light:border-[#e6e8ef] light:bg-none light:bg-white light:shadow-[0_24px_60px_-44px_rgba(14,16,25,0.14)]"

export default function ApiPageClient({ user }: { user: User | null }) {
	const pathname = usePathname()
	const currentLocale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, currentLocale)
	const getLocalizedLink = (path: string) => addLocaleToPath(path, currentLocale)

	const [selectedLanguage, setSelectedLanguage] = useState<CodeLanguage>("javascript")
	const [selectedMethod, setSelectedMethod] = useState<string | null>(null)
	const [apiKey, setApiKey] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isGenerating, setIsGenerating] = useState(false)
	const [codeContent, setCodeContent] = useState<string>("")
	const [isLoadingCode, setIsLoadingCode] = useState(false)

	const methods = methodsStructure.map(m => ({ ...m, name: T(`api.requiredMethods.methods.${m.key}`) }))

	const loadCodeFromFile = async (method: string | null, language: CodeLanguage) => {
		try {
			setIsLoadingCode(true)
			const fileName = method ? `${method}.txt` : "default.txt"
			const response = await fetch(`/api-docs/${language}/${fileName}`)
			if (response.ok) {
				const text = await response.text()
				const code = apiKey ? text.replace(/YOUR_API_KEY/g, apiKey) : text
				setCodeContent(code)
			} else {
				setCodeContent("")
			}
		} catch (error) {
			console.error("Failed to load code:", error)
			setCodeContent("")
		} finally {
			setIsLoadingCode(false)
		}
	}

	useEffect(() => {
		loadCodeFromFile(selectedMethod, selectedLanguage)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedMethod, selectedLanguage, apiKey])

	useEffect(() => {
		if (user) loadApiKey()
		else setIsLoading(false)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user])

	const loadApiKey = async () => {
		try {
			setIsLoading(true)
			const data = await userService.getApiKey()
			setApiKey(data.apiKey)
		} catch (error) {
			console.error("Failed to load API key:", error)
		} finally {
			setIsLoading(false)
		}
	}

	const copyApiKey = () => {
		if (apiKey) {
			navigator.clipboard.writeText(apiKey)
			toast.success(T("api.key.tokenCopied"))
		}
	}

	const copyCode = () => {
		if (codeContent) {
			navigator.clipboard.writeText(codeContent)
			toast.success(T("api.docs.codeCopied"))
		}
	}

	const generateNewKey = async () => {
		try {
			setIsGenerating(true)
			const data = await userService.generateApiKey()
			setApiKey(data.apiKey)
			toast.success(T("api.key.tokenRegenerated"))
		} catch (error) {
			console.error("Failed to generate API key:", error)
		} finally {
			setIsGenerating(false)
		}
	}

	const btnPrimary =
		"inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] px-5 text-[14px] font-semibold text-white shadow-[0_12px_32px_-12px_rgba(59,130,246,0.85)] transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
	const btnGhost =
		"inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 text-[14px] font-semibold text-white transition-colors duration-200 hover:bg-white/10 disabled:opacity-50 light:border-[#e2e4ea] light:bg-[#f4f6fa] light:text-[#0e1019] light:hover:bg-[#eef1f6]"

	return (
		<main className="relative min-h-screen w-full overflow-hidden py-[clamp(36px,6vw,84px)] font-[TalosInter] text-white light:text-[#0e1019]">
			<PageBackground />

			<div className="relative w-full">
				{/* Header */}
				<div className="flex flex-col items-start gap-4">
					<span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-[13px] font-semibold tracking-[0.04em] text-white/70 backdrop-blur-md light:border-[#2f6bff]/25 light:bg-[#2f6bff]/10 light:text-[#2f6bff]">
						<span className="h-2 w-2 rounded-full bg-gradient-to-br from-[#6aa5ff] to-[#34d3ee] shadow-[0_0_12px_rgba(106,165,255,0.9)]" />
						API
					</span>
					<h1 className="font-[TalosDisplay] text-[clamp(32px,5vw,56px)] font-semibold leading-[1.04] tracking-[-0.035em] text-white light:text-[#0e1019]">
						{T("api.title")}
					</h1>
					<p className="max-w-[640px] text-[clamp(15px,1.4vw,17px)] leading-[1.6] text-white/55 light:text-[#5b6472]">
						{T("api.requiredMethods.title")}
					</p>
				</div>

				{/* API key card */}
				<div className={`${CARD} mt-9 p-6 sm:p-8`}>
					<div
						aria-hidden
						className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(0,103,255,0.4),transparent_65%)] blur-2xl light:bg-[radial-gradient(circle,rgba(47,107,255,0.16),transparent_65%)]"
					/>
					<div className="relative flex flex-col gap-5">
						<div className="flex items-center gap-3">
							<span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#6aa5ff]/30 bg-gradient-to-b from-[#6aa5ff]/20 to-[#3b82f6]/[0.08] text-[#6aa5ff] light:border-[#2f6bff]/20 light:text-[#2f6bff]">
								<KeyRound className="h-[22px] w-[22px]" />
							</span>
							<h2 className="font-[TalosDisplay] text-[20px] font-semibold text-white light:text-[#0e1019]">{T("api.key.label")}</h2>
						</div>

						{user ? (
							isLoading ? (
								<div className="h-12 w-full animate-pulse rounded-[14px] bg-white/[0.06] light:bg-black/[0.05]" />
							) : (
								<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
									<div className="flex min-w-0 flex-1 items-center rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-[14px] text-white/90 light:border-[#e2e4ea] light:bg-[#f7f8fb] light:text-[#0e1019]">
										<span className="truncate">{apiKey || T("api.key.notGenerated")}</span>
									</div>
									<div className="flex flex-shrink-0 gap-2.5">
										{apiKey && (
											<button type="button" className={btnGhost} onClick={copyApiKey}>
												<Copy className="h-[18px] w-[18px]" />
												{T("api.key.copy")}
											</button>
										)}
										<button type="button" className={btnPrimary} onClick={generateNewKey} disabled={isGenerating}>
											<RefreshCw className={`h-[18px] w-[18px] ${isGenerating ? "animate-spin" : ""}`} />
											{isGenerating ? T("api.key.generating") : T("api.key.generate")}
										</button>
									</div>
								</div>
							)
						) : (
							<div className="flex flex-col items-start gap-3">
								<p className="text-[15px] text-white/60 light:text-[#5b6472]">{T("api.unauthorized.message")}</p>
								<Link href={getLocalizedLink("/auth/login")} className={btnPrimary}>
									{T("api.unauthorized.login")}
								</Link>
							</div>
						)}
					</div>
				</div>

				{/* Methods + code */}
				<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
					{/* Methods sidebar */}
					<div className={`${CARD} flex flex-col p-4 sm:p-5`}>
						<h2 className="px-2 pb-3 pt-1 font-[TalosDisplay] text-[16px] font-semibold text-white light:text-[#0e1019]">
							{T("api.requiredMethods.title")}
						</h2>
						<div className="flex max-h-[600px] flex-col gap-1.5 overflow-y-auto py-2 pr-1 [mask-image:linear-gradient(to_bottom,transparent,#000_5%,#000_94%,transparent)]">
							{methods.map((m, i) => {
								const active = selectedMethod === m.key
								return (
									<button
										key={m.id}
										type="button"
										onClick={() => setSelectedMethod(m.key)}
										style={{ animationDelay: `${i * 45}ms` }}
										className={`group flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 motion-safe:[animation:sp-rise_.5s_cubic-bezier(0.16,1,0.3,1)_both] ${
											active
												? "border-[#4f8dff]/50 bg-gradient-to-r from-[#4f8dff]/20 to-[#2f6bff]/[0.06] light:border-[#2f6bff]/40 light:from-[#2f6bff]/10 light:to-[#2f6bff]/[0.03]"
												: "border-white/[0.07] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06] light:border-[#e9ebf0] light:bg-white light:hover:border-[#d8dde6] light:hover:bg-[#f4f6fa]"
										}`}
									>
										<span
											className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 transition-colors ${
												active
													? "bg-[#2f6bff]/20 ring-[#4f8dff]/40 light:bg-[#2f6bff]/15 light:ring-[#2f6bff]/30"
													: "bg-white/[0.06] ring-white/[0.06] light:bg-[#2f6bff]/[0.07] light:ring-transparent"
											}`}
										>
											<img src={m.icon} alt="" width="20" height="20" className="h-5 w-5" />
										</span>
										<span className={`flex-1 text-[14px] font-medium ${active ? "text-white light:text-[#0e1019]" : "text-white/80 light:text-[#475467]"}`}>
											{m.name}
										</span>
										<ChevronRight className={`h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${active ? "text-[#6aa5ff] light:text-[#2f6bff]" : "text-white/25 light:text-black/20"}`} />
									</button>
								)
							})}
						</div>
					</div>

					{/* Code viewer — always dark (dev-console style), in both themes */}
					<div className="relative flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0b1020] shadow-[0_30px_70px_-44px_rgba(0,0,0,0.85)] light:border-[#dfe3ec] light:shadow-[0_24px_60px_-44px_rgba(14,16,25,0.18)]">
						{/* language tabs */}
						<div className="flex items-center gap-1 border-b border-white/[0.07] px-3 pt-3">
							{LANGUAGES.map(l => (
								<button
									key={l.id}
									type="button"
									onClick={() => setSelectedLanguage(l.id)}
									className={`rounded-t-lg px-4 py-2.5 text-[13px] font-semibold transition-colors ${
										selectedLanguage === l.id ? "bg-white/[0.06] text-white" : "text-white/45 hover:text-white/75"
									}`}
								>
									{l.label}
								</button>
							))}
						</div>
						{/* code header */}
						<div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-2.5">
							<span className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-white/40">
								<Terminal className="h-4 w-4" />
								{LANGUAGES.find(l => l.id === selectedLanguage)?.label}
							</span>
							<button
								type="button"
								onClick={copyCode}
								className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
								aria-label={T("api.docs.copyCode")}
							>
								<Copy className="h-3.5 w-3.5" />
								{T("api.key.copy")}
							</button>
						</div>
						{/* code */}
						<div className="min-h-[420px] flex-1 overflow-auto p-5 max-h-[570px]">
							{isLoadingCode ? (
								<div className="text-[14px] text-white/45">{T("api.key.loading")}</div>
							) : codeContent ? (
								<SyntaxHighlighter
									language={selectedLanguage === "curl" ? "bash" : selectedLanguage}
									style={vscDarkPlus}
									customStyle={{ background: "transparent", padding: 0, margin: 0, fontSize: "13.5px", lineHeight: "1.65" }}
									codeTagProps={{ style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } }}
								>
									{codeContent}
								</SyntaxHighlighter>
							) : (
								<div className="text-[14px] text-white/45">{T("api.docs.codeNotAdded")}</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</main>
	)
}
