import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import docspeareIcon from "@/assets/docspeare-icon.png";

const Terms = () => {
  return (
    <>
      <Helmet>
        <title>Terms of Service | Docspeare</title>
        <meta name="description" content="Read the terms and conditions for using Docspeare's documentation platform." />
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
          <h1 className="text-4xl font-bold text-foreground mb-8">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using Docspeare ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                Docspeare is a documentation platform that allows you to organize, manage, and publish documentation from your Google Workspace. We provide tools to sync, structure, and share your documents with your team and the public. Key features include:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
                <li>Google Drive integration for document storage and synchronization</li>
                <li>Documentation organization with projects, topics, and pages</li>
                <li>Role-based access control and permissions management</li>
                <li>Publishing capabilities for internal and external documentation</li>
                <li>AI-powered documentation assistance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">3. User Accounts</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>You must provide accurate and complete information when creating an account</li>
                <li>You must authenticate using your Google Workspace account</li>
                <li>You are responsible for maintaining the security of your account credentials</li>
                <li>You must notify us immediately of any unauthorized access to your account</li>
                <li>You may not use another person's account without permission</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">4. Google Drive Integration</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The Service requires integration with Google Drive to function. By using the Service, you authorize Docspeare to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Access Google Drive files and folders you explicitly select</li>
                <li>Read and import content from Google Docs</li>
                <li>Create folders and documents in your Google Drive</li>
                <li>Manage file permissions for collaborative access</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                You can revoke this access at any time through your Google Account settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">5. Acceptable Use</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">You agree not to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Use the Service for any illegal purpose or in violation of any laws</li>
                <li>Upload or transmit viruses, malware, or other malicious code</li>
                <li>Attempt to gain unauthorized access to the Service or its systems</li>
                <li>Interfere with or disrupt the integrity of the Service</li>
                <li>Harvest or collect user information without consent</li>
                <li>Use the Service to send spam or unsolicited communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">6. Content and Intellectual Property</h2>
              <h3 className="text-xl font-medium text-foreground mb-3">6.1 Your Content</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You retain ownership of all content you create or upload to the Service. By using the Service, you grant us a limited license to store, display, and process your content solely to provide the Service.
              </p>
              
              <h3 className="text-xl font-medium text-foreground mb-3">6.2 Our Content</h3>
              <p className="text-muted-foreground leading-relaxed">
                The Service and its original content, features, and functionality are owned by Docspeare and are protected by international copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">7. Third-Party Integrations</h2>
              <p className="text-muted-foreground leading-relaxed">
                The Service integrates with third-party services, including Google Workspace. Your use of these integrations is subject to the respective third-party terms and privacy policies. We are not responsible for the content or practices of any third-party services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">8. Roles and Permissions</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The Service implements role-based access control:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Owner:</strong> Full administrative access, manages workspace settings and Drive integration</li>
                <li><strong>Admin:</strong> Can manage projects, members, and all content</li>
                <li><strong>Editor:</strong> Can create and modify documentation content</li>
                <li><strong>Reviewer:</strong> Can comment on and review documentation</li>
                <li><strong>Viewer:</strong> Read-only access to authorized documentation</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">9. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including breach of these Terms. Upon termination, your right to use the Service will immediately cease.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">10. Disclaimer of Warranties</h2>
              <p className="text-muted-foreground leading-relaxed">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">11. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                IN NO EVENT SHALL DOCSPEARE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">12. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these Terms at any time. We will provide notice of material changes by posting the updated Terms on the Service. Your continued use of the Service after changes constitute acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">13. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms, please contact us at{" "}
                <a href="mailto:legal@docspeare.com" className="text-primary hover:underline">
                  legal@docspeare.com
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

export default Terms;
