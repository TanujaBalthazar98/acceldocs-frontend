import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  RefreshCw,
  MessageSquare,
  X
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

const quickActions = [
  { label: "List projects", prompt: "Show me all my projects", icon: List },
  { label: "Create topic", prompt: "Create a new topic", icon: FolderPlus },
  { label: "Add a page", prompt: "Create a new page", icon: FilePlus },
  { label: "Generate docs", prompt: "Generate documentation about", icon: Sparkles },
];

export function DocAssistantChat({ 
  open,
  onOpenChange,
  currentProject, 
  currentTopic, 
  onRefresh,
  googleToken 
}: DocAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
        setMessages(prev => prev.filter(m => !m.needsDriveReauth));
      }
    } catch (e) {
      console.error("Drive reauth error:", e);
    } finally {
      setIsReauthorizing(false);
    }
  };

  const sendMessage = async (overrideInput?: string) => {
    const messageText = overrideInput || input;
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: messageText.trim() };
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
        if (error.message?.includes("401") || error.message?.includes("Authentication")) {
          throw new Error("Authentication required. Please refresh the page and try again.");
        }
        throw new Error(error.message || "Failed to get response from assistant");
      }

      if (data?.error) {
        console.error("Assistant returned error:", data.error, data.details);
        throw new Error(data.details || data.error);
      }

      const writeActions = ["create_topic", "create_page", "update_page_content"];
      const failedWriteActions = data?.actions?.filter((a: any, i: number) => {
        const result = data?.toolResults?.[i];
        return writeActions.includes(a.name) && !result?.success;
      }) || [];
      
      let messageContent = data?.message || "";
      if (failedWriteActions.length > 0) {
        const failureMessages = failedWriteActions.map((a: any) => {
          const resultIndex = data?.actions?.findIndex((action: any) => action === a);
          const result = data?.toolResults?.[resultIndex];
          return result?.error || "Unknown error";
        });
        
        const hasDrivePermissionError = failureMessages.some((msg: string) => 
          msg.includes("Insufficient Permission") || 
          msg.includes("insufficient authentication scopes") ||
          msg.includes("PERMISSION_DENIED")
        );
        
        if (hasDrivePermissionError) {
          messageContent = "I couldn't create the content because Google Drive access needs to be re-authorized.";
        } else if (messageContent === "Task completed" || !messageContent) {
          messageContent = `Action failed: ${failureMessages.join(", ")}`;
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

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-4 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-base">AI Assistant</SheetTitle>
                <p className="text-xs text-muted-foreground">Powered by Gemini Pro</p>
              </div>
            </div>
            {messages.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={clearChat}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            )}
          </div>
          {(currentProject || currentTopic) && (
            <div className="flex items-center gap-2 mt-2">
              {currentProject && (
                <Badge variant="secondary" className="text-xs">
                  {currentProject.name}
                </Badge>
              )}
              {currentTopic && (
                <Badge variant="outline" className="text-xs">
                  {currentTopic.name}
                </Badge>
              )}
            </div>
          )}
        </SheetHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-medium mb-2">How can I help you?</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">
                I can create topics, pages, and generate documentation content for you.
              </p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-[320px]">
                {quickActions.map((action, i) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="h-auto py-3 px-3 flex-col gap-1 text-xs"
                      onClick={() => setInput(action.prompt)}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {action.label}
                    </Button>
                  );
                })}
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
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-xl px-3 py-2 max-w-[85%]",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    
                    {message.needsDriveReauth && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 text-xs"
                        onClick={handleReauthorizeDrive}
                        disabled={isReauthorizing}
                      >
                        {isReauthorizing ? (
                          <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1.5" />
                        )}
                        Reconnect Drive
                      </Button>
                    )}
                    
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
                              {isSuccess ? (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              ) : (
                                <AlertCircle className="h-3 w-3 text-destructive" />
                              )}
                              <span className="opacity-80">
                                {action.name.replace(/_/g, " ")}
                              </span>
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
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                  </div>
                  <div className="bg-muted rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t bg-background flex-shrink-0">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
              className="min-h-[48px] max-h-[120px] resize-none text-sm"
              disabled={isLoading}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-12 w-12 flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
