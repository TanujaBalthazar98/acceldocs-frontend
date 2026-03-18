import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  BookOpen,
  FolderOpen,
  FileText,
  Users,
  Globe,
  Search,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Shield,
  Layers,
  Share2,
  RefreshCw,
  Eye,
  Palette,
  Upload,
  ClipboardCheck,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import docspeareLogo from "@/assets/docspeare-logo.png";

interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

const Help = () => {
  const [activeSection, setActiveSection] = useState("getting-started");

  const sections: DocSection[] = [
    {
      id: "getting-started",
      title: "Getting Started",
      icon: BookOpen,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Welcome to Docspeare</h2>
            <p className="text-muted-foreground mb-4">
              Docspeare turns the documents you already keep in Google Drive into structured, publishable
              documentation. You keep using Google Docs as your editor, while Docspeare organizes, syncs,
              and publishes content with a review workflow built in.
            </p>
          </div>

          <div className="bg-primary/10 rounded-lg p-6 border border-primary/20">
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Why Docspeare?
            </h3>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
                <span><strong>No migration required</strong> — Keep writing in Google Docs</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
                <span><strong>Automatic workspaces</strong> — Personal emails get a private workspace; business domains share one</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
                <span><strong>Single source of truth</strong> — Content stays in Google Drive, no duplication</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
                <span><strong>Review workflow</strong> — Submit pages for review, approve or reject before publishing</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
                <span><strong>Multiple audiences</strong> — Publish docs as public, internal, or external with access controls</span>
              </li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-6 border">
            <h3 className="font-semibold text-lg mb-3">Quick Start Checklist</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-medium shrink-0">1</div>
                <div>
                  <span className="font-medium">Sign in with Google</span>
                  <p className="text-sm text-muted-foreground">Your account is used for authentication and Drive access</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-medium shrink-0">2</div>
                <div>
                  <span className="font-medium">Your workspace is created automatically</span>
                  <p className="text-sm text-muted-foreground">Business emails join a shared workspace; personal emails get a private one</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-medium shrink-0">3</div>
                <div>
                  <span className="font-medium">Connect Google Drive</span>
                  <p className="text-sm text-muted-foreground">Grant Drive permissions so Docspeare can read and organize your docs</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-medium shrink-0">4</div>
                <div>
                  <span className="font-medium">Import content</span>
                  <p className="text-sm text-muted-foreground">Import from a Google Drive folder or upload local files (.md, .docx, .pdf, etc.)</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-medium shrink-0">5</div>
                <div>
                  <span className="font-medium">Sync, review, and publish</span>
                  <p className="text-sm text-muted-foreground">Sync content from Drive, submit for review, and publish when approved</p>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Signing Up</h3>
            <p className="text-muted-foreground mb-3">
              To get started:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Go to the sign-in page and click "Sign in with Google"</li>
              <li>Grant Drive permissions when prompted</li>
              <li>You'll be taken to your dashboard automatically</li>
            </ol>
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Google sign-in is required because Docspeare integrates directly with
                Google Drive. Your documents stay in your Drive — content is read and organized with your permission.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "organizations",
      title: "Organizations",
      icon: Users,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Managing Your Workspace</h2>
            <p className="text-muted-foreground mb-4">
              Organizations (workspaces) are the top-level container for your documentation. They hold
              all your sections, pages, and team members.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">How Workspaces Are Created</h3>
            <p className="text-muted-foreground mb-3">
              Workspaces are created automatically based on your email:
            </p>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium">Business emails (e.g., you@company.com)</h4>
                <p className="text-sm text-muted-foreground">
                  A shared workspace is created for the domain. Everyone with an @company.com email
                  joins the same workspace automatically.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium">Personal emails (e.g., you@gmail.com)</h4>
                <p className="text-sm text-muted-foreground">
                  A private workspace is created for your account. You can invite others by email.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Workspace Roles</h3>
            <p className="text-muted-foreground mb-3">
              Members can have different roles:
            </p>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Owner</h4>
                <p className="text-sm text-muted-foreground">
                  Full control. Can manage settings, members, hierarchy mode, and custom domain.
                  Each workspace has one owner.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Admin</h4>
                <p className="text-sm text-muted-foreground">
                  Can manage members, invite new users, configure hierarchy mode, and manage all content.
                  Cannot transfer ownership.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Editor</h4>
                <p className="text-sm text-muted-foreground">
                  Can create and edit sections and pages, sync content from Drive, and submit pages for review.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Reviewer</h4>
                <p className="text-sm text-muted-foreground">
                  Can approve or reject pages submitted for review. This role is key to the approval workflow.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Viewer</h4>
                <p className="text-sm text-muted-foreground">
                  Read-only access to internal documentation and the dashboard.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Inviting Team Members</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Open the dashboard sidebar and click "Invite members"</li>
              <li>Enter the email address of the person you want to invite</li>
              <li>Select their role (Admin, Editor, Reviewer, or Viewer)</li>
              <li>Click "Send Invitation"</li>
            </ol>
            <p className="text-sm text-muted-foreground mt-3">
              Invitations expire after 7 days. The invited person will receive an email with a link to sign in
              and join your workspace. Their Google Drive permissions are automatically synced when they accept.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Switching Workspaces</h3>
            <p className="text-muted-foreground">
              If you belong to multiple workspaces, use the workspace switcher at the top of the
              dashboard sidebar to switch between them.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Workspace Settings</h3>
            <p className="text-muted-foreground mb-3">
              Owners and admins can access workspace settings from the sidebar:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Workspace name:</strong> Change the display name of your workspace</li>
              <li><strong>Custom docs domain:</strong> Set a custom domain for your published documentation (e.g., docs.yourcompany.com)</li>
              <li><strong>Hierarchy mode:</strong> Choose between "Product" mode (for versioned product docs) or "Flat" mode (simple sections)</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: "sections-pages",
      title: "Sections & Pages",
      icon: FolderOpen,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Sections & Pages</h2>
            <p className="text-muted-foreground mb-4">
              Sections organize your documentation into a tree structure. Pages are individual
              documentation articles backed by Google Docs.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Hierarchy Modes</h3>
            <p className="text-muted-foreground mb-3">
              Docspeare supports two hierarchy modes, configurable by workspace owners and admins:
            </p>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Product Mode</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Designed for versioned product documentation. The hierarchy is:
                </p>
                <div className="font-mono text-sm space-y-1 ml-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FolderOpen className="h-4 w-4" />
                    <span>Product (top-level section)</span>
                  </div>
                  <div className="ml-6 flex items-center gap-2 text-muted-foreground">
                    <Layers className="h-4 w-4" />
                    <span>Version (optional, e.g., "v2.0")</span>
                  </div>
                  <div className="ml-12 flex items-center gap-2 text-muted-foreground">
                    <Layers className="h-4 w-4 opacity-70" />
                    <span>Tab (navigation group)</span>
                  </div>
                  <div className="ml-12 pl-6 flex items-center gap-2 text-muted-foreground">
                    <FolderOpen className="h-4 w-4 opacity-70" />
                    <span>Section</span>
                  </div>
                  <div className="ml-12 pl-12 flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>Page</span>
                  </div>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Flat Mode</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Simple, flexible structure without product or version grouping:
                </p>
                <div className="font-mono text-sm space-y-1 ml-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FolderOpen className="h-4 w-4" />
                    <span>Section (optionally promoted to Tab)</span>
                  </div>
                  <div className="ml-6 flex items-center gap-2 text-muted-foreground">
                    <FolderOpen className="h-4 w-4 opacity-70" />
                    <span>Sub-section</span>
                  </div>
                  <div className="ml-12 flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>Page</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Creating Sections</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Click the folder icon in the sidebar to create a new section</li>
              <li>Enter a section name</li>
              <li>The section appears in the sidebar tree</li>
            </ol>
            <p className="text-sm text-muted-foreground mt-3">
              Sections can be nested. Use the three-dot menu on any section to add sub-sections,
              rename, move, change type (section/tab), set visibility, or delete.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Creating Pages</h3>
            <p className="text-muted-foreground mb-3">
              Pages are backed by Google Docs. You can create them in two ways:
            </p>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium">New blank page</h4>
                <p className="text-sm text-muted-foreground">
                  Click the "+" icon in the sidebar or use "Add page" from a section's menu.
                  Enter a title and a new Google Doc is automatically created in your Drive.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium">Link an existing Google Doc</h4>
                <p className="text-sm text-muted-foreground">
                  When creating a page, paste a Google Doc URL or ID to link an existing document
                  instead of creating a new one.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Page Actions</h3>
            <p className="text-muted-foreground mb-3">
              Use the three-dot menu on any page for these actions:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Open in Google Docs:</strong> Edit the source document directly in Google Docs</li>
              <li><strong>Edit Title:</strong> Rename the page (also renames the Google Doc in Drive)</li>
              <li><strong>Edit URL slug:</strong> Customize the page URL path</li>
              <li><strong>Move:</strong> Move the page to a different section</li>
              <li><strong>Set visibility:</strong> Override the section's visibility for this page</li>
              <li><strong>Duplicate:</strong> Create a copy of the page and its Google Doc</li>
              <li><strong>Delete:</strong> Remove the page and trash the Drive doc</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Section Visibility</h3>
            <p className="text-muted-foreground mb-3">
              Each section has a visibility setting that determines who can access its published pages:
            </p>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-green-500" />
                  <h4 className="font-medium">Public</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Visible to everyone without authentication. Best for public-facing docs.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-orange-500" />
                  <h4 className="font-medium">Internal</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Only visible to authenticated members of your workspace.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-blue-500" />
                  <h4 className="font-medium">External</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Visible to authenticated users with explicit access grants. Use this for partner
                  or customer documentation.
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Individual pages can override their section's visibility using the "Set visibility" option.
            </p>
          </div>
        </div>
      )
    },
    {
      id: "importing",
      title: "Importing Content",
      icon: Upload,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Importing Content</h2>
            <p className="text-muted-foreground mb-4">
              Docspeare supports importing content from Google Drive folders or from local files on your computer.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Import from Google Drive</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Click the "Import content" button in the sidebar</li>
              <li>Select "From Drive" as the source</li>
              <li>Paste a Google Drive folder URL or folder ID</li>
              <li>Choose a destination section (or import to the workspace root)</li>
              <li>Click "Import"</li>
            </ol>
            <p className="text-sm text-muted-foreground mt-3">
              Docspeare scans the folder recursively: subfolders become sections, and Google Docs become pages.
              The folder structure from Drive is preserved.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Import from Local Files</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Click the "Import content" button in the sidebar</li>
              <li>Select "From local files" as the source</li>
              <li>Select files or a folder from your computer</li>
              <li>Choose a destination section</li>
              <li>Click "Import"</li>
            </ol>
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Supported file formats:</strong>
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Markdown (.md)</li>
                <li>Plain text (.txt)</li>
                <li>HTML (.html, .htm)</li>
                <li>Word documents (.doc, .docx)</li>
                <li>PDF (.pdf)</li>
                <li>Rich text (.rtf)</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">
                Maximum file size: 20 MB per file. Files are uploaded to your Google Drive first,
                then imported into Docspeare.
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">After Importing</h3>
            <p className="text-muted-foreground mb-3">
              After import, pages are created but their HTML content is not yet pulled from Drive.
              To fetch the content:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Click "Sync all pages" in the Drive panel to bulk sync everything</li>
              <li>Or click "Sync" on individual pages to sync them one at a time</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: "syncing",
      title: "Syncing Content",
      icon: RefreshCw,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Syncing Content from Drive</h2>
            <p className="text-muted-foreground mb-4">
              Syncing pulls the latest content from your Google Docs into Docspeare.
              Sync is manual — you control when content is updated.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">How Syncing Works</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>You edit content in Google Docs as usual</li>
              <li>When ready, click "Sync" on a page (or "Sync all pages" in the Drive panel)</li>
              <li>Docspeare fetches the latest HTML from the Google Doc</li>
              <li>The page preview updates with the new content</li>
            </ol>
            <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground">
                <strong>Important:</strong> Syncing updates the draft content. If a page is already published,
                syncing new content will show a "Changes pending" status — the published version remains
                unchanged until you go through the review and publish workflow again.
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Sync Methods</h3>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium">Per-page sync</h4>
                <p className="text-sm text-muted-foreground">
                  Select a page in the dashboard and click the "Sync" button in the toolbar.
                  This fetches the latest version of that specific Google Doc.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium">Bulk sync</h4>
                <p className="text-sm text-muted-foreground">
                  Click "Sync all pages" in the Drive panel (sidebar). This syncs every page in your
                  workspace, skipping pages that haven't changed in Drive since the last sync.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Connecting Google Drive</h3>
            <p className="text-muted-foreground mb-3">
              The Drive panel in the sidebar shows your connection status:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Connected:</strong> Shows your root Drive folder with a link to open it</li>
              <li><strong>Not connected:</strong> Click "Connect Drive" to authorize Google Drive access</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-3">
              Drive connection is per-workspace. The root folder is where Docspeare creates new
              documents and organizes imported content.
            </p>
          </div>
        </div>
      )
    },
    {
      id: "publishing",
      title: "Publishing & Review",
      icon: ClipboardCheck,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Publishing & Review Workflow</h2>
            <p className="text-muted-foreground mb-4">
              Docspeare uses a review workflow to ensure documentation quality before publishing.
              Pages go through draft, review, and published states.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Page Status Lifecycle</h3>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Draft</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Initial state. Content is being written or edited. Only visible in the dashboard.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <Search className="h-4 w-4 text-yellow-500" />
                  <h4 className="font-medium">In Review</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Submitted for review. A reviewer, admin, or owner can approve or reject the page.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-green-500" />
                  <h4 className="font-medium">Published</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Approved and live. The published HTML is served to readers based on visibility settings.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw className="h-4 w-4 text-blue-500" />
                  <h4 className="font-medium">Changes Pending</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  A published page whose draft content has been updated via sync. The published version
                  remains live until a new version is approved.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">The Review Workflow</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Edit your content in Google Docs</li>
              <li>Click "Sync" to pull the latest content into Docspeare</li>
              <li>Click "Submit for review" to send the page for approval</li>
              <li>A reviewer sees the page in the Approvals panel</li>
              <li>The reviewer can <strong>Approve</strong> (publishes the page) or <strong>Reject</strong> (returns to draft)</li>
            </ol>
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                <strong>Requirements:</strong> A page must have synced content and be in a section
                before it can be submitted for review.
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Approvals Panel</h3>
            <p className="text-muted-foreground mb-3">
              Switch to the Approvals view in the dashboard sidebar to see:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Pages currently awaiting review</li>
              <li>Submission history</li>
              <li>A badge count showing pending reviews (refreshes automatically)</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Published Documentation URLs</h3>
            <p className="text-muted-foreground mb-3">
              Published pages are accessible at these URLs:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 border font-mono text-sm space-y-1">
              <p className="text-muted-foreground">/docs/your-org — Public docs landing page</p>
              <p className="text-muted-foreground">/docs/your-org/p/page-id/page-slug — Public page</p>
              <p className="text-muted-foreground">/internal-docs/your-org/... — Internal pages</p>
              <p className="text-muted-foreground">/external-docs/your-org/... — External pages</p>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Use the "Copy link" button on any published page to get its shareable URL. If you set a
              custom docs domain, published pages are served from that domain instead.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Unpublishing</h3>
            <p className="text-muted-foreground">
              Use the "Unpublish" action to revert a published page to draft. The page will no longer
              be visible to readers. You can re-publish it later through the review workflow.
            </p>
          </div>
        </div>
      )
    },
    {
      id: "collaboration",
      title: "Collaboration",
      icon: Share2,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Collaboration</h2>
            <p className="text-muted-foreground mb-4">
              Work together with your team to create and maintain documentation. Docspeare
              leverages Google Docs' collaboration features while adding structured review workflows.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Google Docs Collaboration</h3>
            <p className="text-muted-foreground mb-3">
              Since content lives in Google Docs, you get all of Google's collaboration features:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Real-time collaborative editing</li>
              <li>Comments and suggestions</li>
              <li>Version history and restore</li>
              <li>Sharing with specific people</li>
            </ul>
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                <strong>Tip:</strong> Use Google Docs' suggesting mode for review workflows.
                Reviewers can suggest changes, and authors can accept or reject them before syncing.
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Team Invitations</h3>
            <p className="text-muted-foreground mb-3">
              Invite team members from the dashboard sidebar:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Click "Invite members" in the Account section of the sidebar</li>
              <li>Enter their email address</li>
              <li>Assign a role (Admin, Editor, Reviewer, or Viewer)</li>
              <li>They receive an email invitation valid for 7 days</li>
            </ol>
            <p className="text-sm text-muted-foreground mt-3">
              When a member accepts the invitation, their Google Drive permissions are automatically
              synced so they can access shared documents.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">External Access</h3>
            <p className="text-muted-foreground mb-3">
              For documentation marked as "External" visibility, you can grant access to specific
              people outside your organization:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Click "External access" in the sidebar</li>
              <li>Add email addresses of people who should have access</li>
              <li>They can view external documentation after signing in</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Drive Permissions</h3>
            <p className="text-muted-foreground">
              Docspeare automatically manages Google Drive sharing when you invite or remove members.
              When a member's role changes, their Drive access is updated to match. When a member
              is removed from the workspace, their Drive access is revoked.
            </p>
          </div>
        </div>
      )
    },
    {
      id: "analytics",
      title: "Analytics",
      icon: BarChart3,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Analytics</h2>
            <p className="text-muted-foreground mb-4">
              The Analytics view in the dashboard gives you an overview of your documentation health and coverage.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Accessing Analytics</h3>
            <p className="text-muted-foreground">
              Switch to the Analytics view using the view switcher in the dashboard sidebar
              (the bar chart icon).
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Documentation Impact Metrics</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-sm">Reader Coverage</h4>
                <p className="text-xs text-muted-foreground">Published pages vs. total pages, with percentage live</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-sm">Audience Reach</h4>
                <p className="text-xs text-muted-foreground">Count of public and external published pages</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-sm">Freshness</h4>
                <p className="text-xs text-muted-foreground">Pages updated in the last 30 days</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-sm">Publish Backlog</h4>
                <p className="text-xs text-muted-foreground">Draft count and stale drafts older than 14 days</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-sm">Internal Live Docs</h4>
                <p className="text-xs text-muted-foreground">Count of internal published pages</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-sm">Stale Live Docs</h4>
                <p className="text-xs text-muted-foreground">Published pages not updated in 30 days</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-sm">Sync Lag</h4>
                <p className="text-xs text-muted-foreground">Published pages with Drive changes not yet synced</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-sm">Activity</h4>
                <p className="text-xs text-muted-foreground">Pages updated and synced in the last 7 days</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Recently Updated Pages</h3>
            <p className="text-muted-foreground">
              The Analytics view also shows the 5 most recently updated pages, helping you
              quickly find and review recent changes.
            </p>
          </div>
        </div>
      )
    },
    {
      id: "visibility",
      title: "Visibility & Access",
      icon: Globe,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Visibility & Access Control</h2>
            <p className="text-muted-foreground mb-4">
              Docspeare gives you fine-grained control over who can see your published documentation.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Three Visibility Levels</h3>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-green-500" />
                  <h4 className="font-medium">Public</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Anyone can view without logging in. Ideal for open-source docs, help centers,
                  and API references.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-orange-500" />
                  <h4 className="font-medium">Internal</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Only workspace members can view. Perfect for team wikis, internal processes,
                  and confidential documentation.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-blue-500" />
                  <h4 className="font-medium">External</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Only users with an explicit access grant can view. Use for partner docs,
                  customer-specific documentation, or gated content.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Where Visibility Is Set</h3>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Section level:</strong> Set via the section's three-dot menu. All pages in the section inherit this visibility.</li>
              <li><strong>Page level:</strong> Individual pages can override their section's visibility using "Set visibility" in the page menu.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">External Access Grants</h3>
            <p className="text-muted-foreground mb-3">
              To give someone outside your workspace access to external docs:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Open "External access" from the dashboard sidebar</li>
              <li>Add the email addresses of people who need access</li>
              <li>They sign in with Google and can view external documentation</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Documentation Landing Pages</h3>
            <p className="text-muted-foreground mb-3">
              Each visibility level has its own landing page showing available sections:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 border font-mono text-sm space-y-1">
              <p className="text-muted-foreground">/docs/your-org — Public landing</p>
              <p className="text-muted-foreground">/internal-docs/your-org — Internal landing</p>
              <p className="text-muted-foreground">/external-docs/your-org — External landing</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Quick Doc Links</h3>
            <p className="text-muted-foreground">
              The dashboard sidebar has quick links to open your published docs in a new tab —
              one for each visibility level (Public, Internal, External). These links only appear
              when you have published pages at that visibility level.
            </p>
          </div>
        </div>
      )
    },
  ];

  return (
    <>
      <Helmet>
        <title>Documentation | Docspeare</title>
        <meta name="description" content="Learn how to use Docspeare to organize and publish documentation from Google Drive." />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <img src={docspeareLogo} alt="Docspeare" className="h-6" />
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">Documentation</span>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth">Get Started</Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex">
          {/* Sidebar */}
          <aside className="w-64 border-r bg-muted/30 hidden md:block">
            <ScrollArea className="h-[calc(100vh-3.5rem)]">
              <nav className="p-4 space-y-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {section.title}
                    </button>
                  );
                })}
              </nav>
            </ScrollArea>
          </aside>

          {/* Mobile Navigation */}
          <div className="md:hidden border-b p-4">
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    {(() => {
                      const currentSection = sections.find(s => s.id === activeSection);
                      const Icon = currentSection?.icon || BookOpen;
                      return (
                        <>
                          <Icon className="h-4 w-4" />
                          {currentSection?.title || "Navigation"}
                        </>
                      );
                    })()}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                        activeSection === section.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {section.title}
                    </button>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <ScrollArea className="h-[calc(100vh-3.5rem)]">
              <div className="container max-w-3xl py-6 md:py-8 px-4 md:px-6">
                {sections.find(s => s.id === activeSection)?.content}

                {/* Navigation Footer */}
                <div className="mt-12 pt-8 border-t flex justify-between items-center">
                  {(() => {
                    const currentIndex = sections.findIndex(s => s.id === activeSection);
                    const prevSection = sections[currentIndex - 1];
                    const nextSection = sections[currentIndex + 1];
                    return (
                      <>
                        {prevSection ? (
                          <Button
                            variant="ghost"
                            onClick={() => setActiveSection(prevSection.id)}
                            className="flex items-center gap-2"
                          >
                            <ChevronRight className="h-4 w-4 rotate-180" />
                            {prevSection.title}
                          </Button>
                        ) : <div />}
                        {nextSection && (
                          <Button
                            variant="ghost"
                            onClick={() => setActiveSection(nextSection.id)}
                            className="flex items-center gap-2"
                          >
                            {nextSection.title}
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </ScrollArea>
          </main>
        </div>
      </div>
    </>
  );
};

export default Help;
