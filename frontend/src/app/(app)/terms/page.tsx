import type { Metadata } from "next"
import Layout from "@/shared/components/ui/Layout"
import { getUser } from "@/shared/server/getUser"
import { getLocale } from "@/shared/server/getLocale"

export const metadata: Metadata = {
	title: "Terms of Service | Shadow Proxy",
	description: "Terms of Service for Shadow Proxy"
}

export default async function TermsPage() {
	const user = await getUser()
	const locale = await getLocale()

	const sectionCls = "mt-8 first:mt-0"
	const h2Cls = "font-[TalosDisplay] text-[20px] sm:text-[22px] font-semibold tracking-[-0.02em] text-white light:text-[#0e1019]"
	const pCls = "mt-3 text-[15px] leading-[1.7] text-white/60 light:text-[#5b6472]"
	const ulCls = "mt-3 space-y-2"
	const liCls =
		"relative pl-5 text-[15px] leading-[1.7] text-white/60 light:text-[#5b6472] before:absolute before:left-0 before:top-[0.7em] before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full before:bg-gradient-to-br before:from-[#6aa5ff] before:to-[#34d3ee] before:shadow-[0_0_10px_rgba(106,165,255,0.7)]"
	const linkCls = "break-words text-[#6aa5ff] light:text-[#2f6bff] underline-offset-4 transition-colors hover:text-[#8fb6ff] light:hover:text-[#1d4ed8] hover:underline"

	return (
		<Layout user={user} locale={locale}>
			<main className="relative min-h-screen overflow-hidden bg-[#060d1e] light:bg-[#eceff5] py-[clamp(64px,9vw,120px)]">
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-x-0 top-0 -z-[1] h-[600px] bg-[radial-gradient(50%_60%_at_50%_-8%,rgba(79,141,255,0.16),transparent_70%)]"
				/>

				<div className="mx-auto w-full max-w-[820px] px-5 sm:px-6">
					<header className="mb-10 flex flex-col items-start">
						<span className="inline-flex w-max items-center gap-2 rounded-full border border-white/10 light:border-[#2f6bff]/25 bg-white/[0.06] light:bg-[#2f6bff]/[0.08] px-4 py-1.5 text-[13px] font-semibold text-white/70 light:text-[#2f6bff] backdrop-blur-md">
							<span className="inline-block h-2 w-2 rounded-full bg-gradient-to-br from-[#6aa5ff] to-[#34d3ee] shadow-[0_0_12px_rgba(106,165,255,0.9)]" />
							Legal
						</span>
						<h1 className="mt-5 font-[TalosDisplay] text-[clamp(32px,4.4vw,52px)] font-semibold tracking-[-0.035em] text-white light:text-[#0e1019]">
							Terms of Service
						</h1>
						<p className="mt-3 text-[14px] text-white/40 light:text-[#8a93a3]">Last updated: 23.03.2026</p>
					</header>

					<div className="rounded-[24px] border border-white/[0.08] light:border-[#e6e8ef] bg-[linear-gradient(180deg,#0e1830,#0a1020)] light:bg-none light:bg-white p-6 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] light:shadow-[0_24px_60px_-44px_rgba(14,16,25,0.16)] sm:p-12">
						<section className={sectionCls}>
							<h2 className={h2Cls}>1. Introduction</h2>
							<p className={pCls}>By using ShadowProxy (&quot;Service&quot;), you agree to these Terms.</p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>2. Eligibility</h2>
							<p className={pCls}>18+ only.</p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>3. Accounts</h2>
							<ul className={ulCls}>
								<li className={liCls}>Registration via Telegram, email, or Google authentication</li>
								<li className={liCls}>You are responsible for account security</li>
								<li className={liCls}>We may suspend accounts at any time</li>
							</ul>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>4. Acceptable Use</h2>
							<p className={pCls}>Prohibited:</p>
							<ul className={ulCls}>
								<li className={liCls}>Illegal activity</li>
								<li className={liCls}>Fraud / phishing</li>
								<li className={liCls}>Spam / automation abuse</li>
								<li className={liCls}>Unauthorized access</li>
								<li className={liCls}>Bypassing third-party restrictions</li>
								<li className={liCls}>Multi-accounting / farming</li>
								<li className={liCls}>Botting</li>
							</ul>
							<p className={pCls}>We monitor abuse and may cooperate with law enforcement.</p>
							<p className={pCls}>Abuse reports can be sent to <a className={linkCls} href="mailto:shadowproxysupport@gmail.com">shadowproxysupport@gmail.com</a></p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>5. User Responsibility</h2>
							<p className={pCls}>Users are fully responsible for their actions.</p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>6. Third-Party Infrastructure</h2>
							<p className={pCls}>Service relies on third-party providers. We are not responsible for their actions or performance.</p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>7. Abuse Handling</h2>
							<p className={pCls}>Abuse detection may be handled by providers. Access may be restricted without notice.</p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>8. No Control Clause</h2>
							<p className={pCls}>We do not fully control proxy networks.</p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>9. No Anonymity Guarantee</h2>
							<p className={pCls}>No guarantee of anonymity.</p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>10. Payments</h2>
							<p className={pCls}>Crypto only. No refunds.</p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>11. Disclaimer</h2>
							<p className={pCls}>Service &quot;as is&quot;. No guarantees.</p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>12. Liability</h2>
							<p className={pCls}>We are not responsible for damages or misuse.</p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>13. Indemnification</h2>
							<p className={pCls}>You agree to hold us harmless.</p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>14. Data Processing</h2>
							<p className={pCls}>Minimal data for security.</p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>15. Legal Use</h2>
							<p className={pCls}>We do not guarantee legality in your country.</p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>16. Termination</h2>
							<p className={pCls}>We can terminate anytime.</p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>17. Governing Law</h2>
							<p className={pCls}>Applicable international laws.</p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>18. Language</h2>
							<p className={pCls}>English prevails.</p>
						</section>

						<section className={sectionCls}>
							<h2 className={h2Cls}>19. Contact</h2>
							<p className={pCls}>Telegram: <a className={linkCls} href="https://t.me/shadowproxysupport_bot" target="_blank" rel="noopener noreferrer">@shadowproxysupport_bot</a></p>
							<p className={pCls}>Email: <a className={linkCls} href="mailto:shadowproxysupport@gmail.com">shadowproxysupport@gmail.com</a></p>
						</section>
					</div>
				</div>
			</main>
		</Layout>
	)
}
