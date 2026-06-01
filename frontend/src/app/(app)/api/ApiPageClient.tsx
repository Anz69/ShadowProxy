"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import toast from "react-hot-toast"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import type { User } from "@/features/user/types/user.types"
import { userService } from "@/features/user/services/user.service"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

// Типы языков программирования
type CodeLanguage = 'curl' | 'javascript' | 'python'

// Обязательные методы API (структура, названия будут переведены)
// Фоны распределены по порядку: 1-6 обычные, 7-9 отзеркалены (6,5,4)
const requiredMethodsStructure = [
	{
		id: '1',
		key: 'balance',
		icon: '/api-icons/balance.svg',
		background: '/api-backgrounds/api-right-item1-backgraund.png'
	},
	{
		id: '2',
		key: 'referral-balance',
		icon: '/api-icons/balance.svg',
		background: '/api-backgrounds/api-right-item2-backgraund.png'
	},
	{
		id: '3',
		key: 'countries',
		icon: '/api-icons/packages.svg',
		background: '/api-backgrounds/api-right-item3-backgraund.png'
	},
	{
		id: '4',
		key: 'tariffs',
		icon: '/api-icons/packages.svg',
		background: '/api-backgrounds/api-right-item4-backgraund.png'
	},
	{
		id: '4a',
		key: 'purchase-traffic',
		icon: '/api-icons/packages.svg',
		background: '/api-backgrounds/api-right-item5-backgraund.png'
	},
	{
		id: '5',
		key: 'packages',
		icon: '/api-icons/packages.svg',
		background: '/api-backgrounds/api-right-item5-backgraund.png'
	},
	{
		id: '6',
		key: 'create-package',
		icon: '/api-icons/create.svg',
		background: '/api-backgrounds/api-right-item6-backgraund.png'
	},
	{
		id: '7',
		key: 'create-proxy',
		icon: '/api-icons/create.svg',
		background: '/api-backgrounds/api-right-item6-backgraund.png',
		flipVertical: true
	},
	{
		id: '8',
		key: 'traffic',
		icon: '/api-icons/stats.svg',
		background: '/api-backgrounds/api-right-item5-backgraund.png',
		flipVertical: true
	},
	{
		id: '9',
		key: 'error',
		icon: '/api-icons/error.svg',
		background: '/api-backgrounds/api-right-item4-backgraund.png',
		flipVertical: true
	}
]

