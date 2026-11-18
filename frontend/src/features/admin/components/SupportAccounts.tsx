"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Headset, Trash2, UserPlus } from "lucide-react"
import { type FC, useState } from "react"
import toast from "react-hot-toast"

import { adminService, type SupportAccount } from "@/features/admin/serices/admin.service"

import Card from "@/shared/components/ui/Card"

type StaffRole = "SUPPORT" | "SMM"

const ROLE_LABEL: Record<StaffRole, string> = {
	SUPPORT: "Поддержка",
	SMM: "SMM"
}

/** Аккаунты сотрудников: поддержка видит только «Поддержку», SMM — только «Маркетинг / UTM». */
const SupportAccounts: FC = () => {
	const queryClient = useQueryClient()
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [role, setRole] = useState<StaffRole>("SUPPORT")

	const accounts = useQuery({
		queryKey: ["admin-support-accounts"],
		queryFn: () => adminService.getSupportAccounts()
	})
	const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-support-accounts"] })

	const create = useMutation({
		mutationFn: () => adminService.createSupportAccount({ email: email.trim(), password, role }),
		onSuccess: () => {
			toast.success("Аккаунт сотрудника создан")
			setEmail("")
			setPassword("")
			invalidate()
		},
		onError: (e: Error) => toast.error(e.message)
	})
	const revoke = useMutation({
		mutationFn: (id: string) => adminService.revokeSupportAccount(id),
		onSuccess: () => {
			toast.success("Доступ сотрудника снят")
			invalidate()
		},
		onError: (e: Error) => toast.error(e.message)
	})

	const canSubmit = email.includes("@") && password.length >= 8 && !create.isPending
	const inputCls =
		"w-full rounded-[12px] border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#6aa5ff]/50 focus:outline-none"

	return (
		<Card className="!py-5">
			<div className="flex items-center gap-3">
				<span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#6aa5ff]/25 bg-[#2f6bff]/10 text-[#8db8ff]">
					<Headset className="h-5 w-5" aria-hidden="true" />
				</span>
				<div>
					<p className="text-[15px] font-medium text-white">Аккаунты сотрудников</p>
					<p className="text-xs text-white/45">
						Вход по почте и паролю. Поддержка видит только раздел «Поддержка», SMM — только «Маркетинг / UTM».
					</p>
				</div>
			</div>

			<form
				className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"
				onSubmit={e => {
					e.preventDefault()
					if (canSubmit) create.mutate()
				}}
			>
				<input className={inputCls} type="email" placeholder="staff@shadowproxy.io" value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" />
				<input className={inputCls} type="password" placeholder="Пароль, минимум 8 символов" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
				<select className={`${inputCls} cursor-pointer`} value={role} onChange={e => setRole(e.target.value as StaffRole)}>
					<option value="SUPPORT">Поддержка</option>
					<option value="SMM">SMM (маркетинг)</option>
				</select>
				<button
					type="submit"
					disabled={!canSubmit}
					className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#2f6bff] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2558d6] disabled:opacity-50"
				>
					<UserPlus className="h-4 w-4" aria-hidden="true" />
					Создать
				</button>
			</form>

			<ul className="mt-4 flex flex-col divide-y divide-white/[0.06]">
				{accounts.isLoading && <li className="py-2 text-sm text-white/45">Загрузка…</li>}
				{accounts.data?.length === 0 && <li className="py-2 text-sm text-white/45">Пока нет аккаунтов сотрудников.</li>}
				{accounts.data?.map((acc: SupportAccount) => (
					<li key={acc.id} className="flex items-center justify-between gap-3 py-2.5">
						<div className="min-w-0">
							<p className="truncate text-sm text-white">{acc.email}</p>
							<p className="text-xs text-white/40">
								{ROLE_LABEL[(acc.role as StaffRole)] ?? acc.role} · {new Date(acc.createdAt).toLocaleDateString("ru-RU")}
							</p>
						</div>
						<button
							type="button"
							onClick={() => {
								if (window.confirm(`Снять доступ сотрудника с ${acc.email}?`)) revoke.mutate(acc.id)
							}}
							disabled={revoke.isPending}
							className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:border-[#ff5c5c]/50 hover:text-[#ff7b7b] disabled:opacity-50"
						>
							<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
							Снять доступ
						</button>
					</li>
				))}
			</ul>
		</Card>
	)
}

export default SupportAccounts
