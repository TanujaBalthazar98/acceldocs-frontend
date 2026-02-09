import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Building2, 
  Brain, 
  Plug, 
  Plus, 
  Settings, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Activity,
  Trash2,
  Sparkles
} from 'lucide-react';
import { useConnectors } from '@/hooks/useConnectors';
import { usePermissions } from '@/hooks/usePermissions';
import { 
  Connector, 
  ConnectorType, 
  CONNECTOR_DEFINITIONS 
} from '@/lib/connectors/types';
import { ConfigureConnectorDialog } from './ConfigureConnectorDialog';
import { ConnectorActionsLog } from './ConnectorActionsLog';
import { MCPActionsPanel } from './MCPActionsPanel';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface IntegrationsPanelProps {
  projectId?: string | null;
  onBack: () => void;
}

const getConnectorIcon = (type: ConnectorType) => {
  switch (type) {
    case 'atlassian':
      return <Building2 className="h-5 w-5" />;
    case 'claude':
      return <Brain className="h-5 w-5" />;
    case 'custom_mcp':
      return <Plug className="h-5 w-5" />;
    default:
      return <Plug className="h-5 w-5" />;
  }
};

const getStatusBadge = (status: string, isEnabled: boolean) => {
  if (!isEnabled) {
    return <Badge variant="secondary">Disabled</Badge>;
  }
  
  switch (status) {
    case 'connected':
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>;
    case 'error':
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
    case 'configuring':
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><AlertCircle className="h-3 w-3 mr-1" />Configuring</Badge>;
    default:
      return <Badge variant="secondary">Disconnected</Badge>;
  }
};

export function IntegrationsPanel({ projectId, onBack }: IntegrationsPanelProps) {
  const { 
    connectors, 
    loading, 
    installConnector, 
    enableConnector, 
    disableConnector, 
    deleteConnector,
    testConnection,
    canConfigureConnector 
  } = useConnectors();
  const { permissions } = usePermissions(projectId || null);
  
  const [configureConnector, setConfigureConnector] = useState<Connector | null>(null);
  const [viewActionsConnector, setViewActionsConnector] = useState<Connector | null>(null);
  const [deleteConfirmConnector, setDeleteConfirmConnector] = useState<Connector | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const installedTypes = connectors.map(c => c.connector_type);
  const availableConnectors = CONNECTOR_DEFINITIONS.filter(
    def => !installedTypes.includes(def.type)
  );

  const handleInstall = async (type: ConnectorType) => {
    const result = await installConnector(type);
    if (result) {
      setConfigureConnector(result);
    }
  };

  const handleToggleEnabled = async (connector: Connector) => {
    if (connector.is_enabled) {
      await disableConnector(connector.id);
    } else {
      await enableConnector(connector.id);
    }
  };

  const handleTestConnection = async (connector: Connector) => {
    setTestingId(connector.id);
    const result = await testConnection(connector.id);
    setTestingId(null);
    
    if (result.success) {
      toast.success('Connection test successful');
    } else {
      toast.error(`Connection test failed: ${result.error}`);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmConnector) {
      await deleteConnector(deleteConfirmConnector.id);
      setDeleteConfirmConnector(null);
    }
  };

  const canConfigure = true; // Org-level permissions now

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">Integrations</h2>
          <p className="text-sm text-muted-foreground">Connect external services via MCP</p>
        </div>
      </div>

      <Tabs defaultValue="connectors" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4 w-fit">
          <TabsTrigger value="connectors" className="gap-2">
            <Plug className="h-4 w-4" />
            Connectors
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-2">
            <Sparkles className="h-4 w-4" />
            MCP Actions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connectors" className="flex-1 mt-0">
          <ScrollArea className="flex-1 p-4">
        {/* Installed Connectors */}
        <div className="space-y-4 mb-8">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Installed Connectors
          </h3>
          
          {loading ? (
            <Card className="bg-card/50">
              <CardContent className="p-6 text-center text-muted-foreground">
                Loading connectors...
              </CardContent>
            </Card>
          ) : connectors.length === 0 ? (
            <Card className="bg-card/50">
              <CardContent className="p-6 text-center text-muted-foreground">
                No connectors installed yet. Add one from the available connectors below.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {connectors.map(connector => (
                <Card key={connector.id} className="bg-card/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          {getConnectorIcon(connector.connector_type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{connector.name}</h4>
                            {getStatusBadge(connector.status, connector.is_enabled)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {connector.description}
                          </p>
                          {connector.last_error && (
                            <p className="text-sm text-destructive mt-1">
                              Error: {connector.last_error}
                            </p>
                          )}
                          {connector.last_sync_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Last sync: {new Date(connector.last_sync_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {canConfigure && (
                          <Switch
                            checked={connector.is_enabled}
                            onCheckedChange={() => handleToggleEnabled(connector)}
                          />
                        )}
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleTestConnection(connector)}
                        disabled={testingId === connector.id}
                      >
                        <RefreshCw className={`h-4 w-4 mr-1 ${testingId === connector.id ? 'animate-spin' : ''}`} />
                        Test Connection
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setViewActionsConnector(connector)}
                      >
                        <Activity className="h-4 w-4 mr-1" />
                        View Logs
                      </Button>
                      
                      {canConfigure && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setConfigureConnector(connector)}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Configure
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmConnector(connector)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Available Connectors */}
        {canConfigure && availableConnectors.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Available Connectors
            </h3>
            
            <div className="grid gap-3">
              {availableConnectors.map(def => (
                <Card key={def.type} className="bg-card/30 border-dashed">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                          {getConnectorIcon(def.type)}
                        </div>
                        <div>
                          <h4 className="font-medium">{def.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {def.description}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {def.capabilities.slice(0, 3).map(cap => (
                              <Badge key={cap} variant="outline" className="text-xs">
                                {cap.replace(/_/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        size="sm"
                        onClick={() => handleInstall(def.type)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Install
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="actions" className="flex-1 mt-0 p-4 overflow-auto">
          <MCPActionsPanel projectId={projectId} />
        </TabsContent>
      </Tabs>

      {/* Configure Dialog */}
      {configureConnector && (
        <ConfigureConnectorDialog
          connector={configureConnector}
          projectId={projectId}
          open={!!configureConnector}
          onOpenChange={(open) => !open && setConfigureConnector(null)}
        />
      )}

      {/* Actions Log Dialog */}
      {viewActionsConnector && (
        <ConnectorActionsLog
          connector={viewActionsConnector}
          projectId={projectId}
          open={!!viewActionsConnector}
          onOpenChange={(open) => !open && setViewActionsConnector(null)}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog 
        open={!!deleteConfirmConnector} 
        onOpenChange={(open) => !open && setDeleteConfirmConnector(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connector</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the {deleteConfirmConnector?.name} connector? 
              This will remove all configuration and action history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
