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
  Share2
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
  const [expandedSections, setExpandedSections] = useState<string[]>(["getting-started"]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

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
              Docspeare is a powerful documentation platform that helps teams create, organize, and publish 
              beautiful documentation. Whether you're building internal knowledge bases or public-facing 
              documentation, Docspeare makes it easy to keep your content structured and up-to-date.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-6 border">
            <h3 className="font-semibold text-lg mb-3">Quick Start Checklist</h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary">1</div>
                <span>Create your organization or join an existing one</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary">2</div>
                <span>Set up your first project to organize documentation</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary">3</div>
                <span>Create topics to group related pages</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary">4</div>
                <span>Add pages with your documentation content</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary">5</div>
                <span>Publish and share with your audience</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Signing Up</h3>
            <p className="text-muted-foreground mb-3">
              To get started with Docspeare, you'll need to create an account:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Click "Get Started" or "Sign Up" on the homepage</li>
              <li>Enter your email address and create a password</li>
              <li>Verify your email address</li>
              <li>Complete your profile setup</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Joining an Organization</h3>
            <p className="text-muted-foreground mb-3">
              If you've been invited to join an existing organization:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Check your email for an invitation link</li>
              <li>Click the invitation link to accept</li>
              <li>Sign in or create an account if you haven't already</li>
              <li>You'll automatically be added to the organization</li>
            </ol>
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
              Organizations are the top-level container for all your documentation. They represent 
              your company, team, or group and contain all projects, members, and settings.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Creating an Organization</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Navigate to your dashboard</li>
              <li>Click on your organization name in the sidebar</li>
              <li>Select "Create New Organization"</li>
              <li>Enter your organization name and domain</li>
              <li>Customize your branding (logo, colors, etc.)</li>
              <li>Click "Create" to finish</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Organization Roles</h3>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Owner</h4>
                <p className="text-sm text-muted-foreground">Full access to all settings, billing, and member management</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Admin</h4>
                <p className="text-sm text-muted-foreground">Can manage projects, members, and most settings</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Editor</h4>
                <p className="text-sm text-muted-foreground">Can create and edit documentation content</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Viewer</h4>
                <p className="text-sm text-muted-foreground">Can view internal documentation only</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Inviting Team Members</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Go to Settings → Team Members</li>
              <li>Click "Invite Member"</li>
              <li>Enter the email address of the person you want to invite</li>
              <li>Select their role (Admin, Editor, or Viewer)</li>
              <li>Click "Send Invitation"</li>
            </ol>
            <p className="text-sm text-muted-foreground mt-3">
              Invitations expire after 7 days. You can resend or revoke invitations from the Team Members page.
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
              Projects help you organize documentation into logical groups. For example, you might 
              have separate projects for your API documentation, user guides, and internal processes.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Creating a Project</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>From the dashboard, click "Add Project" in the sidebar</li>
              <li>Enter a project name and optional description</li>
              <li>Set the visibility level (Internal, External, or Public)</li>
              <li>Click "Create Project"</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Project Visibility Levels</h3>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-orange-500" />
                  <h4 className="font-medium">Internal</h4>
                </div>
                <p className="text-sm text-muted-foreground">Only visible to organization members. Perfect for internal documentation and processes.</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-blue-500" />
                  <h4 className="font-medium">External</h4>
                </div>
                <p className="text-sm text-muted-foreground">Visible to authenticated users outside your organization. Great for partner documentation.</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-green-500" />
                  <h4 className="font-medium">Public</h4>
                </div>
                <p className="text-sm text-muted-foreground">Visible to everyone, including search engines. Ideal for public-facing documentation.</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Project Settings</h3>
            <p className="text-muted-foreground mb-3">
              Access project settings by clicking the gear icon next to your project name:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>General:</strong> Update name, description, and visibility</li>
              <li><strong>SEO:</strong> Configure search engine optimization settings</li>
              <li><strong>API:</strong> Manage OpenAPI specifications for API documentation</li>
              <li><strong>Sharing:</strong> Control who can access and collaborate on the project</li>
            </ul>
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
              Topics are folders that help organize related pages within a project. Pages are the 
              individual documentation articles where your content lives.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Creating Topics</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Select a project from the sidebar</li>
              <li>Click "Add Topic" button</li>
              <li>Enter a topic name</li>
              <li>Click "Create" to add the topic</li>
            </ol>
            <p className="text-sm text-muted-foreground mt-3">
              Topics can be nested to create a hierarchical structure for complex documentation.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Creating Pages</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Navigate to a topic or project</li>
              <li>Click "Add Page" button</li>
              <li>Enter a page title</li>
              <li>The page will be created and opened for editing</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Page States</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-green-600">Active</h4>
                <p className="text-sm text-muted-foreground">Current, published content</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-yellow-600">Draft</h4>
                <p className="text-sm text-muted-foreground">Work in progress, not yet published</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-orange-600">Deprecated</h4>
                <p className="text-sm text-muted-foreground">Outdated but still accessible</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-gray-500">Archived</h4>
                <p className="text-sm text-muted-foreground">No longer active or relevant</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Page Ownership</h3>
            <p className="text-muted-foreground mb-3">
              Each page has an owner who is responsible for keeping the content accurate and up-to-date:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>The creator of a page is automatically assigned as the owner</li>
              <li>Owners can be changed in the page settings</li>
              <li>You can also assign a backup owner for redundancy</li>
              <li>Use "Last Verified" to track when content was last reviewed</li>
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
              Docspeare allows you to publish your documentation to make it accessible to your 
              intended audience, whether that's your team, partners, or the public.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Publishing a Page</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Open the page you want to publish</li>
              <li>Review the content to ensure it's ready</li>
              <li>Click the "Publish" button in the page toolbar</li>
              <li>The page will be visible based on its visibility settings</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">What Gets Published</h3>
            <div className="bg-muted/50 rounded-lg p-4 border">
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span>Only <strong>Active</strong> pages are published externally</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <span><strong>Draft</strong> pages are only visible to editors</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <span><strong>Deprecated</strong> pages remain visible with a warning</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <span><strong>Archived</strong> pages are hidden from navigation</span>
                </li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Custom Domains</h3>
            <p className="text-muted-foreground mb-3">
              You can serve your documentation from a custom domain:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Go to Settings → General</li>
              <li>Enter your custom documentation domain</li>
              <li>Add the required DNS records to your domain provider</li>
              <li>Wait for DNS propagation (usually 24-48 hours)</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">SEO Settings</h3>
            <p className="text-muted-foreground mb-3">
              Optimize your public documentation for search engines:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Enable indexing to allow search engines to find your docs</li>
              <li>Configure which paths should be indexed</li>
              <li>Control access for AI/LLM crawlers</li>
              <li>Set up proper meta descriptions for each page</li>
            </ul>
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
              Docspeare provides powerful search capabilities to help you and your readers 
              find information quickly.
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
            <p className="text-muted-foreground">
              Search works across all projects and pages you have access to. Results are ranked 
              by relevance and show matching content snippets.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Ask AI</h3>
            <div className="flex items-start gap-3 bg-primary/10 rounded-lg p-4 border border-primary/20">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium mb-1">AI-Powered Answers</h4>
                <p className="text-sm text-muted-foreground">
                  Use the "Ask AI" feature to get intelligent answers based on your documentation. 
                  The AI will search through your content and provide relevant answers with citations.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Navigation Structure</h3>
            <p className="text-muted-foreground mb-3">
              Documentation is organized in a clear hierarchy:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 border font-mono text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Organization</span>
              </div>
              <div className="ml-6 flex items-center gap-2 text-muted-foreground">
                <FolderOpen className="h-4 w-4" />
                <span>Project</span>
              </div>
              <div className="ml-12 flex items-center gap-2 text-muted-foreground">
                <Layers className="h-4 w-4" />
                <span>Topic</span>
              </div>
              <div className="ml-18 flex items-center gap-2 text-muted-foreground pl-6">
                <FileText className="h-4 w-4" />
                <span>Page</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Internal Linking</h3>
            <p className="text-muted-foreground mb-3">
              Link between documentation pages easily:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Use the "Copy Link" button on any page to get a shareable URL</li>
              <li>Links remain stable even if page titles change</li>
              <li>Old URLs automatically redirect to the current location</li>
            </ul>
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
              Work together with your team to create and maintain documentation.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Project Sharing</h3>
            <p className="text-muted-foreground mb-3">
              Share projects with specific team members:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Open the project settings</li>
              <li>Go to the "Sharing" tab</li>
              <li>Add team members by email</li>
              <li>Assign appropriate roles (Admin, Editor, Reviewer, Viewer)</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Project Roles</h3>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Admin</h4>
                <p className="text-sm text-muted-foreground">Full control over project settings, content, and team</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Editor</h4>
                <p className="text-sm text-muted-foreground">Can create, edit, and delete content</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Reviewer</h4>
                <p className="text-sm text-muted-foreground">Can review and provide feedback on content</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <h4 className="font-medium text-primary">Viewer</h4>
                <p className="text-sm text-muted-foreground">Read-only access to project content</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Page Feedback</h3>
            <p className="text-muted-foreground mb-3">
              Readers can provide feedback on documentation pages:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Rate pages as helpful or not helpful</li>
              <li>Submit detailed feedback comments</li>
              <li>Feedback is collected and visible to editors</li>
              <li>Use feedback to improve your documentation</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Join Requests</h3>
            <p className="text-muted-foreground mb-3">
              Users can request to join your organization:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Users with matching email domains can request access</li>
              <li>Admins receive notifications of pending requests</li>
              <li>Review and approve or reject requests in Settings</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: "branding",
      title: "Branding & Customization",
      icon: Settings,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Branding & Customization</h2>
            <p className="text-muted-foreground mb-4">
              Customize the look and feel of your documentation to match your brand.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Organization Branding</h3>
            <p className="text-muted-foreground mb-3">
              Configure your organization's branding in Settings → General:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong>Logo:</strong> Upload your company logo</li>
              <li><strong>Colors:</strong> Set primary, secondary, and accent colors</li>
              <li><strong>Fonts:</strong> Choose heading and body fonts</li>
              <li><strong>Hero Section:</strong> Customize the landing page title and description</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Documentation Landing Page</h3>
            <p className="text-muted-foreground mb-3">
              Configure what visitors see on your documentation homepage:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Show or hide the search bar</li>
              <li>Display featured projects</li>
              <li>Customize hero title and description</li>
              <li>Add quick links to important pages</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Custom CSS</h3>
            <p className="text-muted-foreground">
              For advanced customization, you can add custom CSS to fine-tune the appearance 
              of your documentation. This is available in the organization settings.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Light & Dark Mode</h3>
            <p className="text-muted-foreground">
              Docspeare automatically supports both light and dark themes. Readers can toggle 
              between modes using the theme switcher in the documentation header.
            </p>
          </div>
        </div>
      )
    }
  ];

  return (
    <>
      <Helmet>
        <title>Help & Documentation | Docspeare</title>
        <meta name="description" content="Learn how to use Docspeare to create, organize, and publish beautiful documentation for your team." />
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
              <span className="font-medium">Help & Documentation</span>
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
