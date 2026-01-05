import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Bot, 
  Send, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  FolderPlus,
  FilePlus,
  FileEdit,
  List,
  Sparkles,
  X,
  Maximize2,
  Minimize2,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  role: "user" | "assistant";
  content: string;
  actions?: Array<{
    name: string;
    args: Record<string, any>;
  }>;
  toolResults?: Array<{
    success: boolean;
    result?: any;
    error?: string;
  }>;
  needsDriveReauth?: boolean;
}

interface DocAssistantChatProps {
  currentProject?: { id: string; name: string } | null;
  currentTopic?: { id: string; name: string } | null;
  onRefresh?: () => void;
  googleToken?: string | null;
}

const actionIcons: Record<string, typeof FolderPlus> = {
  create_topic: FolderPlus,
  create_page: FilePlus,
  update_page_content: FileEdit,
  list_projects: List,
  list_topics: List,
  list_pages: List,
  generate_documentation: Sparkles,
};

export function DocAssistantChat({ 
  currentProject, 
  currentTopic, 
  onRefresh,
  googleToken 
}: DocAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReauthorizing, setIsReauthorizing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { requestDriveAccess } = useAuth();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleReauthorizeDrive = async () => {
    setIsReauthorizing(true);
    try {
      const { error } = await requestDriveAccess();
      if (error) {
        toast({
          title: "Authorization failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Drive access granted",
          description: "You can now try your request again.",
        });
        // Clear the message that needed reauth
        setMessages(prev => prev.filter(m => !m.needsDriveReauth));
      }
    } catch (e) {
      console.error("Drive reauth error:", e);
    } finally {
      setIsReauthorizing(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("docs-ai-assistant", {
        body: {
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: {
            currentProject,
            currentTopic,
          },
        },
        headers: {
          ...(googleToken ? { "x-google-token": googleToken } : {}),
        },
      });

      if (error) {
        console.error("Supabase function error:", error);
        // Check for specific error types
        if (error.message?.includes("401") || error.message?.includes("Authentication")) {
          throw new Error("Authentication required. Please refresh the page and try again.");
        }
        throw new Error(error.message || "Failed to get response from assistant");
      }

      if (data?.error) {
        console.error("Assistant returned error:", data.error, data.details);
        throw new Error(data.details || data.error);
      }

      // Check if any write actions failed
      const writeActions = ["create_topic", "create_page", "update_page_content"];
      const failedWriteActions = data?.actions?.filter((a: any, i: number) => {
        const result = data?.toolResults?.[i];
        return writeActions.includes(a.name) && !result?.success;
      }) || [];
      
      // Build message with failure info if needed
      let messageContent = data?.message || "";
      if (failedWriteActions.length > 0) {
        const failureMessages = failedWriteActions.map((a: any, i: number) => {
          const resultIndex = data?.actions?.findIndex((action: any) => action === a);
          const result = data?.toolResults?.[resultIndex];
          return result?.error || "Unknown error";
        });
        
        // Check for Drive permission issues
        const hasDrivePermissionError = failureMessages.some((msg: string) => 
          msg.includes("Insufficient Permission") || 
          msg.includes("insufficient authentication scopes") ||
          msg.includes("PERMISSION_DENIED")
        );
        
        if (hasDrivePermissionError) {
          messageContent = "❌ I couldn't create the content because Google Drive access needs to be re-authorized with write permissions.";
        } else if (messageContent === "Task completed" || !messageContent) {
          messageContent = `❌ Action failed: ${failureMessages.join(", ")}`;
        }

        const assistantMessage: Message = {
          role: "assistant",
          content: messageContent,
          actions: data?.actions,
          toolResults: data?.toolResults,
          needsDriveReauth: hasDrivePermissionError,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const assistantMessage: Message = {
          role: "assistant",
          content: messageContent,
          actions: data?.actions,
          toolResults: data?.toolResults,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      }

      // Check if any actions were successful and refresh
      const successfulWriteActions = data?.actions?.filter((a: any, i: number) => {
        const result = data?.toolResults?.[i];
        return writeActions.includes(a.name) && result?.success;
      }) || [];
      
      if (successfulWriteActions.length > 0) {
        toast({
          title: "Content Created",
          description: "New content has been added to your documentation.",
        });
        onRefresh?.();
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast({
        title: "Assistant error",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { label: "List projects", prompt: "Show me all my projects" },
    { label: "Create topic", prompt: "Create a new topic called 'Getting Started'" },
    { label: "Generate docs", prompt: "Generate documentation about API authentication" },
  ];

  return (
    <div className={cn(
      "flex flex-col bg-card border rounded-lg transition-all duration-200",
      isExpanded ? "fixed inset-4 z-50 shadow-2xl" : "h-[500px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-medium">Documentation Assistant</span>
          {currentProject && (
            <Badge variant="secondary" className="text-xs">
              {currentProject.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          {isExpanded && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={() => setIsExpanded(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Bot className="h-12 w-12 mb-4 opacity-50" />
            <p className="font-medium mb-2">How can I help you?</p>
            <p className="text-sm mb-4">I can create topics, pages, and generate documentation content.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickActions.map((action, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setInput(action.prompt);
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-lg px-4 py-2 max-w-[80%]",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  {/* Show reconnect button for Drive permission errors */}
                  {message.needsDriveReauth && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={handleReauthorizeDrive}
                      disabled={isReauthorizing}
                    >
                      {isReauthorizing ? (
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-2" />
                      )}
                      Reconnect Google Drive
                    </Button>
                  )}
                  
                  {/* Show actions taken */}
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                      {message.actions.map((action, j) => {
                        const Icon = actionIcons[action.name] || CheckCircle;
                        const result = message.toolResults?.[j];
                        const isSuccess = result?.success;
                        
                        return (
                          <div 
                            key={j} 
                            className="flex items-center gap-2 text-xs"
                          >
                            <Icon className={cn(
                              "h-3 w-3",
                              isSuccess ? "text-green-500" : "text-destructive"
                            )} />
                            <span className="opacity-80">
                              {action.name.replace(/_/g, " ")}
                            </span>
                            {isSuccess ? (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            ) : (
                              <AlertCircle className="h-3 w-3 text-destructive" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <p className="text-sm text-muted-foreground">Thinking...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to create topics, pages, or generate content..."
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[60px] w-[60px]"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
