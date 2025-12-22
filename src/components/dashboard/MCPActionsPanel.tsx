import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  FilePlus,
  FileEdit,
  Trash2,
  FileText,
  Search,
  FolderPlus,
  List,
  Globe,
  EyeOff,
  Sparkles,
  MessageSquare,
  FileQuestion,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { useConnectors } from '@/hooks/useConnectors';
import { toast } from 'sonner';

interface MCPTool {
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'document' | 'topic' | 'project' | 'ai';
  requiredRole: string;
  fields: {
    name: string;
    label: string;
    type: 'text' | 'textarea' | 'select';
    required?: boolean;
    placeholder?: string;
    options?: { value: string; label: string }[];
  }[];
}

const MCP_TOOLS: MCPTool[] = [
  // Document Actions
  {
    name: 'create_page',
    description: 'Create a new documentation page',
    icon: <FilePlus className="h-4 w-4" />,
    category: 'document',
    requiredRole: 'editor',
    fields: [
      { name: 'title', label: 'Page Title', type: 'text', required: true, placeholder: 'Enter page title' },
      { name: 'content', label: 'Content', type: 'textarea', required: true, placeholder: 'Page content (markdown supported)' },
      { name: 'topicId', label: 'Topic ID (optional)', type: 'text', placeholder: 'Leave empty for root level' },
    ],
  },
  {
    name: 'update_page',
    description: 'Update an existing page',
    icon: <FileEdit className="h-4 w-4" />,
    category: 'document',
    requiredRole: 'editor',
    fields: [
      { name: 'pageId', label: 'Page ID', type: 'text', required: true, placeholder: 'Document UUID' },
      { name: 'title', label: 'New Title (optional)', type: 'text', placeholder: 'Leave empty to keep current' },
      { name: 'content', label: 'New Content', type: 'textarea', placeholder: 'New content (replaces existing)' },
    ],
  },
  {
    name: 'delete_page',
    description: 'Delete a page permanently',
    icon: <Trash2 className="h-4 w-4" />,
    category: 'document',
    requiredRole: 'admin',
    fields: [
      { name: 'pageId', label: 'Page ID', type: 'text', required: true, placeholder: 'Document UUID to delete' },
    ],
  },
  {
    name: 'get_page',
    description: 'Get page content and metadata',
    icon: <FileText className="h-4 w-4" />,
    category: 'document',
    requiredRole: 'viewer',
    fields: [
      { name: 'pageId', label: 'Page ID', type: 'text', required: true, placeholder: 'Document UUID' },
    ],
  },
  {
    name: 'search_docs',
    description: 'Search documentation pages',
    icon: <Search className="h-4 w-4" />,
    category: 'document',
    requiredRole: 'viewer',
    fields: [
      { name: 'query', label: 'Search Query', type: 'text', required: true, placeholder: 'Search term' },
      { name: 'limit', label: 'Max Results', type: 'text', placeholder: '10' },
    ],
  },
  // Topic Actions
  {
    name: 'create_topic',
    description: 'Create a new topic/folder',
    icon: <FolderPlus className="h-4 w-4" />,
    category: 'topic',
    requiredRole: 'editor',
    fields: [
      { name: 'name', label: 'Topic Name', type: 'text', required: true, placeholder: 'Topic name' },
      { name: 'parentId', label: 'Parent Topic ID (optional)', type: 'text', placeholder: 'Leave empty for root' },
    ],
  },
  {
    name: 'list_topics',
    description: 'List all topics in the project',
    icon: <List className="h-4 w-4" />,
    category: 'topic',
    requiredRole: 'viewer',
    fields: [],
  },
  // Project Actions
  {
    name: 'get_project',
    description: 'Get project details',
    icon: <Info className="h-4 w-4" />,
    category: 'project',
    requiredRole: 'viewer',
    fields: [],
  },
  {
    name: 'publish_project',
    description: 'Publish the project (make it public)',
    icon: <Globe className="h-4 w-4" />,
    category: 'project',
    requiredRole: 'admin',
    fields: [],
  },
  {
    name: 'unpublish_project',
    description: 'Unpublish the project',
    icon: <EyeOff className="h-4 w-4" />,
    category: 'project',
    requiredRole: 'admin',
    fields: [],
  },
  // AI Actions
  {
    name: 'summarize_page',
    description: 'Generate AI summary of a page',
    icon: <Sparkles className="h-4 w-4" />,
    category: 'ai',
    requiredRole: 'viewer',
    fields: [
      { name: 'pageId', label: 'Page ID', type: 'text', required: true, placeholder: 'Document UUID' },
    ],
  },
  {
    name: 'answer_question',
    description: 'Ask AI a question about a page',
    icon: <MessageSquare className="h-4 w-4" />,
    category: 'ai',
    requiredRole: 'viewer',
    fields: [
      { name: 'pageId', label: 'Page ID', type: 'text', required: true, placeholder: 'Document UUID' },
      { name: 'question', label: 'Question', type: 'textarea', required: true, placeholder: 'What would you like to know?' },
    ],
  },
  {
    name: 'generate_content',
    description: 'Generate content based on a prompt',
    icon: <FileQuestion className="h-4 w-4" />,
    category: 'ai',
    requiredRole: 'editor',
    fields: [
      { name: 'prompt', label: 'Prompt', type: 'textarea', required: true, placeholder: 'Describe what content to generate' },
      { name: 'context', label: 'Context (optional)', type: 'textarea', placeholder: 'Additional context for generation' },
    ],
  },
];

