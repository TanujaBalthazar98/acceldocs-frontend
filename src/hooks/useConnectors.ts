import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuditLog } from '@/hooks/usePermissions';
import { 
  Connector, 
  ConnectorAction, 
  ConnectorType, 
  CONNECTOR_DEFINITIONS,
  DEFAULT_CONNECTOR_PERMISSIONS
} from '@/lib/connectors/types';
import { toast } from 'sonner';

interface UseConnectorsResult {
  connectors: Connector[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  installConnector: (type: ConnectorType, config?: Record<string, unknown>) => Promise<Connector | null>;
  updateConnector: (id: string, updates: Partial<Connector>) => Promise<boolean>;
  deleteConnector: (id: string) => Promise<boolean>;
  enableConnector: (id: string) => Promise<boolean>;
  disableConnector: (id: string) => Promise<boolean>;
  testConnection: (id: string) => Promise<{ success: boolean; error?: string }>;
  executeAction: (connectorId: string, actionType: string, params: Record<string, unknown>) => Promise<ConnectorAction | null>;
  getConnectorActions: (connectorId: string, limit?: number) => Promise<ConnectorAction[]>;
  canUseConnector: (connectorId: string) => boolean;
  canConfigureConnector: (connectorId: string) => boolean;
}

export function useConnectors(projectId: string | null): UseConnectorsResult {
  const { user } = useAuth();
  const { permissions, role } = usePermissions(projectId);
  const { logAction } = useAuditLog();
  
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnectors = useCallback(async () => {
    if (!projectId) {
      setConnectors([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('connectors')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      // Type assertion since we know the shape matches
      setConnectors((data || []) as unknown as Connector[]);
    } catch (err) {
      console.error('Error fetching connectors:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch connectors');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  const canUseConnector = useCallback((connectorId: string): boolean => {
    if (!role) return false;
    if (role === 'admin') return true;
    if (role === 'editor') return true;
    return false;
  }, [role]);

  const canConfigureConnector = useCallback((connectorId: string): boolean => {
    if (!role) return false;
    return role === 'admin';
  }, [role]);

  const installConnector = useCallback(async (
    type: ConnectorType, 
    config?: Record<string, unknown>
  ): Promise<Connector | null> => {
    if (!projectId || !user) {
      toast.error('No project selected or user not authenticated');
      return null;
    }

    if (!permissions.canEditProjectSettings) {
      toast.error('You do not have permission to install connectors');
      await logAction('unauthorized_install_connector', 'connector', null, projectId, { type }, false, 'Missing permission');
      return null;
    }

    const definition = CONNECTOR_DEFINITIONS.find(d => d.type === type);
    if (!definition) {
      toast.error('Unknown connector type');
      return null;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('connectors')
        .insert({
          project_id: projectId,
          connector_type: type,
          name: definition.name,
          description: definition.description,
          status: 'disconnected' as const,
          is_enabled: false,
          metadata: (config || {}) as any,
          created_by: user.id
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Create default permissions for all roles
      const permissionInserts = (['admin', 'editor', 'reviewer', 'viewer'] as const).map(r => ({
        connector_id: data.id,
        role: r,
        can_view: DEFAULT_CONNECTOR_PERMISSIONS[r].can_view,
        can_use: DEFAULT_CONNECTOR_PERMISSIONS[r].can_use,
        can_configure: DEFAULT_CONNECTOR_PERMISSIONS[r].can_configure
      }));

      for (const perm of permissionInserts) {
        await supabase.from('connector_permissions').insert(perm);
      }

      await logAction('install_connector', 'connector', data.id, projectId, { type, name: definition.name });
      
      toast.success(`${definition.name} connector installed`);
      await fetchConnectors();
      
      return data as unknown as Connector;
    } catch (err) {
      console.error('Error installing connector:', err);
      toast.error('Failed to install connector');
      return null;
    }
  }, [projectId, user, permissions, logAction, fetchConnectors]);

  const updateConnector = useCallback(async (
    id: string, 
    updates: Partial<Connector>
  ): Promise<boolean> => {
    if (!projectId || !user) return false;

    if (!canConfigureConnector(id)) {
      toast.error('You do not have permission to configure this connector');
      await logAction('unauthorized_update_connector', 'connector', id, projectId, updates, false, 'Missing permission');
      return false;
    }

    try {
      const { error: updateError } = await supabase
        .from('connectors')
        .update(updates as any)
        .eq('id', id);

      if (updateError) throw updateError;

      await logAction('update_connector', 'connector', id, projectId, updates);
      await fetchConnectors();
      
      toast.success('Connector updated');
      return true;
    } catch (err) {
      console.error('Error updating connector:', err);
      toast.error('Failed to update connector');
      return false;
    }
  }, [projectId, user, canConfigureConnector, logAction, fetchConnectors]);

  const deleteConnector = useCallback(async (id: string): Promise<boolean> => {
    if (!projectId || !user) return false;

    if (!canConfigureConnector(id)) {
      toast.error('You do not have permission to delete this connector');
      await logAction('unauthorized_delete_connector', 'connector', id, projectId, {}, false, 'Missing permission');
      return false;
    }

    try {
      const { error: deleteError } = await supabase
        .from('connectors')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      await logAction('delete_connector', 'connector', id, projectId);
      await fetchConnectors();
      
      toast.success('Connector deleted');
      return true;
    } catch (err) {
      console.error('Error deleting connector:', err);
      toast.error('Failed to delete connector');
      return false;
    }
  }, [projectId, user, canConfigureConnector, logAction, fetchConnectors]);

  const enableConnector = useCallback(async (id: string): Promise<boolean> => {
    return updateConnector(id, { is_enabled: true, status: 'connected' });
  }, [updateConnector]);

  const disableConnector = useCallback(async (id: string): Promise<boolean> => {
    return updateConnector(id, { is_enabled: false, status: 'disconnected' });
  }, [updateConnector]);

  const testConnection = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!projectId || !user) return { success: false, error: 'Not authenticated' };

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('mcp-connector', {
        body: {
          action: 'health_check',
          connector_id: id,
          project_id: projectId
        }
      });

      if (invokeError) throw invokeError;

      const now = new Date().toISOString();
      if (data?.success) {
        await updateConnector(id, { 
          last_health_check: now, 
          status: 'connected',
          last_error: null 
        });
        return { success: true };
      } else {
        await updateConnector(id, { 
          last_health_check: now, 
          status: 'error',
          last_error: data?.error || 'Health check failed' 
        });
        return { success: false, error: data?.error };
      }
    } catch (err) {
      console.error('Error testing connection:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [projectId, user, updateConnector]);

  const executeAction = useCallback(async (
    connectorId: string,
    actionType: string,
    params: Record<string, unknown>
  ): Promise<ConnectorAction | null> => {
    if (!projectId || !user) {
      toast.error('Not authenticated');
      return null;
    }

    if (!canUseConnector(connectorId)) {
      toast.error('You do not have permission to use this connector');
      await logAction('unauthorized_connector_action', 'connector_action', null, projectId, 
        { connector_id: connectorId, action: actionType }, false, 'Missing permission');
      return null;
    }

    const connector = connectors.find(c => c.id === connectorId);
    if (!connector?.is_enabled) {
      toast.error('Connector is not enabled');
      return null;
    }

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('mcp-connector', {
        body: {
          action: actionType,
          connector_id: connectorId,
          project_id: projectId,
          params
        }
      });

      if (invokeError) throw invokeError;

      await logAction(`connector_${actionType}`, 'connector_action', connectorId, projectId, 
        { action: actionType, params, result: data?.success ? 'success' : 'failed' });

      if (data?.action) {
        return data.action as ConnectorAction;
      }

      return null;
    } catch (err) {
      console.error('Error executing connector action:', err);
      toast.error('Failed to execute action');
      return null;
    }
  }, [projectId, user, connectors, canUseConnector, logAction]);

  const getConnectorActions = useCallback(async (
    connectorId: string, 
    limit = 50
  ): Promise<ConnectorAction[]> => {
    if (!projectId) return [];

    try {
      const { data, error: fetchError } = await supabase
        .from('connector_actions')
        .select('*')
        .eq('connector_id', connectorId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;
      
      return (data || []) as unknown as ConnectorAction[];
    } catch (err) {
      console.error('Error fetching connector actions:', err);
      return [];
    }
  }, [projectId]);

  return {
    connectors,
    loading,
    error,
    refetch: fetchConnectors,
    installConnector,
    updateConnector,
    deleteConnector,
    enableConnector,
    disableConnector,
    testConnection,
    executeAction,
    getConnectorActions,
    canUseConnector,
    canConfigureConnector
  };
}
