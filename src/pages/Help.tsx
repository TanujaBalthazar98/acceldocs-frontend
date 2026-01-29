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
  Settings,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Shield,
  Layers,
  Share2,
  Link2,
  Upload,
  RefreshCw,
  Eye,
  Bot,
  Palette
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
            <h2 className="text-2xl font-bold text-foreground mb-4">Welcome to your knowledge workspace</h2>
            <p className="text-muted-foreground mb-4">
              This workspace turns the documents you already keep in Google Drive into structured, publishable
              knowledge. You keep using Google Docs as your editor, while the workspace organizes, structures,
              and publishes content without duplicating files.
            </p>
          </div>

          <div className="bg-primary/10 rounded-lg p-6 border border-primary/20">
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Why this approach?
            </h3>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
                <span><strong>No migration required</strong> — Keep using Google Docs as your editor</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
                <span><strong>Personal or team workspaces</strong> — Personal emails get a private workspace; business domains can share one</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
                <span><strong>Single source of truth</strong> — Content stays in Google Drive, no duplication</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
                <span><strong>Automatic sync</strong> — Changes in Google Docs reflect in your documentation</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
                <span><strong>Publish confidently</strong> — Transform docs into organized, shareable knowledge</span>
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
                  <p className="text-sm text-muted-foreground">Your account grants Drive access for reading and creating folders</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-medium shrink-0">2</div>
                <div>
                  <span className="font-medium">Create or join a workspace</span>
                  <p className="text-sm text-muted-foreground">Personal emails create a private workspace; business domains can request access</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-medium shrink-0">3</div>
                <div>
                  <span className="font-medium">Set your Drive root folder</span>
                  <p className="text-sm text-muted-foreground">Choose the Drive folder that will store all projects</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-medium shrink-0">4</div>
                <div>
                  <span className="font-medium">Create or import your first project</span>
                  <p className="text-sm text-muted-foreground">Import folders or start empty and add pages</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-medium shrink-0">5</div>
                <div>
                  <span className="font-medium">Organize topics and publish</span>
                  <p className="text-sm text-muted-foreground">Topics map to folders; pages map to Google Docs</p>
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
              <li>Sign in with your Google account (required for Drive integration)</li>
              <li>Grant Drive permissions when prompted</li>
              <li>If you use a personal email, a private workspace is created for you</li>
              <li>If you use a business domain, request access or get invited to the workspace</li>
            </ol>
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Google sign-in is required because the workspace integrates directly with
                Google Drive. Your documents never leave Google—content is read and organized with your permission.
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
            <h2 className="text-2xl font-bold text-foreground mb-4">Managing Organizations</h2>
            <p className="text-muted-foreground mb-4">
              Organizations are the top-level workspace for all your documentation. They represent 
              your company, team, or group and contain all projects, members, and branding settings.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Creating a Workspace</h3>
            <p className="text-muted-foreground mb-3">
              Workspaces are created automatically based on your email:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Personal emails create a private workspace tied to your account</li>
              <li>Business domains map to a shared workspace for that domain</li>
              <li>Set the workspace name, logo, and brand colors in Settings</li>
              <li>Invite teammates once the workspace is created</li>
            </ol>
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                <strong>Tip:</strong> A workspace slug or custom domain can be used to create clean URLs
                when you publish documentation.
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Organization Roles</h3>
            <p className="text-muted-foreground mb-3">
              Members can have different roles within an organization:
            </p>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Owner</h4>
                <p className="text-sm text-muted-foreground">
                  Full control over the organization. Can manage billing, delete the organization, 
                  transfer ownership, and perform all admin actions. Each organization has one owner.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Admin</h4>
                <p className="text-sm text-muted-foreground">
                  Can manage projects, invite/remove members, configure branding and settings, 
                  and approve join requests. Cannot delete the organization or transfer ownership.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Editor</h4>
                <p className="text-sm text-muted-foreground">
                  Can create and edit projects, topics, and pages. Can publish content and manage 
                  documentation structure. Cannot manage organization settings or members.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Viewer</h4>
                <p className="text-sm text-muted-foreground">
                  Read-only access to internal documentation. Can view all projects and pages 
                  within the organization but cannot make changes.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Inviting Team Members</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Go to the Dashboard and click your organization name</li>
              <li>Navigate to Settings → Team</li>
              <li>Click "Invite Member"</li>
              <li>Enter the email address of the person you want to invite</li>
              <li>Select their role (Admin, Editor, or Viewer)</li>
              <li>Click "Send Invitation"</li>
            </ol>
            <p className="text-sm text-muted-foreground mt-3">
              Invitations expire after 7 days. You can resend or revoke invitations from the Team settings page.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Join Requests</h3>
            <p className="text-muted-foreground mb-3">
              Users with email addresses matching your organization's domain can request to join:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Users see a "Request to Join" option when their email domain matches</li>
              <li>Admins and owners receive notifications of pending requests</li>
              <li>Review requests in Settings → Join Requests</li>
              <li>Approve to add the user, or reject with an optional reason</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Switching Organizations</h3>
            <p className="text-muted-foreground">
              If you're a member of multiple organizations, use the workspace switcher in the 
              dashboard sidebar to switch between them. Your role and permissions may differ 
              across organizations.
            </p>
          </div>
        </div>
      )
    },
    {
      id: "projects",
      title: "Projects",
      icon: FolderOpen,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Working with Projects</h2>
            <p className="text-muted-foreground mb-4">
              Projects are collections of documentation organized around a specific product, service, 
              or topic. Each project is connected to a Google Drive folder and contains topics and pages.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Creating a Project</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>From the dashboard sidebar, click "Add Project"</li>
              <li>Enter a project name (e.g., "API Documentation")</li>
              <li>Optionally add a description</li>
              <li>Select a Google Drive folder to connect (or create a new one)</li>
              <li>Set the visibility level</li>
              <li>Click "Create Project"</li>
            </ol>
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                <strong>Important:</strong> The connected Drive folder becomes the home for all Google Docs 
                in this project. Topics will create subfolders, and pages will create Google Docs within them.
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Connecting Google Drive</h3>
            <p className="text-muted-foreground mb-3">
              When you create or edit a project, you can connect it to a Google Drive folder:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 border space-y-3">
              <div className="flex items-start gap-3">
                <FolderOpen className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">Select Existing Folder</h4>
                  <p className="text-sm text-muted-foreground">
                    Choose a folder from your Google Drive that already contains documentation
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FolderOpen className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">Create New Folder</h4>
                  <p className="text-sm text-muted-foreground">
                    Docspeare can create a new folder in your Drive for this project
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Project Visibility Levels</h3>
            <p className="text-muted-foreground mb-3">
              Visibility determines who can access your documentation:
            </p>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-orange-500" />
                  <h4 className="font-medium">Internal</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Only visible to authenticated members of your organization. Perfect for internal 
                  processes, team wikis, and sensitive documentation.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-blue-500" />
                  <h4 className="font-medium">External</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Visible to authenticated users outside your organization. Ideal for partner 
                  documentation, customer portals, or documentation requiring login.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-green-500" />
                  <h4 className="font-medium">Public</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Visible to everyone without authentication. Indexed by search engines. 
                  Best for public-facing documentation, API docs, and help centers.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Project Settings</h3>
            <p className="text-muted-foreground mb-3">
              Access project settings by clicking the settings icon on a project:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>General:</strong> Update name, description, visibility, and Drive folder connection</li>
              <li><strong>SEO:</strong> Configure indexing, robots.txt, and LLM crawler settings</li>
              <li><strong>API:</strong> Add OpenAPI specifications to generate API documentation</li>
              <li><strong>MCP:</strong> Enable Model Context Protocol for AI tool integration</li>
              <li><strong>Sharing:</strong> Invite specific users to collaborate on the project</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Project-Level Sharing</h3>
            <p className="text-muted-foreground mb-3">
              In addition to organization roles, you can grant access to specific projects:
            </p>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Admin</h4>
                <p className="text-sm text-muted-foreground">Full control over project settings, content, and team</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Editor</h4>
                <p className="text-sm text-muted-foreground">Can create, edit, and publish topics and pages</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Reviewer</h4>
                <p className="text-sm text-muted-foreground">Can view content and provide feedback, but cannot edit</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Viewer</h4>
                <p className="text-sm text-muted-foreground">Read-only access to project content</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "topics-pages",
      title: "Topics & Pages",
      icon: FileText,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Topics & Pages</h2>
            <p className="text-muted-foreground mb-4">
              Topics are folders that organize related pages within a project. Pages are 
              individual documentation articles powered by Google Docs.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 border">
            <h4 className="font-medium mb-2">Content Hierarchy</h4>
            <div className="font-mono text-sm space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Organization</span>
              </div>
              <div className="ml-6 flex items-center gap-2 text-muted-foreground">
                <FolderOpen className="h-4 w-4" />
                <span>Project (linked to Drive folder)</span>
              </div>
              <div className="ml-12 flex items-center gap-2 text-muted-foreground">
                <Layers className="h-4 w-4" />
                <span>Topic (Drive subfolder)</span>
              </div>
              <div className="ml-12 pl-6 flex items-center gap-2 text-muted-foreground">
                <Layers className="h-4 w-4 opacity-50" />
                <span className="opacity-70">Subtopic (nested subfolder)</span>
              </div>
              <div className="ml-12 pl-12 flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>Page (Google Doc)</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Creating Topics</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Select a project from the sidebar</li>
              <li>Click "Add Topic" in the topics panel</li>
              <li>Enter a topic name</li>
              <li>Click "Create" to add the topic</li>
            </ol>
            <p className="text-sm text-muted-foreground mt-3">
              When you create a topic, Docspeare creates a corresponding subfolder in your connected 
              Google Drive folder. Topics can be nested to create hierarchies.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Creating Pages</h3>
            <p className="text-muted-foreground mb-3">
              Pages are the core documentation content, powered by Google Docs:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Navigate to a topic (or project for top-level pages)</li>
              <li>Click "Add Page"</li>
              <li>Enter a page title</li>
              <li>A new Google Doc is created and linked to this page</li>
              <li>Click "Open in Google Docs" to edit the content</li>
            </ol>
            <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground">
                <strong>Key concept:</strong> All editing happens in Google Docs. Docspeare reads 
                the content and displays it beautifully in your documentation portal. Changes in 
                Google Docs sync automatically when you view the page.
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Importing Content</h3>
            <p className="text-muted-foreground mb-3">
              You can import existing content into Docspeare:
            </p>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <Upload className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Import Markdown</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload Markdown files (.md) to create new pages. The content is converted to 
                  a Google Doc and linked to the page. Supports frontmatter for title extraction.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Import from Drive</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Link existing Google Docs from your Drive to create pages without uploading files.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Editing Content</h3>
            <p className="text-muted-foreground mb-3">
              Docspeare uses Google Docs as the editor:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Click on a page in the dashboard to open the preview</li>
              <li>Click "Open in Google Docs" to edit the source document</li>
              <li>Make your changes in Google Docs (formatting, images, tables, etc.)</li>
              <li>Return to Docspeare—changes sync automatically when viewing</li>
            </ol>
            <p className="text-sm text-muted-foreground mt-3">
              Supported Google Docs features include: headings, bold/italic text, lists, tables, 
              images, links, code blocks, and more.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Content Syncing</h3>
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                <h4 className="font-medium">Automatic Sync</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Content syncs automatically when you view a page in the documentation viewer. 
                The latest version from Google Docs is fetched and displayed.
              </p>
              <p className="text-sm text-muted-foreground">
                Previously synced content is cached, so pages load quickly and remain viewable 
                even if there are temporary connectivity issues.
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Page Settings</h3>
            <p className="text-muted-foreground mb-3">
              Configure individual page settings:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Slug:</strong> Customize the URL path for the page</li>
              <li><strong>Visibility:</strong> Inherits the project visibility (Internal, External, or Public)</li>
              <li><strong>Publish/Unpublish:</strong> Control whether the page appears in published docs</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: "publishing",
      title: "Publishing",
      icon: Globe,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Publishing Documentation</h2>
            <p className="text-muted-foreground mb-4">
              Publishing makes your documentation accessible to your intended audience. Docspeare 
              generates a beautiful, branded documentation portal from your Google Docs.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">How Publishing Works</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Configure your project's visibility (Internal, External, or Public)</li>
              <li>Add topics and pages with content in Docspeare</li>
              <li>Publish individual pages when they're ready (from the dashboard or the Google Docs add‑on)</li>
              <li>Your documentation is available at your organization's URL</li>
            </ol>
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                <strong>URL Structure:</strong> Published documentation follows the pattern 
                <code className="bg-background px-1 rounded mx-1">docspeare.io/docs/your-org/project/topic/page</code>
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Publishing a Page</h3>
            <p className="text-muted-foreground mb-3">
              You can publish from the dashboard or directly inside Google Docs.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Open the Google Doc for the page</li>
              <li>Open the Docspeare add‑on</li>
              <li>Select the target project, version, and optional topic</li>
              <li>Click <strong>Preview</strong> to verify, then <strong>Publish</strong></li>
              <li>The page becomes visible based on project visibility settings</li>
            </ol>
            <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground">
                <strong>Draft vs Published:</strong> Pages can be in draft mode while you're working on them. 
                Only published pages appear in your public documentation. Previously published content 
                remains visible even if you later unpublish a page (showing the last published version).
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Google Docs Add‑on (Token)</h3>
            <p className="text-muted-foreground mb-3">
              The add‑on uses a short‑lived token so it can load your projects and publish securely.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>In Docspeare, go to <strong>Integrations → Docs Add‑on</strong></li>
              <li>Generate a short‑lived token</li>
              <li>Paste the token into the add‑on in Google Docs</li>
              <li>Click <strong>Refresh</strong> to load projects and topics</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Documentation Landing Page</h3>
            <p className="text-muted-foreground mb-3">
              Your organization gets an auto-generated landing page for documentation:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Displays your organization branding (logo, colors, fonts)</li>
              <li>Shows a hero section with customizable title and description</li>
              <li>Lists featured projects (optional)</li>
              <li>Includes a search bar for finding content quickly</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-3">
              Customize the landing page in Settings → General under your organization settings.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Custom Documentation Domains</h3>
            <p className="text-muted-foreground mb-3">
              Serve your documentation from your own domain:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Go to Settings → General in your organization</li>
              <li>Enter your custom documentation domain (e.g., docs.yourcompany.com)</li>
              <li>Add a CNAME record pointing to Docspeare's servers</li>
              <li>Wait for DNS propagation (usually 15 minutes to 24 hours)</li>
            </ol>
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                With a custom domain, URLs simplify to 
                <code className="bg-background px-1 rounded mx-1">docs.yourcompany.com/project/page</code>
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">SEO Settings</h3>
            <p className="text-muted-foreground mb-3">
              Optimize your public documentation for search engines:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Allow Indexing:</strong> Enable search engines to discover your docs</li>
              <li><strong>Disallowed Paths:</strong> Specify paths to exclude from indexing</li>
              <li><strong>LLM Crawlers:</strong> Control which AI services can access your content</li>
              <li><strong>Allow AI Training:</strong> Opt in or out of AI training data collection</li>
              <li><strong>Allow Summarization:</strong> Control whether AI can summarize your content</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Visibility and Access Control</h3>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium">Public Projects</h4>
                <p className="text-sm text-muted-foreground">
                  Accessible to everyone. Internal metadata (last updated, visibility badges) 
                  is hidden from public viewers. No login required.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium">Internal Projects</h4>
                <p className="text-sm text-muted-foreground">
                  Only visible to authenticated organization members. Full metadata shown. 
                  Dashboard access available.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium">External Projects</h4>
                <p className="text-sm text-muted-foreground">
                  Visible to authenticated users outside your organization. Requires login 
                  but not organization membership.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "search",
      title: "Search & Navigation",
      icon: Search,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Search & Navigation</h2>
            <p className="text-muted-foreground mb-4">
              Docspeare provides powerful search and navigation to help users find information quickly.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Using Search</h3>
            <div className="bg-muted/50 rounded-lg p-4 border mb-4">
              <div className="flex items-center gap-2 text-sm">
                <kbd className="px-2 py-1 bg-background rounded border text-xs">⌘</kbd>
                <span>+</span>
                <kbd className="px-2 py-1 bg-background rounded border text-xs">K</kbd>
                <span className="text-muted-foreground ml-2">Quick access to search from anywhere</span>
              </div>
            </div>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Search works across all projects and pages you have access to</li>
              <li>Results show matching titles and content snippets</li>
              <li>Click a result to navigate directly to that page</li>
              <li>Search is available in both the dashboard and published documentation</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Ask AI</h3>
            <div className="flex items-start gap-3 bg-primary/10 rounded-lg p-4 border border-primary/20">
              <Bot className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium mb-1">AI-Powered Answers</h4>
                <p className="text-sm text-muted-foreground">
                  Use the "Ask AI" feature to get intelligent answers based on your documentation. 
                  The AI searches through your content and provides contextual answers with references 
                  to the relevant pages.
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Ask AI is available in the search dialog and helps readers find answers to complex 
              questions that span multiple pages.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Documentation Layout</h3>
            <p className="text-muted-foreground mb-3">
              The published documentation viewer follows a Stripe Docs-inspired layout:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Header:</strong> Organization logo, search bar, and navigation</li>
              <li><strong>Project Tabs:</strong> Switch between projects in the organization</li>
              <li><strong>Left Sidebar:</strong> Topics and pages navigation (collapsible)</li>
              <li><strong>Main Content:</strong> Page content with breadcrumbs and title</li>
              <li><strong>Right Sidebar:</strong> Table of contents for the current page</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Table of Contents</h3>
            <p className="text-muted-foreground mb-3">
              Each documentation page includes an auto-generated table of contents:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Extracted from headings in your Google Doc</li>
              <li>Appears in the right sidebar on desktop</li>
              <li>Click any heading to jump to that section</li>
              <li>Highlights the current section as you scroll</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Internal Linking</h3>
            <p className="text-muted-foreground mb-3">
              Create stable links between documentation pages:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="h-4 w-4 text-primary" />
                <h4 className="font-medium">Copy Link Button</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Every page has a "Copy Link" button that generates a stable, slug-based URL. 
                These URLs use SEO-friendly paths like <code className="bg-background px-1 rounded">/docs/org/project/topic/page</code>.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Redirect support:</strong> If you change a page title or move it, old URLs 
                automatically redirect to the new location, preserving any shared links.
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">URL Structure</h3>
            <p className="text-muted-foreground mb-3">
              Documentation URLs follow a consistent pattern:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 border font-mono text-sm space-y-1">
              <p className="text-muted-foreground">/docs/:org/:project — Project landing</p>
              <p className="text-muted-foreground">/docs/:org/:project/:topic — Topic view</p>
              <p className="text-muted-foreground">/docs/:org/:project/:topic/:page — Page view</p>
              <p className="text-muted-foreground">/docs/:org/:project/:page — Top-level page</p>
            </div>
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
              leverages Google Docs' collaboration features while adding structured workflows.
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
                Reviewers can suggest changes, and authors can accept or reject them.
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Project Sharing</h3>
            <p className="text-muted-foreground mb-3">
              Share projects with specific team members:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Open the project settings</li>
              <li>Go to the "Sharing" tab</li>
              <li>Click "Invite Member"</li>
              <li>Enter their email address</li>
              <li>Assign a role (Admin, Editor, Reviewer, or Viewer)</li>
              <li>They'll receive an invitation email</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Page Feedback</h3>
            <p className="text-muted-foreground mb-3">
              Readers can provide feedback on documentation pages:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Thumbs up/down to rate page helpfulness</li>
              <li>Submit detailed written feedback</li>
              <li>Feedback is collected and visible to editors in the dashboard</li>
              <li>Mark feedback as resolved when addressed</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-3">
              Use feedback to identify unclear sections, outdated information, or missing content.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Audit Logs</h3>
            <p className="text-muted-foreground mb-3">
              Track changes and activity in your organization:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>View who made changes and when</li>
              <li>Track page publishes and unpublishes</li>
              <li>Monitor member invitations and join requests</li>
              <li>Review project and topic modifications</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-3">
              Access audit logs in Settings → Audit Log (available to Admins and Owners).
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Notifications</h3>
            <p className="text-muted-foreground">
              Stay informed about activity in your organization:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-3">
              <li>New join requests from users</li>
              <li>Invitation acceptances</li>
              <li>Page feedback submissions</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-3">
              Notifications appear in the dashboard header and can be viewed in the notification center.
            </p>
          </div>
        </div>
      )
    },
    {
      id: "branding",
      title: "Branding & Customization",
      icon: Palette,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Branding & Customization</h2>
            <p className="text-muted-foreground mb-4">
              Customize the look and feel of your documentation portal to match your brand identity.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Organization Branding</h3>
            <p className="text-muted-foreground mb-3">
              Configure your organization's branding in Settings → General:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Logo:</strong> Upload your company logo (displayed in header and landing page)</li>
              <li><strong>Primary Color:</strong> Main brand color for buttons, links, and accents</li>
              <li><strong>Secondary Color:</strong> Complementary color for secondary elements</li>
              <li><strong>Accent Color:</strong> Highlight color for special elements</li>
              <li><strong>Heading Font:</strong> Font family for headings (Google Fonts supported)</li>
              <li><strong>Body Font:</strong> Font family for body text</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Landing Page Customization</h3>
            <p className="text-muted-foreground mb-3">
              Customize what visitors see on your documentation homepage:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Hero Title:</strong> Main headline on the landing page</li>
              <li><strong>Hero Description:</strong> Subtitle or description text</li>
              <li><strong>Show Search:</strong> Toggle the search bar on the landing page</li>
              <li><strong>Show Featured Projects:</strong> Highlight specific projects</li>
              <li><strong>Tagline:</strong> Short tagline displayed with your logo</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Custom CSS</h3>
            <p className="text-muted-foreground mb-3">
              For advanced customization, add custom CSS to fine-tune appearance:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 border">
              <p className="text-sm text-muted-foreground mb-2">
                Custom CSS is applied to your published documentation. Use it to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Adjust spacing and layout</li>
                <li>Customize specific components</li>
                <li>Add background patterns or images</li>
                <li>Override default styles</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Access Custom CSS in Settings → General under your organization settings.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Light & Dark Mode</h3>
            <p className="text-muted-foreground">
              Docspeare automatically supports both light and dark themes. Readers can toggle 
              between modes using the theme switcher in the documentation header. Your brand colors 
              are optimized for both modes.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Custom Domain</h3>
            <p className="text-muted-foreground mb-3">
              Complete your brand experience with a custom documentation domain:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Choose a subdomain (e.g., docs.yourcompany.com)</li>
              <li>Add a CNAME record in your DNS settings</li>
              <li>Enter the domain in Settings → General</li>
              <li>Wait for verification (usually within an hour)</li>
            </ol>
          </div>
        </div>
      )
    },
    {
      id: "integrations",
      title: "Integrations",
      icon: Settings,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Integrations</h2>
            <p className="text-muted-foreground mb-4">
              Extend Docspeare's capabilities with powerful integrations for API documentation 
              and AI-powered tools.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">OpenAPI / Swagger Integration</h3>
            <p className="text-muted-foreground mb-3">
              Generate API documentation from your OpenAPI specification:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Go to Project Settings → API</li>
              <li>Enter your OpenAPI spec URL or paste the JSON directly</li>
              <li>Save the configuration</li>
              <li>An "API Reference" section appears in your documentation</li>
            </ol>
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                The API documentation displays endpoints, parameters, request/response examples, 
                and authentication requirements directly from your OpenAPI spec.
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Model Context Protocol (MCP)</h3>
            <p className="text-muted-foreground mb-3">
              Enable AI tools to interact with your documentation:
            </p>
            <div className="bg-primary/10 rounded-lg p-4 border border-primary/20 mb-4">
              <div className="flex items-start gap-3">
                <Bot className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium mb-1">What is MCP?</h4>
                  <p className="text-sm text-muted-foreground">
                    Model Context Protocol allows AI assistants like Claude to access your documentation 
                    as a tool. Users can ask their AI assistant questions about your product, and it 
                    will search your documentation to provide accurate answers.
                  </p>
                </div>
              </div>
            </div>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Go to Project Settings → MCP</li>
              <li>Enable MCP for the project</li>
              <li>Copy the MCP endpoint URL</li>
              <li>Users can add this endpoint to their AI assistant configuration</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Connectors</h3>
            <p className="text-muted-foreground mb-3">
              Connect external services to enhance your documentation workflow:
            </p>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium">Google Drive</h4>
                <p className="text-sm text-muted-foreground">
                  Core integration for content management. Syncs automatically with your Google Docs.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium">Custom MCP Servers</h4>
                <p className="text-sm text-muted-foreground">
                  Connect to custom MCP-compatible AI tools and services.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">llms.txt Support</h3>
            <p className="text-muted-foreground mb-3">
              The platform automatically generates an llms.txt file for your documentation:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Provides AI-friendly access to your documentation structure</li>
              <li>Enables LLMs to understand and reference your content</li>
              <li>Configurable through SEO settings</li>
            </ul>
          </div>
        </div>
      )
    }
  ];

  return (
    <>
      <Helmet>
        <title>Documentation | Knowledge Workspace</title>
        <meta name="description" content="Learn how to organize and publish knowledge from Google Drive using the workspace." />
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
              <div className="container max-w-3xl py-8 px-6">
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
