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

	return (
		<Layout user={user} locale={locale}>
			<main className="legal-page">
				<div className="legal-page__container">
					<h1 className="legal-page__title">Terms of Service</h1>
					<p className="legal-page__updated">Last updated: 23.03.2026</p>

					<section className="legal-section">
						<h2>1. Introduction</h2>
						<p>By using ShadowProxy (&quot;Service&quot;), you agree to these Terms.</p>
					</section>

					<section className="legal-section">
						<h2>2. Eligibility</h2>
						<p>18+ only.</p>
					</section>

					<section className="legal-section">
						<h2>3. Accounts</h2>
						<ul>
							<li>Registration via Telegram, email, or Google authentication</li>
							<li>You are responsible for account security</li>
							<li>We may suspend accounts at any time</li>
						</ul>
					</section>

					<section className="legal-section">
						<h2>4. Acceptable Use</h2>
						<p>Prohibited:</p>
						<ul>
							<li>Illegal activity</li>
							<li>Fraud / phishing</li>
							<li>Spam / automation abuse</li>
							<li>Unauthorized access</li>
							<li>Bypassing third-party restrictions</li>
							<li>Multi-accounting / farming</li>
							<li>Botting</li>
						</ul>
						<p>We monitor abuse and may cooperate with law enforcement.</p>
						<p>Abuse reports can be sent to <a href="mailto:shadowproxysupport@gmail.com">shadowproxysupport@gmail.com</a></p>
					</section>

					<section className="legal-section">
						<h2>5. User Responsibility</h2>
						<p>Users are fully responsible for their actions.</p>
					</section>

					<section className="legal-section">
						<h2>6. Third-Party Infrastructure</h2>
						<p>Service relies on third-party providers. We are not responsible for their actions or performance.</p>
					</section>

					<section className="legal-section">
						<h2>7. Abuse Handling</h2>
						<p>Abuse detection may be handled by providers. Access may be restricted without notice.</p>
					</section>

					<section className="legal-section">
						<h2>8. No Control Clause</h2>
						<p>We do not fully control proxy networks.</p>
					</section>

					<section className="legal-section">
						<h2>9. No Anonymity Guarantee</h2>
						<p>No guarantee of anonymity.</p>
					</section>

					<section className="legal-section">
						<h2>10. Payments</h2>
						<p>Crypto only. No refunds.</p>
					</section>

					<section className="legal-section">
						<h2>11. Disclaimer</h2>
						<p>Service &quot;as is&quot;. No guarantees.</p>
					</section>

					<section className="legal-section">
						<h2>12. Liability</h2>
						<p>We are not responsible for damages or misuse.</p>
					</section>

					<section className="legal-section">
						<h2>13. Indemnification</h2>
						<p>You agree to hold us harmless.</p>
					</section>

					<section className="legal-section">
						<h2>14. Data Processing</h2>
						<p>Minimal data for security.</p>
					</section>

					<section className="legal-section">
						<h2>15. Legal Use</h2>
						<p>We do not guarantee legality in your country.</p>
					</section>

					<section className="legal-section">
						<h2>16. Termination</h2>
						<p>We can terminate anytime.</p>
					</section>

					<section className="legal-section">
						<h2>17. Governing Law</h2>
						<p>Applicable international laws.</p>
					</section>

					<section className="legal-section">
						<h2>18. Language</h2>
						<p>English prevails.</p>
					</section>

					<section className="legal-section">
						<h2>19. Contact</h2>
						<p>Telegram: <a href="https://t.me/shadowproxysupport_bot" target="_blank" rel="noopener noreferrer">@shadowproxysupport_bot</a></p>
						<p>Email: <a href="mailto:shadowproxysupport@gmail.com">shadowproxysupport@gmail.com</a></p>
					</section>
				</div>
			</main>
		</Layout>
	)
}
