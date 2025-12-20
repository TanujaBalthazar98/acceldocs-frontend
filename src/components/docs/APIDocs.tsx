import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { 
  ChevronDown, 
  ChevronRight, 
  Code, 
  Copy, 
  Check, 
  Lock, 
  Unlock,
  Send,
  ArrowRight,
  FileJson,
  Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, Record<string, PathOperation>>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
}

interface PathOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
  security?: Array<Record<string, string[]>>;
}

interface Parameter {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  description?: string;
  required?: boolean;
  schema?: SchemaObject;
}

interface RequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, { schema?: SchemaObject; example?: unknown }>;
}

interface Response {
  description?: string;
  content?: Record<string, { schema?: SchemaObject; example?: unknown }>;
}

interface SchemaObject {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  description?: string;
  enum?: string[];
  example?: unknown;
  $ref?: string;
}

interface SecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  description?: string;
}

interface APIDocsProps {
  spec?: OpenAPISpec | null;
  specUrl?: string;
}

const methodColors: Record<string, string> = {
  get: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  post: "bg-green-500/10 text-green-500 border-green-500/30",
  put: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  patch: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  delete: "bg-red-500/10 text-red-500 border-red-500/30",
};

export const APIDocs = ({ spec, specUrl }: APIDocsProps) => {
  const [loadedSpec, setLoadedSpec] = useState<OpenAPISpec | null>(spec || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (specUrl && !spec) {
      loadSpec(specUrl);
    }
  }, [specUrl, spec]);

  const loadSpec = async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to load OpenAPI spec");
      const data = await response.json();
      setLoadedSpec(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load spec");
    } finally {
      setLoading(false);
    }
  };

  const togglePath = (pathKey: string) => {
    setExpandedPaths((prev) =>
      prev.includes(pathKey) ? prev.filter((p) => p !== pathKey) : [...prev, pathKey]
    );
  };

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const resolveRef = (ref: string): SchemaObject | undefined => {
    if (!ref.startsWith("#/components/schemas/")) return undefined;
    const schemaName = ref.replace("#/components/schemas/", "");
    return loadedSpec?.components?.schemas?.[schemaName];
  };

  const renderSchema = (schema: SchemaObject, indent = 0): JSX.Element => {
    if (schema.$ref) {
      const resolved = resolveRef(schema.$ref);
      if (resolved) return renderSchema(resolved, indent);
      return <span className="text-muted-foreground">{schema.$ref}</span>;
    }

    if (schema.type === "object" && schema.properties) {
      return (
        <div className="space-y-1" style={{ marginLeft: indent * 16 }}>
          {Object.entries(schema.properties).map(([key, prop]) => (
            <div key={key} className="flex items-start gap-2 text-sm">
              <span className="font-mono text-primary">{key}</span>
              <span className="text-muted-foreground">
                {prop.type || (prop.$ref ? prop.$ref.split("/").pop() : "object")}
              </span>
              {schema.required?.includes(key) && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">required</Badge>
              )}
              {prop.description && (
                <span className="text-xs text-muted-foreground">— {prop.description}</span>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (schema.type === "array" && schema.items) {
      return (
        <div className="text-sm">
          <span className="text-muted-foreground">Array of </span>
          {renderSchema(schema.items, indent)}
        </div>
      );
    }

    return (
      <span className="text-sm text-muted-foreground">
        {schema.type}
        {schema.format && <span> ({schema.format})</span>}
        {schema.enum && <span> enum: [{schema.enum.join(", ")}]</span>}
      </span>
    );
  };

  const generateCurlExample = (path: string, method: string, operation: PathOperation): string => {
    const server = loadedSpec?.servers?.[0]?.url || "https://api.example.com";
    const hasAuth = operation.security && operation.security.length > 0;
    
    let curl = `curl -X ${method.toUpperCase()} "${server}${path}"`;
    if (hasAuth) {
      curl += ` \\\n  -H "Authorization: Bearer YOUR_TOKEN"`;
    }
    if (operation.requestBody?.content?.["application/json"]) {
      curl += ` \\\n  -H "Content-Type: application/json"`;
      curl += ` \\\n  -d '{}'`;
    }
    return curl;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading API documentation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  if (!loadedSpec) {
    return (
      <div className="max-w-4xl mx-auto p-6 lg:p-8">
        <div className="text-center py-16">
          <FileJson className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold text-foreground mb-2">No API Specification</h2>
          <p className="text-muted-foreground">
            Upload an OpenAPI spec in project settings to view API documentation.
          </p>
        </div>
      </div>
    );
  }

  const allPaths = Object.entries(loadedSpec.paths || {}).filter(([path]) =>
    path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by tags
  const taggedPaths = new Map<string, Array<[string, string, PathOperation]>>();
  allPaths.forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, operation]) => {
      const tags = operation.tags || ["default"];
      tags.forEach((tag) => {
        if (!taggedPaths.has(tag)) taggedPaths.set(tag, []);
        taggedPaths.get(tag)!.push([path, method, operation]);
      });
    });
  });

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Code className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">{loadedSpec.info.title}</h1>
            {loadedSpec.info.description && (
              <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none mt-2">
                <ReactMarkdown>{loadedSpec.info.description}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">v{loadedSpec.info.version}</Badge>
          <Badge variant="outline">OpenAPI {loadedSpec.openapi}</Badge>
          {loadedSpec.servers?.[0] && (
            <Badge variant="secondary" className="font-mono text-xs">
              {loadedSpec.servers[0].url}
            </Badge>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search endpoints..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Endpoints by Tag */}
      <div className="space-y-6">
        {Array.from(taggedPaths.entries()).map(([tag, endpoints]) => (
          <div key={tag}>
            <div className="flex items-center gap-2 mb-3">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground capitalize">{tag}</h2>
              <Badge variant="secondary" className="text-xs">{endpoints.length}</Badge>
            </div>
            
            <div className="space-y-2">
              {endpoints.map(([path, method, operation]) => {
                const pathKey = `${method}-${path}`;
                const isExpanded = expandedPaths.includes(pathKey);
                
                return (
                  <Collapsible key={pathKey} open={isExpanded} onOpenChange={() => togglePath(pathKey)}>
                    <CollapsibleTrigger asChild>
                      <button
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors",
                          isExpanded && "border-primary/30"
                        )}
                      >
                        <Badge 
                          variant="outline" 
                          className={cn("uppercase font-mono text-xs px-2", methodColors[method])}
                        >
                          {method}
                        </Badge>
                        <code className="font-mono text-sm text-foreground flex-1 text-left">{path}</code>
                        <span className="text-sm text-muted-foreground hidden sm:inline truncate max-w-xs">
                          {operation.summary}
                        </span>
                        {operation.security && operation.security.length > 0 && (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        )}
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="p-4 border-x border-b border-border rounded-b-lg bg-card/50 space-y-4">
                        {operation.description && (
                          <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
                            <ReactMarkdown>{operation.description}</ReactMarkdown>
                          </div>
                        )}

                        <Tabs defaultValue="params" className="w-full">
                          <TabsList className="h-9">
                            <TabsTrigger value="params" className="text-xs">Parameters</TabsTrigger>
                            <TabsTrigger value="request" className="text-xs">Request</TabsTrigger>
                            <TabsTrigger value="response" className="text-xs">Response</TabsTrigger>
                            <TabsTrigger value="code" className="text-xs">Code</TabsTrigger>
                          </TabsList>

                          <TabsContent value="params" className="mt-4">
                            {operation.parameters && operation.parameters.length > 0 ? (
                              <div className="space-y-2">
                                {operation.parameters.map((param, i) => (
                                  <div key={i} className="flex items-start gap-3 p-2 rounded bg-secondary/50">
                                    <Badge variant="outline" className="text-[10px] shrink-0">{param.in}</Badge>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <code className="text-sm font-mono text-primary">{param.name}</code>
                                        {param.required && (
                                          <Badge variant="destructive" className="text-[10px] px-1 py-0">required</Badge>
                                        )}
                                      </div>
                                      {param.description && (
                                        <p className="text-xs text-muted-foreground mt-1">{param.description}</p>
                                      )}
                                    </div>
                                    {param.schema && (
                                      <span className="text-xs text-muted-foreground">{param.schema.type}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No parameters</p>
                            )}
                          </TabsContent>

                          <TabsContent value="request" className="mt-4">
                            {operation.requestBody?.content?.["application/json"]?.schema ? (
                              <div className="p-3 rounded bg-secondary/50">
                                {renderSchema(operation.requestBody.content["application/json"].schema)}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No request body</p>
                            )}
                          </TabsContent>

                          <TabsContent value="response" className="mt-4">
                            {operation.responses && Object.entries(operation.responses).length > 0 ? (
                              <div className="space-y-3">
                                {Object.entries(operation.responses).map(([code, response]) => (
                                  <div key={code} className="p-3 rounded bg-secondary/50">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge 
                                        variant={code.startsWith("2") ? "default" : "destructive"}
                                        className="text-xs"
                                      >
                                        {code}
                                      </Badge>
                                      <span className="text-sm text-muted-foreground">{response.description}</span>
                                    </div>
                                    {response.content?.["application/json"]?.schema && (
                                      renderSchema(response.content["application/json"].schema)
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No response defined</p>
                            )}
                          </TabsContent>

                          <TabsContent value="code" className="mt-4">
                            <div className="relative group">
                              <pre className="bg-secondary border border-border rounded-lg p-4 overflow-x-auto">
                                <code className="text-sm text-foreground font-mono">
                                  {generateCurlExample(path, method, operation)}
                                </code>
                              </pre>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                                onClick={() => copyToClipboard(generateCurlExample(path, method, operation), pathKey)}
                              >
                                {copiedCode === pathKey ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
