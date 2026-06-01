import type { Metadata } from "next"
import Layout from "@/shared/components/ui/Layout"
import { getUser } from "@/shared/server/getUser"
import { getLocale } from "@/shared/server/getLocale"

export const metadata: Metadata = {
	title: "Privacy Policy | Shadow Proxy",
	description: "Privacy Policy for Shadow Proxy"
}

export default async function PrivacyPage() {
	const user = await getUser()
	const locale = await getLocale()

	return (
		<Layout user={user} locale={locale}>
			<main className="legal-page">
				<div className="legal-page__container">
					<h1 className="legal-page__title">Privacy Policy</h1>
					<p className="legal-page__updated">Last updated: 23.03.2026</p>

					<section className="legal-section">
						<h2>1. Data Collected</h2>
						<ul>
							<li>Telegram data</li>
							<li>Email address</li>
							<li>Google account data</li>
							<li>Crypto payment data</li>
							<li>IP address</li>
							<li>Cookies</li>
						</ul>
					</section>

					<section className="legal-section">
						<h2>2. How We Use Data</h2>
						<ul>
							<li>Service operation</li>
							<li>Authentication (Telegram, Email, Google)</li>
							<li>Abuse prevention</li>
							<li>Transactions</li>
							<li>Improvements</li>
						</ul>
					</section>

					<section className="legal-section">
						<h2>3. Legal Basis</h2>
						<ul>
							<li>Legitimate interest</li>
							<li>Contract necessity</li>
						</ul>
					</section>

					<section className="legal-section">
						<h2>4. Third-Party Authentication</h2>
						<p>Authentication via Google or Telegram may provide basic profile data. We do not have access to your passwords.</p>
					</section>

					<section className="legal-section">
						<h2>5. Data Sharing</h2>
						<p>We do not sell data. Data may be shared with infrastructure providers and authentication providers (Google, Telegram).</p>
					</section>

					<section className="legal-section">
						<h2>6. Data Retention</h2>
						<p>Stored only as necessary.</p>
					</section>

					<section className="legal-section">
						<h2>7. User Rights</h2>
						<ul>
							<li>Access</li>
							<li>Deletion</li>
							<li>Correction</li>
						</ul>
					</section>

					<section className="legal-section">
						<h2>8. Security</h2>
						<p>Reasonable protection applied.</p>
					</section>

					<section className="legal-section">
						<h2>9. Cookies</h2>
						<p>Used for functionality.</p>
					</section>

					<section className="legal-section">
						<h2>10. Data Location</h2>
						<p>Multiple jurisdictions.</p>
					</section>

					<section className="legal-section">
						<h2>11. Changes</h2>
						<p>We may update anytime.</p>
					</section>

					<section className="legal-section">
						<h2>12. Contact</h2>
						<p>Telegram: <a href="https://t.me/shadowproxysupport_bot" target="_blank" rel="noopener noreferrer">@shadowproxysupport_bot</a></p>
						<p>Email: <a href="mailto:shadowproxysupport@gmail.com">shadowproxysupport@gmail.com</a></p>
					</section>
				</div>
			</main>
		</Layout>
	)
}
