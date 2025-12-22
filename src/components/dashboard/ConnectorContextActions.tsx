import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
  MessageSquare, 
  RefreshCw, 
  Upload,
  Loader2,
  Building2,
  Brain
} from 'lucide-react';
import { useConnectors } from '@/hooks/useConnectors';
import { usePermissions } from '@/hooks/usePermissions';
import { Connector } from '@/lib/connectors/types';
import { toast } from 'sonner';

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
  const { connectors, executeAction, canUseConnector } = useConnectors(projectId);
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

  // Check if user can use connectors
  const canUse = role === 'admin' || role === 'editor';
  
  if (!canUse || enabledConnectors.length === 0) {
    return null;
  }

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
        documentContent: documentContent?.substring(0, 10000) // Limit context size
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
        <DropdownMenuContent align="end" className="w-56">
          {atlassianConnector && (
            <>
              <DropdownMenuItem onClick={() => setShowJiraDialog(true)}>
                <Building2 className="h-4 w-4 mr-2" />
                Create Jira Ticket
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSyncConfluence}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync from Confluence
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          {claudeConnector && (
            <>
              <DropdownMenuItem onClick={() => setShowClaudeDialog(true)}>
                <Brain className="h-4 w-4 mr-2" />
                Ask Claude
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSummarizePage}>
                <FileText className="h-4 w-4 mr-2" />
                Summarize Page
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Jira Dialog */}
      <Dialog open={showJiraDialog} onOpenChange={setShowJiraDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Jira Ticket</DialogTitle>
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
            <DialogTitle>Ask Claude About This Page</DialogTitle>
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
                <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
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