interface MCPActionsPanelProps {
  projectId: string;
}

export function MCPActionsPanel({ projectId }: MCPActionsPanelProps) {
  const { connectors, executeAction } = useConnectors(projectId);
  const claudeConnector = connectors.find(c => c.connector_type === 'claude' && c.is_enabled);
  
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; data: any } | null>(null);

  const handleFieldChange = (fieldName: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleExecute = async () => {
    if (!selectedTool || !claudeConnector) return;

    // Validate required fields
    const missingFields = selectedTool.fields
      .filter(f => f.required && !formData[f.name])
      .map(f => f.label);

    if (missingFields.length > 0) {
      toast.error(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const params: Record<string, any> = { projectId };
      selectedTool.fields.forEach(field => {
        if (formData[field.name]) {
          params[field.name] = formData[field.name];
        }
      });

      const response = await executeAction(claudeConnector.id, selectedTool.name, params);
      
      setResult({
        success: true,
        data: response?.output_data || response,
      });
      toast.success(`${selectedTool.name} executed successfully`);
    } catch (error: any) {
      setResult({
        success: false,
        data: error.message || 'Action failed',
      });
      toast.error(`Failed to execute ${selectedTool.name}`);
    } finally {
      setLoading(false);
    }
  };

  const selectTool = (tool: MCPTool) => {
    setSelectedTool(tool);
    setFormData({});
    setResult(null);
  };

  const getCategoryTools = (category: MCPTool['category']) => 
    MCP_TOOLS.filter(t => t.category === category);

  if (!claudeConnector) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            MCP Actions
          </CardTitle>
          <CardDescription>
            Enable Claude AI connector to use MCP actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Go to Integrations and enable the Claude AI connector to access MCP tools.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Tool Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Available MCP Tools
          </CardTitle>
          <CardDescription>
            Select a tool to execute via the Claude MCP connector
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="document" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4">
              <TabsTrigger value="document" className="data-[state=active]:bg-muted">
                Documents
              </TabsTrigger>
              <TabsTrigger value="topic" className="data-[state=active]:bg-muted">
                Topics
              </TabsTrigger>
              <TabsTrigger value="project" className="data-[state=active]:bg-muted">
                Project
              </TabsTrigger>
              <TabsTrigger value="ai" className="data-[state=active]:bg-muted">
                AI
              </TabsTrigger>
            </TabsList>

            {(['document', 'topic', 'project', 'ai'] as const).map(category => (
              <TabsContent key={category} value={category} className="mt-0">
                <ScrollArea className="h-[400px]">
                  <div className="p-4 space-y-2">
                    {getCategoryTools(category).map(tool => (
                      <button
                        key={tool.name}
                        onClick={() => selectTool(tool)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedTool?.name === tool.name
                            ? 'bg-primary/10 border-primary'
                            : 'bg-card hover:bg-muted border-border'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-md ${
                            selectedTool?.name === tool.name ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          }`}>
                            {tool.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{tool.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {tool.requiredRole}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {tool.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Tool Execution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {selectedTool ? selectedTool.icon : <FileText className="h-5 w-5" />}
            {selectedTool ? selectedTool.name : 'Execute Tool'}
          </CardTitle>
          <CardDescription>
            {selectedTool ? selectedTool.description : 'Select a tool from the list to configure and execute'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedTool ? (
            <div className="space-y-4">
              {selectedTool.fields.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  This action requires no additional parameters.
                </p>
              ) : (
                selectedTool.fields.map(field => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name}>
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {field.type === 'textarea' ? (
                      <Textarea
                        id={field.name}
                        placeholder={field.placeholder}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        rows={4}
                      />
                    ) : field.type === 'select' && field.options ? (
                      <Select
                        value={formData[field.name] || ''}
                        onValueChange={(value) => handleFieldChange(field.name, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={field.placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={field.name}
                        placeholder={field.placeholder}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      />
                    )}
                  </div>
                ))
              )}

              <Button
                onClick={handleExecute}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    Execute {selectedTool.name}
                  </>
                )}
              </Button>

              {result && (
                <div className={`mt-4 p-4 rounded-lg border ${
                  result.success ? 'bg-green-500/10 border-green-500/30' : 'bg-destructive/10 border-destructive/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="font-medium text-sm">
                      {result.success ? 'Success' : 'Error'}
                    </span>
                  </div>
                  <ScrollArea className="max-h-[200px]">
                    <pre className="text-xs whitespace-pre-wrap overflow-x-auto">
                      {typeof result.data === 'string' 
                        ? result.data 
                        : JSON.stringify(result.data, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a tool from the list to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