export default function ApiPageClient({ user }: { user: User | null }) {
	const pathname = usePathname()
	const currentLocale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, currentLocale)
	
	// Helper function to create localized links
	const getLocalizedLink = (path: string) => {
		return addLocaleToPath(path, currentLocale)
	}
	
	const [selectedLanguage, setSelectedLanguage] = useState<CodeLanguage>('javascript')
	const [selectedMethod, setSelectedMethod] = useState<string | null>(null)
	const [apiKey, setApiKey] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isGenerating, setIsGenerating] = useState(false)
	const [codeContent, setCodeContent] = useState<string>('')
	const [isLoadingCode, setIsLoadingCode] = useState(false)
	
	// Создаем массив методов с переводами
	const requiredMethods = requiredMethodsStructure.map(method => ({
		...method,
		name: T(`api.requiredMethods.methods.${method.key}`)
	}))
	
	// Функция загрузки кода из файла
	const loadCodeFromFile = async (method: string | null, language: CodeLanguage) => {
		try {
			setIsLoadingCode(true)
			// Если метод не выбран, загружаем дефолтный файл
			const fileName = method ? `${method}.txt` : 'default.txt'
			const response = await fetch(`/api-docs/${language}/${fileName}`)
			if (response.ok) {
				const text = await response.text()
				// Заменяем YOUR_API_KEY на реальный ключ, если он есть
				const code = apiKey ? text.replace(/YOUR_API_KEY/g, apiKey) : text
				setCodeContent(code)
			} else {
				// Если файл не найден, используем пустую строку
				setCodeContent('')
			}
		} catch (error) {
			console.error("Failed to load code:", error)
			setCodeContent('')
		} finally {
			setIsLoadingCode(false)
		}
	}
	
	// Загружаем код при изменении метода или языка
	useEffect(() => {
		loadCodeFromFile(selectedMethod, selectedLanguage)
	}, [selectedMethod, selectedLanguage, apiKey])

	useEffect(() => {
		if (user) {
			loadApiKey()
		} else {
			setIsLoading(false)
		}
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
		// Находим скрытый блок с кодом для копирования
		const codeCopyElement = document.querySelector('.api-docs-block__code-copy')
		if (codeCopyElement) {
			const codeToCopy = codeCopyElement.textContent || ''
			navigator.clipboard.writeText(codeToCopy)
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

	return (
		<main className="api-page">
			<div className="api-page__container">
				{/* Левый блок - 2 подблока */}
				<div className="api-page__left">
					{/* Подблок 1: API ключ */}
					<div className="api-key-block">
						<div className="api-key-block__background">
							<img src="/left-section-background.jpg" alt="" className="api-key-block__bg-image" />
						</div>
						<div className="api-key-block__content">
							<h2 className="api-key-block__title">{T("api.key.label")}</h2>
							{user ? (
								<>
									{isLoading ? (
										<div className="api-key-block__loading">
											<span>{T("api.key.loading")}</span>
										</div>
									) : apiKey ? (
										<>
											<div className="api-key-block__key">
												<span className="api-key-value">{apiKey}</span>
											</div>
											<div className="api-key-block__actions">
												<button
													type="button"
													className="api-key-btn api-key-btn--copy"
													onClick={copyApiKey}
												>
													<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
														<rect x="4" y="5" width="14" height="15" fill="white"/>
														<path d="M8.75006 19.5C6.40706 19.5 4.5 17.5929 4.5 15.2499V5.00006H2.75006C1.23305 5.00006 0 6.23287 0 7.74994V21.2499C0 22.767 1.23305 24 2.75006 24H15.2499C16.767 24 18 22.767 18 21.2499V19.5H8.75006Z" fill="#0067FF"/>
														<path d="M21.9999 2.75006C21.9999 1.23103 20.7689 0 19.2501 0H8.75006C7.23103 0 6 1.23103 6 2.75006V15.2499C6 16.769 7.23103 18 8.75006 18H19.2501C20.7689 18 21.9999 16.769 21.9999 15.2499V2.75006Z" fill="#0067FF"/>
													</svg>
													<span>{T("api.key.copy")}</span>
												</button>
												<button
													type="button"
													className="api-key-btn api-key-btn--generate"
													onClick={generateNewKey}
													disabled={isGenerating}
												>
													<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
														<g clipPath="url(#clip0_58_5706)">
															<rect x="2.67188" y="3.5625" width="18.75" height="19.2188" fill="white"/>
															<path d="M19.5312 0H4.46878C2.00466 0 0 2.0047 0 4.46878V19.5312C0 21.9953 2.00466 24 4.46878 24H19.5312C21.9953 24 24 21.9953 24 19.5312V4.46878C24 2.0047 21.9953 0 19.5312 0ZM6.42534 14.6315C6.3528 14.6561 6.27671 14.6686 6.20011 14.6687C5.90681 14.6687 5.6332 14.4838 5.53406 14.1905C5.13259 13.0019 5.06552 11.7259 5.34019 10.5017C5.62256 9.24159 6.25655 8.09077 7.17356 7.1737C8.46277 5.8845 10.1768 5.17453 12 5.17453C13.3028 5.17453 14.5499 5.5373 15.626 6.21473L15.6261 5.22188C15.6261 4.83361 15.9409 4.5188 16.3292 4.5188C16.7175 4.5188 17.0323 4.83361 17.0323 5.22197L17.0322 7.67081C17.0322 7.69402 17.031 7.71717 17.0287 7.74023C17.0277 7.75078 17.0257 7.76095 17.0243 7.77136C17.0224 7.78364 17.0211 7.79597 17.0186 7.80816C17.0162 7.82016 17.013 7.83169 17.01 7.84345C17.0073 7.85395 17.005 7.8645 17.0019 7.87491C16.9984 7.88644 16.9941 7.8975 16.99 7.9088C16.9863 7.9192 16.9829 7.92961 16.9786 7.93983C16.9743 7.95037 16.9692 7.9605 16.9643 7.97077C16.9593 7.98131 16.9546 7.99191 16.9492 8.00217C16.9439 8.01216 16.9378 8.02158 16.932 8.03119C16.926 8.04122 16.9204 8.05139 16.9138 8.06114C16.9066 8.07192 16.8986 8.08209 16.8908 8.0925C16.8848 8.10047 16.8793 8.10867 16.8729 8.11645C16.8435 8.15237 16.8105 8.18528 16.7746 8.2147C16.7668 8.22112 16.7586 8.22666 16.7506 8.23266C16.7403 8.24044 16.7302 8.24841 16.7194 8.25562C16.7095 8.26223 16.6992 8.26795 16.6891 8.27405C16.6796 8.27972 16.6703 8.28572 16.6605 8.29097C16.65 8.29655 16.6393 8.30128 16.6286 8.30625C16.6185 8.31108 16.6085 8.31614 16.5982 8.32045C16.5877 8.32477 16.5771 8.32823 16.5665 8.33203C16.5555 8.33602 16.5445 8.34023 16.5332 8.34366C16.5225 8.34689 16.5116 8.34928 16.5008 8.352C16.4894 8.35486 16.4782 8.35809 16.4665 8.36039C16.4539 8.36292 16.4411 8.36442 16.4284 8.36625C16.4185 8.36761 16.4087 8.36953 16.3986 8.37056C16.3754 8.37286 16.3522 8.37403 16.3289 8.37403H13.8803C13.4919 8.37403 13.1772 8.05922 13.1772 7.67091C13.1772 7.28259 13.4919 6.96778 13.8803 6.96778H14.0179C13.3847 6.714 12.7026 6.58078 12 6.58078C10.5524 6.58078 9.19153 7.1445 8.16797 8.16806C6.69966 9.63647 6.20081 11.7716 6.86625 13.7403C6.99066 14.1081 6.79322 14.5071 6.42534 14.6315ZM18.6598 13.4983C18.3774 14.7584 17.7434 15.9092 16.8264 16.8263C15.5372 18.1155 13.8232 18.8254 12 18.8254C10.6972 18.8254 9.45019 18.4627 8.37398 17.7853L8.37408 18.7781C8.37408 19.1664 8.05927 19.4813 7.67095 19.4813C7.28264 19.4813 6.96783 19.1665 6.96783 18.7782L6.96773 16.3291V16.3291C6.96773 16.3062 6.96886 16.2833 6.97111 16.2605C6.97167 16.2546 6.97289 16.2488 6.97364 16.2428C6.9757 16.226 6.97791 16.209 6.98119 16.1923C6.98217 16.1875 6.98362 16.1829 6.98466 16.1781C6.9885 16.1603 6.99263 16.1427 6.99792 16.1253C6.99881 16.1223 7.00003 16.1195 7.00092 16.1165C7.00697 16.0976 7.01348 16.0788 7.02108 16.0604L7.02314 16.0559C7.03134 16.0364 7.0403 16.0171 7.05037 15.9982C7.05113 15.9969 7.05202 15.9956 7.05277 15.9942C7.06289 15.9756 7.07367 15.9572 7.08558 15.9394C7.08811 15.9357 7.09102 15.9322 7.09359 15.9285C7.10409 15.9135 7.11473 15.8984 7.12655 15.884C7.14127 15.8659 7.15697 15.8485 7.17361 15.8319C7.19025 15.8153 7.20773 15.7996 7.22578 15.7847C7.23848 15.7743 7.25189 15.765 7.26516 15.7556C7.27055 15.7518 7.27575 15.7475 7.28128 15.7438C7.29778 15.7328 7.3147 15.723 7.33177 15.7136C7.33467 15.712 7.3373 15.7101 7.34025 15.7086C7.35783 15.6992 7.37588 15.6909 7.39406 15.6831C7.39688 15.6819 7.39955 15.6804 7.40236 15.6793C7.41966 15.6721 7.43728 15.6661 7.45495 15.6604C7.45913 15.6592 7.46311 15.6574 7.46733 15.6561C7.48355 15.6513 7.5 15.6474 7.51655 15.6437C7.5225 15.6424 7.52831 15.6406 7.53427 15.6394C7.54945 15.6364 7.56483 15.6346 7.5802 15.6326C7.58761 15.6316 7.59492 15.6301 7.60247 15.6294C7.6208 15.6276 7.63917 15.627 7.65759 15.6266C7.66209 15.6265 7.66641 15.626 7.67086 15.626L10.1199 15.6261C10.5082 15.6261 10.823 15.9409 10.823 16.3292C10.823 16.7175 10.5082 17.0323 10.1199 17.0323H9.98231C10.6155 17.286 11.2974 17.4192 12 17.4192C13.4475 17.4192 14.8084 16.8555 15.832 15.8319C17.3003 14.3635 17.7991 12.2285 17.1337 10.26C17.0093 9.89203 17.2068 9.49303 17.5747 9.36867C17.9425 9.24431 18.3415 9.44175 18.4659 9.80958C18.8674 10.9981 18.9345 12.2742 18.6598 13.4983Z" fill="#0067FF"/>
														</g>
														<defs>
															<clipPath id="clip0_58_5706">
																<rect width="24" height="24" fill="white"/>
															</clipPath>
														</defs>
													</svg>
													<span>{isGenerating ? T("api.key.generating") : T("api.key.generate")}</span>
												</button>
											</div>
										</>
									) : (
										<div className="api-key-block__placeholder">
											<div className="api-key-block__key">
												<span className="api-key-value" style={{ color: "#EDF6F9" }}>{T("api.key.notGenerated")}</span>
											</div>
											<div className="api-key-block__actions">
												<button
													type="button"
													className="api-key-btn api-key-btn--generate"
													onClick={generateNewKey}
													disabled={isGenerating}
												>
												<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
													<g clipPath="url(#clip0_58_5706)">
														<rect x="2.67188" y="3.5625" width="18.75" height="19.2188" fill="white"/>
														<path d="M19.5312 0H4.46878C2.00466 0 0 2.0047 0 4.46878V19.5312C0 21.9953 2.00466 24 4.46878 24H19.5312C21.9953 24 24 21.9953 24 19.5312V4.46878C24 2.0047 21.9953 0 19.5312 0ZM6.42534 14.6315C6.3528 14.6561 6.27671 14.6686 6.20011 14.6687C5.90681 14.6687 5.6332 14.4838 5.53406 14.1905C5.13259 13.0019 5.06552 11.7259 5.34019 10.5017C5.62256 9.24159 6.25655 8.09077 7.17356 7.1737C8.46277 5.8845 10.1768 5.17453 12 5.17453C13.3028 5.17453 14.5499 5.5373 15.626 6.21473L15.6261 5.22188C15.6261 4.83361 15.9409 4.5188 16.3292 4.5188C16.7175 4.5188 17.0323 4.83361 17.0323 5.22197L17.0322 7.67081C17.0322 7.69402 17.031 7.71717 17.0287 7.74023C17.0277 7.75078 17.0257 7.76095 17.0243 7.77136C17.0224 7.78364 17.0211 7.79597 17.0186 7.80816C17.0162 7.82016 17.013 7.83169 17.01 7.84345C17.0073 7.85395 17.005 7.8645 17.0019 7.87491C16.9984 7.88644 16.9941 7.8975 16.99 7.9088C16.9863 7.9192 16.9829 7.92961 16.9786 7.93983C16.9743 7.95037 16.9692 7.9605 16.9643 7.97077C16.9593 7.98131 16.9546 7.99191 16.9492 8.00217C16.9439 8.01216 16.9378 8.02158 16.932 8.03119C16.926 8.04122 16.9204 8.05139 16.9138 8.06114C16.9066 8.07192 16.8986 8.08209 16.8908 8.0925C16.8848 8.10047 16.8793 8.10867 16.8729 8.11645C16.8435 8.15237 16.8105 8.18528 16.7746 8.2147C16.7668 8.22112 16.7586 8.22666 16.7506 8.23266C16.7403 8.24044 16.7302 8.24841 16.7194 8.25562C16.7095 8.26223 16.6992 8.26795 16.6891 8.27405C16.6796 8.27972 16.6703 8.28572 16.6605 8.29097C16.65 8.29655 16.6393 8.30128 16.6286 8.30625C16.6185 8.31108 16.6085 8.31614 16.5982 8.32045C16.5877 8.32477 16.5771 8.32823 16.5665 8.33203C16.5555 8.33602 16.5445 8.34023 16.5332 8.34366C16.5225 8.34689 16.5116 8.34928 16.5008 8.352C16.4894 8.35486 16.4782 8.35809 16.4665 8.36039C16.4539 8.36292 16.4411 8.36442 16.4284 8.36625C16.4185 8.36761 16.4087 8.36953 16.3986 8.37056C16.3754 8.37286 16.3522 8.37403 16.3289 8.37403H13.8803C13.4919 8.37403 13.1772 8.05922 13.1772 7.67091C13.1772 7.28259 13.4919 6.96778 13.8803 6.96778H14.0179C13.3847 6.714 12.7026 6.58078 12 6.58078C10.5524 6.58078 9.19153 7.1445 8.16797 8.16806C6.69966 9.63647 6.20081 11.7716 6.86625 13.7403C6.99066 14.1081 6.79322 14.5071 6.42534 14.6315ZM18.6598 13.4983C18.3774 14.7584 17.7434 15.9092 16.8264 16.8263C15.5372 18.1155 13.8232 18.8254 12 18.8254C10.6972 18.8254 9.45019 18.4627 8.37398 17.7853L8.37408 18.7781C8.37408 19.1664 8.05927 19.4813 7.67095 19.4813C7.28264 19.4813 6.96783 19.1665 6.96783 18.7782L6.96773 16.3291V16.3291C6.96773 16.3062 6.96886 16.2833 6.97111 16.2605C6.97167 16.2546 6.97289 16.2488 6.97364 16.2428C6.9757 16.226 6.97791 16.209 6.98119 16.1923C6.98217 16.1875 6.98362 16.1829 6.98466 16.1781C6.9885 16.1603 6.99263 16.1427 6.99792 16.1253C6.99881 16.1223 7.00003 16.1195 7.00092 16.1165C7.00697 16.0976 7.01348 16.0788 7.02108 16.0604L7.02314 16.0559C7.03134 16.0364 7.0403 16.0171 7.05037 15.9982C7.05113 15.9969 7.05202 15.9956 7.05277 15.9942C7.06289 15.9756 7.07367 15.9572 7.08558 15.9394C7.08811 15.9357 7.09102 15.9322 7.09359 15.9285C7.10409 15.9135 7.11473 15.8984 7.12655 15.884C7.14127 15.8659 7.15697 15.8485 7.17361 15.8319C7.19025 15.8153 7.20773 15.7996 7.22578 15.7847C7.23848 15.7743 7.25189 15.765 7.26516 15.7556C7.27055 15.7518 7.27575 15.7475 7.28128 15.7438C7.29778 15.7328 7.3147 15.723 7.33177 15.7136C7.33467 15.712 7.3373 15.7101 7.34025 15.7086C7.35783 15.6992 7.37588 15.6909 7.39406 15.6831C7.39688 15.6819 7.39955 15.6804 7.40236 15.6793C7.41966 15.6721 7.43728 15.6661 7.45495 15.6604C7.45913 15.6592 7.46311 15.6574 7.46733 15.6561C7.48355 15.6513 7.5 15.6474 7.51655 15.6437C7.5225 15.6424 7.52831 15.6406 7.53427 15.6394C7.54945 15.6364 7.56483 15.6346 7.5802 15.6326C7.58761 15.6316 7.59492 15.6301 7.60247 15.6294C7.6208 15.6276 7.63917 15.627 7.65759 15.6266C7.66209 15.6265 7.66641 15.626 7.67086 15.626L10.1199 15.6261C10.5082 15.6261 10.823 15.9409 10.823 16.3292C10.823 16.7175 10.5082 17.0323 10.1199 17.0323H9.98231C10.6155 17.286 11.2974 17.4192 12 17.4192C13.4475 17.4192 14.8084 16.8555 15.832 15.8319C17.3003 14.3635 17.7991 12.2285 17.1337 10.26C17.0093 9.89203 17.2068 9.49303 17.5747 9.36867C17.9425 9.24431 18.3415 9.44175 18.4659 9.80958C18.8674 10.9981 18.9345 12.2742 18.6598 13.4983Z" fill="#0067FF"/>
													</g>
													<defs>
														<clipPath id="clip0_58_5706">
															<rect width="24" height="24" fill="white"/>
														</clipPath>
													</defs>
												</svg>
													<span>{isGenerating ? T("api.key.generating") : T("api.key.generate")}</span>
												</button>
											</div>
										</div>
									)}
								</>
							) : (
								<div className="api-key-block__unauthorized">
									<p>{T("api.unauthorized.message")}</p>
									<Link href={getLocalizedLink("/auth/login")} className="api-key-block__login-link">{T("api.unauthorized.login")}</Link>
								</div>
							)}
						</div>
					</div>

					{/* Подблок 2: Документация */}
					<div className="api-docs-block">
						<h2 className="api-docs-block__title">{T("api.docs.title")}</h2>
						<div className="api-docs-block__tabs">
							<button
								type="button"
								className={`api-docs-tab ${selectedLanguage === 'curl' ? 'active' : ''}`}
								onClick={() => setSelectedLanguage('curl')}
							>
								cURL
							</button>
							<button
								type="button"
								className={`api-docs-tab ${selectedLanguage === 'javascript' ? 'active' : ''}`}
								onClick={() => setSelectedLanguage('javascript')}
							>
								JavaScript
							</button>
							<button
								type="button"
								className={`api-docs-tab ${selectedLanguage === 'python' ? 'active' : ''}`}
								onClick={() => setSelectedLanguage('python')}
							>
								Python
							</button>
						</div>
						<div className="api-docs-block__code-wrapper">
							<div className="api-docs-block__code-header">
								<span className="api-docs-block__code-lang">
									{selectedLanguage === 'curl' ? 'cURL' : selectedLanguage === 'javascript' ? 'JavaScript' : 'Python'}
								</span>
								<button
									type="button"
									className="api-code-copy-btn"
									onClick={copyCode}
									aria-label={T("api.docs.copyCode")}
								>
									<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
										<rect x="4" y="5" width="14" height="15" fill="#5F6169"/>
										<path d="M8.75006 19.5C6.40706 19.5 4.5 17.5929 4.5 15.2499V5.00006H2.75006C1.23305 5.00006 0 6.23287 0 7.74994V21.2499C0 22.767 1.23305 24 2.75006 24H15.2499C16.767 24 18 22.767 18 21.2499V19.5H8.75006Z" fill="white"/>
										<path d="M21.9999 2.75006C21.9999 1.23103 20.7689 0 19.2501 0H8.75006C7.23103 0 6 1.23103 6 2.75006V15.2499C6 16.769 7.23103 18 8.75006 18H19.2501C20.7689 18 21.9999 16.769 21.9999 15.2499V2.75006Z" fill="white"/>
									</svg>
								</button>
							</div>
							<div className="api-docs-block__code">
								{isLoadingCode ? (
									<div style={{ padding: '20px', color: '#EDF6F9' }}>{T("api.key.loading")}</div>
								) : codeContent ? (
									<SyntaxHighlighter
										language={selectedLanguage === 'curl' ? 'bash' : selectedLanguage}
										style={vscDarkPlus}
										customStyle={{
											background: 'transparent',
											padding: 0,
											margin: 0,
											fontSize: '14px',
											lineHeight: '1.6'
										}}
										codeTagProps={{
											style: {
												fontFamily: "'Courier New', monospace"
											}
										}}
									>
										{codeContent}
									</SyntaxHighlighter>
								) : (
									<div style={{ padding: '20px', color: '#EDF6F9' }}>{T("api.docs.codeNotAdded")}</div>
								)}
							</div>
							<div className="api-docs-block__code-copy">
								{codeContent}
							</div>
						</div>
					</div>
				</div>

				{/* Правый блок: Обязательные методы */}
				<div className="api-page__right">
					<h1 className="api-page__title">{T("api.requiredMethods.title")}</h1>
					<div className="api-methods-list">
						{requiredMethods.map((method) => (
							<button
								key={method.id}
								type="button"
								className={`api-method-item ${selectedMethod === method.key ? 'active' : ''}`}
								onClick={() => setSelectedMethod(method.key)}
							>
								<img 
									className="api-method-item__background" 
									src={method.background} 
									alt="" 
									style={method.flipVertical ? { transform: 'scaleY(-1)' } : undefined}
								/>
								<div className="api-method-item__icon">
									<img src={method.icon} alt="" width="48" height="48" />
								</div>
								<span className="api-method-item__name">{method.name}</span>
							</button>
						))}
					</div>
				</div>
			</div>
		</main>
	)
}
