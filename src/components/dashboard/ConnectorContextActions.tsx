import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plug2, 
  FileText, 
  RefreshCw, 
  Loader2,
  Settings,
  MessageSquare,
  FileUp
} from 'lucide-react';
import { useConnectors } from '@/hooks/useConnectors';
import { usePermissions } from '@/hooks/usePermissions';
import { ConnectorType } from '@/lib/connectors/types';
import { toast } from 'sonner';

// Connector logos as inline SVGs or icon components
const ConnectorLogos: Record<ConnectorType, React.ReactNode> = {
  atlassian: (
    <svg viewBox="0 0 32 32" className="h-5 w-5">
      <defs>
        <linearGradient id="atlassian-blue" x1="98.03%" x2="58.89%" y1="0%" y2="40.2%">
          <stop offset="0%" stopColor="#0052CC"/>
          <stop offset="92.3%" stopColor="#2684FF"/>
        </linearGradient>
      </defs>
      <path fill="url(#atlassian-blue)" d="M9.44 14.22c-.2-.26-.53-.3-.75-.05L2.07 22.6c-.17.21-.13.53.09.7l.02.01 7.69 5.82c.22.17.54.12.7-.1l.01-.02 3.31-4.47c.73-1 .58-2.4-.33-3.22l-4.12-7.1z"/>
      <path fill="#2684FF" d="M14.3 2.54a17.72 17.72 0 00-.48 17.66l4.67 8.08c.22.38.7.5 1.09.28l.03-.02 7.7-5.82a.52.52 0 00.1-.72L16.07 2.59c-.21-.28-.6-.33-.87-.12l-.9.07z"/>
    </svg>
  ),
  claude: (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#D97706" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  ),
  custom_mcp: (
    <Plug2 className="h-5 w-5 text-primary" />
  ),
};

interface ConnectorContextActionsProps {
  projectId: string;
  documentId?: string;
  documentTitle?: string;
  documentContent?: string;
}

export function ConnectorContextActions({
  projectId,
  documentId,
  documentTitle,
  documentContent,
}: ConnectorContextActionsProps) {
  const navigate = useNavigate();
  const { connectors, executeAction } = useConnectors(projectId);
  const { role } = usePermissions(projectId);
  
  const [showJiraDialog, setShowJiraDialog] = useState(false);
  const [showClaudeDialog, setShowClaudeDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jiraForm, setJiraForm] = useState({
    summary: '',
    description: '',
    issueType: 'Task'
  });
  const [claudeQuestion, setClaudeQuestion] = useState('');
  const [claudeResponse, setClaudeResponse] = useState('');

  const enabledConnectors = connectors.filter(c => c.is_enabled);
  const atlassianConnector = enabledConnectors.find(c => c.connector_type === 'atlassian');
  const claudeConnector = enabledConnectors.find(c => c.connector_type === 'claude');
  const customMcpConnectors = enabledConnectors.filter(c => c.connector_type === 'custom_mcp');

  // Check if user can use connectors
  const canUse = role === 'admin' || role === 'editor';

  const openIntegrations = () => {
    navigate(`/dashboard?integrations=1&project=${projectId}`);
  };

  const handleCreateJiraTicket = async () => {
    if (!atlassianConnector) return;
    
    setLoading(true);
    try {
      const result = await executeAction(atlassianConnector.id, 'create_jira_ticket', {
        summary: jiraForm.summary || `Documentation: ${documentTitle}`,
        description: jiraForm.description || `Related to document: ${documentTitle}`,
        issueType: jiraForm.issueType,
        documentId,
        documentTitle
      });

      if (result) {
        toast.success('Jira ticket created successfully');
        setShowJiraDialog(false);
        setJiraForm({ summary: '', description: '', issueType: 'Task' });
      }
    } catch (err) {
      toast.error('Failed to create Jira ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleAskClaude = async () => {
    if (!claudeConnector || !claudeQuestion) return;
    
    setLoading(true);
    setClaudeResponse('');
    
    try {
      const result = await executeAction(claudeConnector.id, 'answer_question', {
        question: claudeQuestion,
        documentId,
        documentTitle,
        documentContent: documentContent?.substring(0, 10000)
      });

      if (result?.output_data?.answer) {
        setClaudeResponse(result.output_data.answer as string);
      } else {
        toast.error('No response received');
      }
    } catch (err) {
      toast.error('Failed to get response from Claude');
    } finally {
      setLoading(false);
    }
  };

  const handleSummarizePage = async () => {
    if (!claudeConnector) return;
    
    setLoading(true);
    try {
      const result = await executeAction(claudeConnector.id, 'summarize_page', {
        documentId,
        documentTitle,
        documentContent: documentContent?.substring(0, 10000)
      });

      if (result?.output_data?.summary) {
        setClaudeQuestion('');
        setClaudeResponse(result.output_data.summary as string);
        setShowClaudeDialog(true);
      }
    } catch (err) {
      toast.error('Failed to summarize page');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncConfluence = async () => {
    if (!atlassianConnector) return;
    
    setLoading(true);
    try {
      const result = await executeAction(atlassianConnector.id, 'sync_confluence_page', {
        documentId,
        documentTitle
      });

      if (result) {
        toast.success('Synced from Confluence successfully');
      }
    } catch (err) {
      toast.error('Failed to sync from Confluence');
    } finally {
      setLoading(false);
    }
  };

  // If no connectors and user can't configure, don't show the button at all
  if (!canUse && enabledConnectors.length === 0) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plug2 className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Integrations</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {enabledConnectors.length === 0 ? (
            <>
              <div className="px-3 py-4 text-center">
                <Plug2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">
                  No integrations configured yet.
                </p>
                <Button size="sm" variant="outline" onClick={openIntegrations} className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Integrations
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Atlassian / Jira & Confluence */}
              {atlassianConnector && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    {ConnectorLogos.atlassian}
                    <span className="flex-1">Atlassian</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52">
                    <DropdownMenuItem onClick={() => setShowJiraDialog(true)}>
                      <FileUp className="h-4 w-4 mr-2 text-blue-500" />
                      Create Jira Ticket
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSyncConfluence}>
                      <RefreshCw className="h-4 w-4 mr-2 text-blue-500" />
                      Sync from Confluence
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}

              {/* Claude AI */}
              {claudeConnector && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    {ConnectorLogos.claude}
                    <span className="flex-1">Claude AI</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52">
                    <DropdownMenuItem onClick={() => setShowClaudeDialog(true)}>
                      <MessageSquare className="h-4 w-4 mr-2 text-amber-500" />
                      Ask Claude
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSummarizePage}>
                      <FileText className="h-4 w-4 mr-2 text-amber-500" />
                      Summarize Page
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}

              {/* Custom MCP Connectors */}
              {customMcpConnectors.map(connector => (
                <DropdownMenuSub key={connector.id}>
                  <DropdownMenuSubTrigger className="gap-2">
                    {ConnectorLogos.custom_mcp}
                    <span className="flex-1 truncate">{connector.name}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      {connector.description || 'Custom MCP Connector'}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>
                      <span className="text-xs text-muted-foreground">No actions available</span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openIntegrations} className="text-muted-foreground">
                <Settings className="h-4 w-4 mr-2" />
                Manage Integrations
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Jira Dialog */}
      <Dialog open={showJiraDialog} onOpenChange={setShowJiraDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {ConnectorLogos.atlassian}
              Create Jira Ticket
            </DialogTitle>
            <DialogDescription>
              Create a Jira ticket linked to this documentation page.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="summary">Summary</Label>
              <Input
                id="summary"
                placeholder={`Documentation: ${documentTitle}`}
                value={jiraForm.summary}
                onChange={(e) => setJiraForm({ ...jiraForm, summary: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the task or issue..."
                value={jiraForm.description}
                onChange={(e) => setJiraForm({ ...jiraForm, description: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJiraDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateJiraTicket} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Claude Dialog */}
      <Dialog open={showClaudeDialog} onOpenChange={setShowClaudeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {ConnectorLogos.claude}
              Ask Claude About This Page
            </DialogTitle>
            <DialogDescription>
              Claude can only access this specific document. Ask a question about its content.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question">Your Question</Label>
              <Textarea
                id="question"
                placeholder="What would you like to know about this page?"
                value={claudeQuestion}
                onChange={(e) => setClaudeQuestion(e.target.value)}
                rows={3}
              />
            </div>
            
            {claudeResponse && (
              <div className="space-y-2">
                <Label>Claude's Response</Label>
                <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm max-h-80 overflow-y-auto">
                  {claudeResponse}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClaudeDialog(false)}>
              Close
            </Button>
            <Button onClick={handleAskClaude} disabled={loading || !claudeQuestion}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ask Claude
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
