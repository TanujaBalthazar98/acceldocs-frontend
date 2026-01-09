import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import acceldataLogo from "@/assets/acceldata-logo.svg";

const Terms = () => {
  return (
    <>
      <Helmet>
        <title>Terms of Service | Acceldocs</title>
        <meta name="description" content="Read the terms and conditions for using Acceldocs documentation platform." />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card/50">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link to="/auth" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-white p-1">
                  <img src={acceldataLogo} alt="Acceldocs" className="w-full h-full object-contain" />
                </div>
                <span className="text-xl font-semibold text-foreground">Acceldocs</span>
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
                By accessing or using Acceldocs ("the Service"), you agree to be bound by these Terms of Service. This Service is exclusively for authorized Acceldata employees with @acceldata.io email addresses. If you do not agree to these terms or are not an authorized user, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                Acceldocs is an internal documentation platform that allows Acceldata employees to organize, manage, and publish documentation. The Service integrates with Google Workspace to sync, structure, and share documents with team members. Key features include:
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
              <h2 className="text-2xl font-semibold text-foreground mb-4">3. User Accounts and Access</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Access is restricted to users with valid @acceldata.io email addresses</li>
                <li>You must authenticate using your Acceldata Google Workspace account</li>
                <li>You are responsible for maintaining the security of your account</li>
                <li>You must notify administrators immediately of any unauthorized access</li>
                <li>Your access level is determined by your assigned role within the organization</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">4. Google Drive Integration</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The Service requires integration with Google Drive to function. By using the Service, you authorize Acceldocs to:
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
              <p className="text-muted-foreground leading-relaxed mb-4">You agree to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Use the Service only for legitimate Acceldata business purposes</li>
                <li>Comply with all applicable Acceldata policies and guidelines</li>
                <li>Maintain confidentiality of sensitive or proprietary information</li>
                <li>Not share access credentials or attempt to access unauthorized content</li>
                <li>Not upload malicious content or attempt to compromise the Service</li>
                <li>Respect intellectual property rights and content ownership</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">6. Content Ownership</h2>
              <h3 className="text-xl font-medium text-foreground mb-3">6.1 Your Content</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Documentation created using the Service is owned by Acceldata Inc. By using the Service, you grant Acceldata the right to store, display, and process content to provide the Service.
              </p>
              
              <h3 className="text-xl font-medium text-foreground mb-3">6.2 Service Content</h3>
              <p className="text-muted-foreground leading-relaxed">
                The Service and its original features, functionality, and design are owned by Acceldata Inc. and are protected by intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">7. Roles and Permissions</h2>
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
              <h2 className="text-2xl font-semibold text-foreground mb-4">8. Service Availability</h2>
              <p className="text-muted-foreground leading-relaxed">
                We strive to maintain high availability but do not guarantee uninterrupted access. The Service may be temporarily unavailable for maintenance, updates, or due to circumstances beyond our control.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">9. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your access to the Service may be terminated if you leave Acceldata, violate these Terms, or at the discretion of administrators. Upon termination, your access will be revoked but content you contributed may be retained.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">10. Disclaimer of Warranties</h2>
              <p className="text-muted-foreground leading-relaxed">
                THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. ACCELDATA DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">11. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may modify these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">12. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms, please contact us at{" "}
                <a href="mailto:acceldocs@acceldata.io" className="text-primary hover:underline">
                  acceldocs@acceldata.io
                </a>
              </p>
            </section>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-8">
          <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
            © 2025 Acceldata Inc. All rights reserved.
          </div>
        </footer>
      </div>
    </>
  );
};

export default Terms;
