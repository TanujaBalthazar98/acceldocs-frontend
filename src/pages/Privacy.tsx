import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import docspeareIcon from "@/assets/docspeare-icon.png";

const Privacy = () => {
  return (
    <>
      <Helmet>
        <title>Privacy Policy | Docspeare</title>
        <meta name="description" content="Learn how Docspeare collects, uses, and protects your personal information." />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card/50">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link to="/auth" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden">
                  <img src={docspeareIcon} alt="Docspeare" className="w-full h-full object-cover" />
                </div>
                <span className="text-xl font-semibold text-foreground">Docspeare</span>
              </Link>
              <Link 
                to="/auth" 
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="container mx-auto px-6 py-16 max-w-4xl">
          <h1 className="text-4xl font-bold text-foreground mb-8">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Docspeare ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our documentation platform and services. Access to a Docspeare workspace is managed by each organization.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
              <h3 className="text-xl font-medium text-foreground mb-3">2.1 Information You Provide</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                <li>Account information (name, email address) obtained through Google Sign-In</li>
                <li>Organization and workspace details</li>
                <li>Documentation content you create, import, or sync from Google Drive</li>
                <li>Communications with our support team</li>
              </ul>
              
              <h3 className="text-xl font-medium text-foreground mb-3">2.2 Information from Google APIs</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                When you authenticate with Google and grant access to Google Drive, we access:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                <li>Your Google account profile information (name, email, profile picture)</li>
                <li>Google Drive files and folders that you explicitly select for documentation</li>
                <li>Google Docs content for importing and syncing documentation</li>
                <li>File metadata (names, modification dates, folder structure)</li>
              </ul>

              <h3 className="text-xl font-medium text-foreground mb-3">2.3 Information Collected Automatically</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Device and browser information</li>
                <li>IP address and location data</li>
                <li>Usage patterns and feature interactions</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">3. How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">We use the information we collect to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Authenticate you using your Google Workspace account</li>
                <li>Import and sync documentation from your authorized Google Drive folders</li>
                <li>Manage permissions and access control for documentation</li>
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices, updates, and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Analyze usage patterns to enhance user experience</li>
                <li>Protect against fraudulent or illegal activity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">4. Google API Services - Limited Use Disclosure</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Docspeare's use and transfer of information received from Google APIs adheres to the{" "}
                <a 
                  href="https://developers.google.com/terms/api-services-user-data-policy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Specifically, we:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Only access data necessary</strong> to provide and improve our documentation platform features</li>
                <li><strong>Do not sell</strong> Google user data to third parties</li>
                <li><strong>Do not use</strong> Google user data for advertising purposes</li>
                <li><strong>Do not transfer</strong> Google user data to third parties except as necessary to provide the service, comply with applicable laws, or with your explicit consent</li>
                <li><strong>Do not allow humans to read</strong> Google user data unless we have your affirmative agreement, it is necessary for security purposes, to comply with applicable law, or the data is aggregated and anonymized</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">5. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We implement appropriate technical and organizational measures to protect your personal information:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>All data is encrypted in transit using TLS/SSL</li>
                <li>Authentication tokens are securely stored and encrypted at rest</li>
                <li>We maintain audit logs of data access and modifications</li>
                <li>Google OAuth tokens are refreshed automatically and stored securely</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">6. Data Sharing and Disclosure</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">We do not sell your personal information. We may share your information with:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Other authorized users within your organization as permitted by role and project permissions</li>
                <li>Service providers who assist in operating our platform (cloud hosting, database services)</li>
                <li>Professional advisors (lawyers, accountants, auditors)</li>
                <li>Law enforcement when required by law</li>
                <li>Other parties in connection with a merger or acquisition</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">7. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your data for as long as your account is active or as needed to provide services. Documentation content is retained until explicitly deleted. You can request deletion of your data by contacting the platform administrators.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">8. Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">Depending on your location, you may have the right to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Access and receive a copy of your personal data</li>
                <li>Rectify inaccurate personal data</li>
                <li>Request deletion of your personal data</li>
                <li>Object to or restrict processing of your data</li>
                <li>Data portability</li>
                <li>Revoke Google Drive access at any time through your Google Account settings</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">9. Revoking Access</h2>
              <p className="text-muted-foreground leading-relaxed">
                You can revoke Docspeare's access to your Google account at any time by visiting your{" "}
                <a 
                  href="https://myaccount.google.com/permissions" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google Account Permissions
                </a>
                {" "}page and removing access for Docspeare.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">10. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at{" "}
                <a href="mailto:tanujabalthazar98@gmail.com" className="text-primary hover:underline">
                  tanujabalthazar98@gmail.com
                </a>
              </p>
            </section>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-8">
          <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
            © 2025 Docspeare. All rights reserved.
          </div>
        </footer>
      </div>
    </>
  );
};

export default Privacy;
