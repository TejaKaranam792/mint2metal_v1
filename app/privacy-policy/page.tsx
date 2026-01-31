"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicy() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#0B0F14] text-[#f1f5f9]">
     
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#f1f5f9] mb-4">Privacy Policy</h1>
          <p className="text-[#9CA3AF] text-lg">Mint2Metal - Digital Silver Trading Platform</p>
          <p className="text-[#64748B] text-sm mt-2">Last updated: January 2025</p>
        </div>

        <div className="space-y-8">
          {/* Introduction */}
          <Card className="bg-[#121826] border-[#1F2937]">
            <CardHeader>
              <CardTitle className="text-[#f1f5f9]">1. Introduction</CardTitle>
            </CardHeader>
            <CardContent className="text-[#9CA3AF] space-y-4">
              <p>
                Mint2Metal ("we," "our," or "us") is committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our digital silver trading platform.
              </p>
              <p>
                Our platform enables secure trading of tokenized silver assets on the Stellar blockchain, combining traditional precious metals with modern blockchain technology. We are committed to compliance with applicable data protection laws and regulations.
              </p>
            </CardContent>
          </Card>

          {/* Information We Collect */}
          <Card className="bg-[#121826] border-[#1F2937]">
            <CardHeader>
              <CardTitle className="text-[#f1f5f9]">2. Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="text-[#9CA3AF] space-y-4">
              <h3 className="text-[#f1f5f9] font-semibold">2.1 Personal Information</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Full name, email address, and contact information</li>
                <li>Date of birth and nationality</li>
                <li>Government-issued identification documents for KYC verification</li>
                <li>Address and proof of address documentation</li>
                <li>Tax identification numbers where required</li>
              </ul>

              <h3 className="text-[#f1f5f9] font-semibold">2.2 Financial Information</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Bank account details for fiat currency transactions</li>
                <li>Stellar blockchain wallet addresses</li>
                <li>Transaction history and trading records</li>
                <li>Silver holdings and portfolio information</li>
              </ul>

              <h3 className="text-[#f1f5f9] font-semibold">2.3 Technical Information</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>IP address and device information</li>
                <li>Browser type and version</li>
                <li>Login timestamps and session data</li>
                <li>Platform usage analytics</li>
              </ul>

              <h3 className="text-[#f1f5f9] font-semibold">2.4 Blockchain Data</h3>
              <p>
                All silver token transactions are recorded on the Stellar public blockchain, which is immutable and publicly accessible. While we do not store this data directly, transaction details are visible to anyone with access to the blockchain.
              </p>
            </CardContent>
          </Card>

          {/* How We Use Your Information */}
          <Card className="bg-[#121826] border-[#1F2937]">
            <CardHeader>
              <CardTitle className="text-[#f1f5f9]">3. How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="text-[#9CA3AF] space-y-4">
              <p>We use your information for the following purposes:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>KYC and AML Compliance:</strong> Verify your identity and prevent financial crimes</li>
                <li><strong>Account Management:</strong> Create and maintain your trading account</li>
                <li><strong>Transaction Processing:</strong> Execute silver token trades and fiat settlements</li>
                <li><strong>Customer Support:</strong> Respond to your inquiries and resolve issues</li>
                <li><strong>Security:</strong> Detect and prevent fraudulent activities</li>
                <li><strong>Legal Compliance:</strong> Meet regulatory reporting requirements</li>
                <li><strong>Platform Improvement:</strong> Analyze usage patterns to enhance our services</li>
              </ul>
            </CardContent>
          </Card>

          {/* Information Sharing */}
          <Card className="bg-[#121826] border-[#1F2937]">
            <CardHeader>
              <CardTitle className="text-[#f1f5f9]">4. Information Sharing and Disclosure</CardTitle>
            </CardHeader>
            <CardContent className="text-[#9CA3AF] space-y-4">
              <p>We may share your information in the following circumstances:</p>

              <h3 className="text-[#f1f5f9] font-semibold">4.1 Service Providers</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>KYC and AML verification partners</li>
                <li>Payment processors and banking institutions</li>
                <li>Blockchain infrastructure providers</li>
                <li>Cloud storage and cybersecurity services</li>
              </ul>

              <h3 className="text-[#f1f5f9] font-semibold">4.2 Legal Requirements</h3>
              <p>
                We may disclose information when required by law, court order, or regulatory authority, including:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Anti-money laundering regulations</li>
                <li>Tax reporting requirements</li>
                <li>Law enforcement investigations</li>
                <li>Dispute resolution processes</li>
              </ul>

              <h3 className="text-[#f1f5f9] font-semibold">4.3 Business Transfers</h3>
              <p>
                In the event of a merger, acquisition, or sale of assets, your information may be transferred to the new entity, subject to the same privacy protections.
              </p>

              <h3 className="text-[#f1f5f9] font-semibold">4.4 Blockchain Transparency</h3>
              <p>
                Silver token transactions are publicly visible on the Stellar blockchain. We do not control or restrict access to this public ledger.
              </p>
            </CardContent>
          </Card>

          {/* Data Security */}
          <Card className="bg-[#121826] border-[#1F2937]">
            <CardHeader>
              <CardTitle className="text-[#f1f5f9]">5. Data Security</CardTitle>
            </CardHeader>
            <CardContent className="text-[#9CA3AF] space-y-4">
              <p>
                We implement industry-standard security measures to protect your information:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Encryption:</strong> All data transmission and storage is encrypted</li>
                <li><strong>Access Controls:</strong> Strict access controls and authentication requirements</li>
                <li><strong>Regular Audits:</strong> Security assessments and penetration testing</li>
                <li><strong>Incident Response:</strong> 24/7 monitoring and rapid response protocols</li>
                <li><strong>Physical Security:</strong> Secure data center facilities for physical assets</li>
              </ul>
              <p>
                While we strive to protect your information, no method of transmission over the internet or electronic storage is 100% secure. We cannot guarantee absolute security.
              </p>
            </CardContent>
          </Card>

          {/* Your Rights */}
          <Card className="bg-[#121826] border-[#1F2937]">
            <CardHeader>
              <CardTitle className="text-[#f1f5f9]">6. Your Rights</CardTitle>
            </CardHeader>
            <CardContent className="text-[#9CA3AF] space-y-4">
              <p>You have the following rights regarding your personal information:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Access:</strong> Request a copy of your personal information</li>
                <li><strong>Correction:</strong> Request correction of inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your information (subject to legal requirements)</li>
                <li><strong>Portability:</strong> Request transfer of your data in a structured format</li>
                <li><strong>Restriction:</strong> Request limitation of processing in certain circumstances</li>
                <li><strong>Objection:</strong> Object to processing based on legitimate interests</li>
              </ul>
              <p>
                To exercise these rights, please contact us using the information provided below.
              </p>
            </CardContent>
          </Card>

          {/* Data Retention */}
          <Card className="bg-[#121826] border-[#1F2937]">
            <CardHeader>
              <CardTitle className="text-[#f1f5f9]">7. Data Retention</CardTitle>
            </CardHeader>
            <CardContent className="text-[#9CA3AF] space-y-4">
              <p>
                We retain your information for as long as necessary to provide our services and comply with legal obligations:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>KYC Documents:</strong> 5 years after account closure (regulatory requirement)</li>
                <li><strong>Transaction Records:</strong> 7 years for tax and audit purposes</li>
                <li><strong>Account Information:</strong> Duration of account activity plus 3 years</li>
                <li><strong>Blockchain Data:</strong> Permanently stored on the Stellar public ledger</li>
              </ul>
            </CardContent>
          </Card>

          {/* International Data Transfers */}
          <Card className="bg-[#121826] border-[#1F2937]">
            <CardHeader>
              <CardTitle className="text-[#f1f5f9]">8. International Data Transfers</CardTitle>
            </CardHeader>
            <CardContent className="text-[#9CA3AF] space-y-4">
              <p>
                As a global platform, your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place, including:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Standard contractual clauses approved by regulatory authorities</li>
                <li>Adequacy decisions by relevant data protection authorities</li>
                <li>Binding corporate rules for intra-group transfers</li>
                <li>Certification schemes and codes of conduct</li>
              </ul>
            </CardContent>
          </Card>

          {/* Cookies and Tracking */}
          <Card className="bg-[#121826] border-[#1F2937]">
            <CardHeader>
              <CardTitle className="text-[#f1f5f9]">9. Cookies and Tracking Technologies</CardTitle>
            </CardHeader>
            <CardContent className="text-[#9CA3AF] space-y-4">
              <p>
                We use cookies and similar technologies to enhance your experience and analyze platform usage:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Essential Cookies:</strong> Required for platform functionality</li>
                <li><strong>Analytics Cookies:</strong> Help us understand user behavior and improve services</li>
                <li><strong>Security Cookies:</strong> Protect against fraud and unauthorized access</li>
              </ul>
              <p>
                You can control cookie preferences through your browser settings, though this may affect platform functionality.
              </p>
            </CardContent>
          </Card>

          {/* Changes to Privacy Policy */}
          <Card className="bg-[#121826] border-[#1F2937]">
            <CardHeader>
              <CardTitle className="text-[#f1f5f9]">10. Changes to This Privacy Policy</CardTitle>
            </CardHeader>
            <CardContent className="text-[#9CA3AF] space-y-4">
              <p>
                We may update this Privacy Policy periodically to reflect changes in our practices or legal requirements. We will:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Post the updated policy on our platform</li>
                <li>Update the "Last updated" date</li>
                <li>Notify you of material changes via email or platform notification</li>
                <li>Provide a summary of key changes</li>
              </ul>
              <p>
                Your continued use of our platform after changes take effect constitutes acceptance of the updated policy.
              </p>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="bg-[#121826] border-[#1F2937]">
            <CardHeader>
              <CardTitle className="text-[#f1f5f9]">11. Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="text-[#9CA3AF] space-y-4">
              <p>
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>

              <div className="bg-[#0B0F14] p-4 rounded-lg">
                <h3 className="text-[#f1f5f9] font-semibold mb-2">Data Protection Officer</h3>
                <p className="text-[#9CA3AF]">Email: privacy@mint2metal.com</p>
                <p className="text-[#9CA3AF]">Phone: +91-XXXXXXXXXX</p>
                <p className="text-[#9CA3AF]">Address: [Company Address]</p>
              </div>

              <p>
                For urgent privacy concerns or data breach reports, please contact our security team at security@mint2metal.com.
              </p>

              <p>
                You also have the right to lodge a complaint with your local data protection authority if you believe we have not adequately addressed your privacy concerns.
              </p>
            </CardContent>
          </Card>

          {/* Governing Law */}
          <Card className="bg-[#121826] border-[#1F2937]">
            <CardHeader>
              <CardTitle className="text-[#f1f5f9]">12. Governing Law</CardTitle>
            </CardHeader>
            <CardContent className="text-[#9CA3AF] space-y-4">
              <p>
                This Privacy Policy is governed by and construed in accordance with the laws of India. Any disputes arising from this policy will be subject to the exclusive jurisdiction of the courts in [Jurisdiction].
              </p>
              <p>
                For users outside India, applicable local laws may also apply to certain aspects of data processing.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12 pt-8 border-t border-[#1F2937]">
          <p className="text-[#64748B] text-sm">
            This Privacy Policy is an integral part of our Terms of Service. By using Mint2Metal, you acknowledge that you have read, understood, and agree to be bound by this policy.
          </p>
        </div>
      </main>
    </div>
  );
}
