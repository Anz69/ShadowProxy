"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { usePathname } from "next/navigation"
import { type FC, useState, useEffect, useCallback, useRef } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { ArrowRight, Check, WalletCards, Zap } from "lucide-react"

import PaymentModal from "@/features/payments/components/PaymentModal"
import TransactionHistory from "@/features/payments/components/TransactionHistory"
import { useBalancePayment } from "@/features/payments/hooks/useBalancePayment"
import type { Package } from "@/features/packages/types/packages.types"
import type {
	ExchangeRates,
	Invoice,
	Merchant,
	AvailableAssets
} from "@/features/payments/types/payment.types"
import type { User } from "@/features/user/types/user.types"

import Button from "@/shared/components/ui/Button"
import Footnote from "@/shared/components/ui/Footnote"
import Input from "@/shared/components/ui/Input"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

const balanceSchema = z.object({
	amount: z.number().min(1, "Минимальная сумма пополнения 1$")
})

type BalanceReplenishProps = {
	exchangeRates: ExchangeRates
	packages: Package[]
	payments: Invoice[]
	user?: User | null
}

const BalanceReplenish: FC<BalanceReplenishProps> = ({
	exchangeRates,
	packages,
	payments,
	user
}) => {
	const pathname = usePathname()
	const locale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, locale)
	const isOpen = useModalStore((s) => s.isOpen)
	const updateContent = useModalStore((s) => s.updateContent)
	const openModal = useModalStore((s) => s.open)
	const closeModal = useModalStore((s) => s.close)
	const { createBalanceInvoice, isBalanceInvoiceLoading } = useBalancePayment()
	const formRef = useRef<HTMLElement>(null)
	const [historyHeight, setHistoryHeight] = useState<number | undefined>()

	useEffect(() => {
		const form = formRef.current
		if (!form) return
		const desktop = window.matchMedia("(min-width: 1280px)")
		const measure = () => setHistoryHeight(desktop.matches ? form.getBoundingClientRect().height : undefined)
		const observer = new ResizeObserver(measure)
		observer.observe(form)
		desktop.addEventListener("change", measure)
		measure()
		return () => {
			observer.disconnect()
			desktop.removeEventListener("change", measure)
		}
	}, [])

	const {
		watch,
		register,
		setValue,
		formState: { errors },
		setError,
		clearErrors
	} = useForm<{ amount: number }>({
		resolver: zodResolver(balanceSchema),
		defaultValues: {
			amount: 1
		}
	})

	useEffect(() => {
		setValue("amount", 1)
	}, [setValue])

	const [merchant, setMerchant] = useState<Merchant>("CRYPTO_BOT")
	const [asset, setAsset] = useState<AvailableAssets>("USDT")
	const [isSuccess, setIsSuccess] = useState(false)
	const [price, setPrice] = useState(1)
	const [assetPrice, setAssetPrice] = useState(0)

	const amount = watch("amount") || 1
	const currentBalance = user ? Number(user.balance) : 0
	const balanceAfterReplenish = currentBalance + (amount || 0)

	useEffect(() => {
		setPrice(amount || 1)
		const calculateAssetPrice = (price: number) => {
			if (asset.startsWith("USD")) {
				setAssetPrice(price)
			} else {
				setAssetPrice(
					price /
						exchangeRates[
							asset as Exclude<AvailableAssets, "USDT" | "USDC">
						]
				)
			}
		}
		calculateAssetPrice(amount || 1)
	}, [amount, asset, exchangeRates])

	const onSubmit = useCallback((dto: { merchant?: Merchant; asset?: AvailableAssets }) => {
		const options = {
			onSuccess: (data: Invoice<"balance">) => {
				setIsSuccess(true)
				if (data.paymentUrl) {
					window.open(data.paymentUrl, "_blank")
				}
			},
			onError: ({ message }: { message: string }) =>
				setError("root", {
					message
				})
		}

		const finalMerchant = dto.merchant ?? merchant
		const finalAsset = dto.asset ?? asset

		createBalanceInvoice(
			{
				amount,
				asset: finalAsset,
				merchant: finalMerchant
			},
			options
		)
	}, [amount, asset, merchant, createBalanceInvoice, setError])

	const getPaymentModalContent = useCallback(
		() => (
			<PaymentModal
				tariff="RESIDENT_PREMIUM"
				traffic={0}
				packages={[]}
				prices={{ resident_premium: 0, premium_residential: 0, mobile: 0, mobile_gb: 0, ipv6_gb: 0 }}
				exchangeRates={exchangeRates}
				merchant={merchant}
				setMerchant={setMerchant}
				asset={asset}
				setAsset={setAsset}
				price={price}
				assetPrice={assetPrice}
				onSubmit={onSubmit}
				isLoading={isBalanceInvoiceLoading}
				isSuccess={isSuccess}
				error={errors.root?.message}
				clearError={() => clearErrors("root")}
				user={user}
				isBalanceReplenish={true}
			/>
		),
		[exchangeRates, merchant, asset, price, assetPrice, onSubmit, isBalanceInvoiceLoading, isSuccess, errors.root?.message, user, clearErrors]
	)

	const handleOpenPaymentModal = () => {
		openModal(getPaymentModalContent())
	}

	// Обновляем контент модалки при изменении isSuccess/error/isLoading, чтобы отобразить уведомление
	useEffect(() => {
		if (isOpen) {
			updateContent(getPaymentModalContent())
		}
	}, [isOpen, isBalanceInvoiceLoading, isSuccess, errors.root?.message, getPaymentModalContent, updateContent])

	// Закрываем модалку при успешной оплате
	useEffect(() => {
		if (isOpen && isSuccess) {
			closeModal()
		}
	}, [isOpen, isSuccess, closeModal])

	return (
		<div className="relative flex w-full flex-col gap-6 py-[clamp(22px,4vw,44px)] text-white light:text-[#0e1019]">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div><span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-[#78adff]"><Zap className="size-3.5" />Мгновенное зачисление</span><h1 className="mt-2 font-[TalosDisplay] text-[clamp(32px,5vw,52px)] font-bold leading-none">{T("payment.balanceReplenishTitle")}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-white/45 light:text-[#667085]">Выберите сумму, затем удобную валюту и способ оплаты. Баланс обновится после подтверждения платежа.</p></div>
			</div>

			<div className="grid w-full items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
				<section ref={formRef} className="relative overflow-hidden rounded-[24px] border border-white/[0.09] bg-[radial-gradient(100%_110%_at_100%_0%,rgba(59,130,246,.2),transparent_50%),linear-gradient(145deg,#101d38,#080f1f)] p-5 shadow-[0_38px_90px_-55px_rgba(0,0,0,.95),inset_0_1px_0_rgba(255,255,255,.06)] sm:p-7 light:border-[#e6e8ef] light:bg-none light:bg-white">
					<div className="mb-6 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[14px] border border-[#6aa5ff]/25 bg-[#2f6bff]/12 text-[#78adff]"><WalletCards className="size-5" /></span><div><h2 className="font-[TalosDisplay] text-xl font-semibold">{T("payment.title")}</h2><p className="mt-0.5 text-xs text-white/40 light:text-[#8a93a3]">Минимальная сумма — 1 USD</p></div></div>

					<div className="grid gap-3 sm:grid-cols-2">
						<div className="rounded-[16px] border border-white/[0.08] bg-white/[0.035] p-4 light:border-[#e6e8ef] light:bg-[#f7f8fb]"><span className="text-xs text-white/40 light:text-[#8a93a3]">{T("payment.currentBalance")}</span><strong className="mt-2 block font-[TalosDisplay] text-2xl">${currentBalance.toFixed(2)}</strong></div>
						<div className="rounded-[16px] border border-[#6aa5ff]/20 bg-[#2f6bff]/[0.08] p-4 light:border-[#2f6bff]/20 light:bg-[#2f6bff]/[0.06]"><span className="text-xs text-[#9bc2ff] light:text-[#365aa0]">{T("payment.balanceAfterReplenish")}</span><strong className="mt-2 block font-[TalosDisplay] text-2xl">${balanceAfterReplenish.toFixed(2)}</strong></div>
					</div>

					<label className="mt-6 block"><span className="mb-2 block text-sm font-medium text-white/65 light:text-[#475467]">{T("payment.replenish")}</span><Input placeholder={T("payment.replenishPlaceholder")} type="number" step="0.01" min="1" error={errors.amount?.message} className="w-full !rounded-[14px] !border-white/15 !bg-white/[0.04] !px-4 !py-4 !text-lg hover:!border-[#6aa5ff]/40 focus:!border-[#6aa5ff]/60 light:!border-[#e2e4ea] light:!bg-[#f7f8fb] light:!text-[#0e1019]" {...register("amount", { valueAsNumber: true })} title="" /></label>
					<div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">{[10, 25, 50, 100, 250, 500].map(value => <button key={value} type="button" onClick={() => setValue("amount", value, { shouldValidate: true })} className={`min-h-11 rounded-[11px] border text-sm font-semibold transition ${amount === value ? "border-[#6aa5ff]/50 bg-[#2f6bff]/20 text-white light:border-[#2f6bff]/40 light:bg-[#2f6bff]/10 light:text-[#2455bf]" : "border-white/[0.08] bg-white/[0.025] text-white/55 hover:border-white/20 hover:text-white light:border-[#e6e8ef] light:bg-[#f7f8fb] light:text-[#667085] light:hover:text-[#2455bf]"}`}>${value}</button>)}</div>

					<div className="mt-6 rounded-[16px] border border-white/[0.08] bg-black/10 p-4 light:border-[#e6e8ef] light:bg-[#f7f8fb]"><div className="flex items-end justify-between gap-4"><span className="text-sm text-white/45 light:text-[#667085]">{T("payment.total")}</span><strong className="font-[TalosDisplay] text-3xl">${(price || 0).toFixed(2)}</strong></div><div className="mt-3 flex items-center gap-2 text-xs text-white/35 light:text-[#8a93a3]"><Check className="size-3.5 text-emerald-400" />Комиссия и курс будут показаны до оплаты</div></div>
					{errors.root?.message && <div className="mt-4"><Footnote variant="error">{errors.root.message}</Footnote></div>}
					{isSuccess && <div className="mt-4"><Footnote variant="success">{T("payment.successMessage")}</Footnote></div>}
					<Button variant="white" type="button" disabled={!amount || amount < 1} className="mt-5 !min-h-12 w-full !rounded-full !bg-gradient-to-b !from-[#5595ff] !to-[#2f6bff] !text-white shadow-[0_16px_40px_-14px_rgba(59,130,246,.9)]" onClick={handleOpenPaymentModal}>{T("payment.replenish")}<ArrowRight className="ml-2 inline size-4" /></Button>
				</section>
				<section className="h-[480px] min-h-0 min-w-0 overflow-hidden rounded-[24px]" style={historyHeight ? { height: historyHeight, maxHeight: historyHeight } : undefined}><TransactionHistory payments={payments} packages={packages} locale={locale} bounded /></section>
			</div>
		</div>
	)
}

export default BalanceReplenish
