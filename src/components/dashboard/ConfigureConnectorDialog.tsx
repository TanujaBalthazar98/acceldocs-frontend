import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Shield, Key, Settings } from 'lucide-react';
import { useConnectors } from '@/hooks/useConnectors';
import { Connector, CONNECTOR_DEFINITIONS } from '@/lib/connectors/types';
import { toast } from 'sonner';

interface ConfigureConnectorDialogProps {
  connector: Connector;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RolePermission {
  role: string;
  can_view: boolean;
  can_use: boolean;
  can_configure: boolean;
}

export function ConfigureConnectorDialog({
  connector,
  projectId,
  open,
  onOpenChange,
}: ConfigureConnectorDialogProps) {
  const { updateConnector, testConnection } = useConnectors(projectId);
  const definition = CONNECTOR_DEFINITIONS.find(d => d.type === connector.connector_type);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<Record<string, any>>(connector.metadata || {});
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [permissions, setPermissions] = useState<RolePermission[]>([
    { role: 'admin', can_view: true, can_use: true, can_configure: true },
    { role: 'editor', can_view: true, can_use: true, can_configure: false },
    { role: 'reviewer', can_view: true, can_use: false, can_configure: false },
    { role: 'viewer', can_view: false, can_use: false, can_configure: false },
  ]);

  useEffect(() => {
    // Load existing permissions
    const loadPermissions = async () => {
      return;
    };
    
    if (open) {
      loadPermissions();
      setConfig(connector.metadata || {});
    }
  }, [open, connector.id, connector.metadata]);

  const handleSave = async () => {
    setSaving(true);
    try {
      toast.error('Connectors are not available in Strapi mode yet.');
      return;
    } catch (err) {
      console.error('Error saving connector config:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    const result = await testConnection(connector.id);
    setTesting(false);
    
    if (result.success) {
      toast.success('Connection test successful');
    } else {
      toast.error(`Connection test failed: ${result.error}`);
    }
  };

  const updatePermission = (role: string, field: keyof RolePermission, value: boolean) => {
    setPermissions(prev => prev.map(p => 
      p.role === role ? { ...p, [field]: value } : p
    ));
  };

  const renderConfigFields = () => {
    if (!definition) return null;

    switch (connector.connector_type) {
      case 'atlassian':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site_url">Atlassian Site URL</Label>
              <Input
                id="site_url"
                placeholder="https://your-domain.atlassian.net"
                value={config.site_url || ''}
                onChange={(e) => setConfig({ ...config, site_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cloud_id">Cloud ID</Label>
              <Input
                id="cloud_id"
                placeholder="Your Atlassian Cloud ID"
                value={config.cloud_id || ''}
                onChange={(e) => setConfig({ ...config, cloud_id: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="jira_enabled">Enable Jira Integration</Label>
              <Switch
                id="jira_enabled"
                checked={config.jira_enabled !== false}
                onCheckedChange={(checked) => setConfig({ ...config, jira_enabled: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="confluence_enabled">Enable Confluence Integration</Label>
              <Switch
                id="confluence_enabled"
                checked={config.confluence_enabled !== false}
                onCheckedChange={(checked) => setConfig({ ...config, confluence_enabled: checked })}
              />
            </div>
          </div>
        );

      case 'claude':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select
                value={config.model || 'claude-3-sonnet-20240229'}
                onValueChange={(value) => setConfig({ ...config, model: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-3-sonnet-20240229">Claude 3 Sonnet</SelectItem>
                  <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                  <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_tokens">Max Tokens</Label>
              <Input
                id="max_tokens"
                type="number"
                value={config.max_tokens || 4096}
                onChange={(e) => setConfig({ ...config, max_tokens: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature</Label>
              <Input
                id="temperature"
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={config.temperature || 0.7}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
              />
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-primary" />
                <span className="font-medium">Page-Scoped Access Only</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Claude can only access documents the user has permission to view. 
                No global corpus access is allowed.
              </p>
            </div>
          </div>
        );

      case 'custom_mcp':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="endpoint_url">MCP Endpoint URL</Label>
              <Input
                id="endpoint_url"
                placeholder="https://your-mcp-server.com/api/mcp"
                value={config.endpoint_url || ''}
                onChange={(e) => setConfig({ ...config, endpoint_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth_type">Authentication Type</Label>
              <Select
                value={config.auth_type || 'api_key'}
                onValueChange={(value) => setConfig({ ...config, auth_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="oauth">OAuth 2.0</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeout_ms">Timeout (ms)</Label>
              <Input
                id="timeout_ms"
                type="number"
                value={config.timeout_ms || 30000}
                onChange={(e) => setConfig({ ...config, timeout_ms: parseInt(e.target.value) })}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure {connector.name}</DialogTitle>
          <DialogDescription>
            Set up your connector configuration, credentials, and permissions.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="config" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config">
              <Settings className="h-4 w-4 mr-2" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="credentials">
              <Key className="h-4 w-4 mr-2" />
              Credentials
            </TabsTrigger>
            <TabsTrigger value="permissions">
              <Shield className="h-4 w-4 mr-2" />
              Permissions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="mt-4">
            {renderConfigFields()}
          </TabsContent>

          <TabsContent value="credentials" className="mt-4 space-y-4">
            {connector.connector_type === 'atlassian' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="api_email">API Email</Label>
                  <Input
                    id="api_email"
                    type="email"
                    placeholder="your-email@domain.com"
                    value={credentials.api_email || ''}
                    onChange={(e) => setCredentials({ ...credentials, api_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api_token">API Token</Label>
                  <Input
                    id="api_token"
                    type="password"
                    placeholder="Your Atlassian API token"
                    value={credentials.api_token || ''}
                    onChange={(e) => setCredentials({ ...credentials, api_token: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Generate an API token from your Atlassian account settings.
                  </p>
                </div>
              </>
            )}

            {connector.connector_type === 'claude' && (
              <div className="space-y-2">
                <Label htmlFor="anthropic_api_key">Anthropic API Key</Label>
                <Input
                  id="anthropic_api_key"
                  type="password"
                  placeholder="sk-ant-..."
                  value={credentials.anthropic_api_key || ''}
                  onChange={(e) => setCredentials({ ...credentials, anthropic_api_key: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from the Anthropic Console.
                </p>
              </div>
            )}

            {connector.connector_type === 'custom_mcp' && config.auth_type === 'api_key' && (
              <div className="space-y-2">
                <Label htmlFor="api_key">API Key</Label>
                <Input
                  id="api_key"
                  type="password"
                  placeholder="Your API key"
                  value={credentials.api_key || ''}
                  onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
                />
              </div>
            )}

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                Credentials are encrypted and stored securely. Only project admins can view or modify them.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="mt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure which roles can access and use this connector.
              </p>

              <div className="border rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-medium">Role</th>
                      <th className="text-center p-3 text-sm font-medium">View</th>
                      <th className="text-center p-3 text-sm font-medium">Use</th>
                      <th className="text-center p-3 text-sm font-medium">Configure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissions.map(perm => (
                      <tr key={perm.role} className="border-b last:border-0">
                        <td className="p-3">
                          <Badge variant="outline" className="capitalize">{perm.role}</Badge>
                        </td>
                        <td className="text-center p-3">
                          <Switch
                            checked={perm.can_view}
                            onCheckedChange={(v) => updatePermission(perm.role, 'can_view', v)}
                            disabled={perm.role === 'admin'}
                          />
                        </td>
                        <td className="text-center p-3">
                          <Switch
                            checked={perm.can_use}
                            onCheckedChange={(v) => updatePermission(perm.role, 'can_use', v)}
                            disabled={perm.role === 'admin'}
                          />
                        </td>
                        <td className="text-center p-3">
                          <Switch
                            checked={perm.can_configure}
                            onCheckedChange={(v) => updatePermission(perm.role, 'can_configure', v)}
                            disabled={perm.role === 'admin'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-muted rounded-lg space-y-1">
                <p className="text-xs text-muted-foreground">
                  <strong>View:</strong> Can see the connector in the integrations panel
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Use:</strong> Can execute connector actions (e.g., create Jira ticket)
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Configure:</strong> Can modify connector settings and credentials
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
