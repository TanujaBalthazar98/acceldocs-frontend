import { useState, useEffect, useCallback } from 'react';
import { invokeFunction } from '@/lib/api/functions';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
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

export function useConnectors(projectId?: string | null): UseConnectorsResult {
  const { user } = useAuth();
  const { permissions, role } = usePermissions(projectId || null);
  
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Fetch organization ID for current user
  useEffect(() => {
    const fetchOrgId = async () => {
      if (!user) return;

      const { data, error } = await invokeFunction<{
        organizationId?: string | number;
        organization?: { id?: string | number };
        id?: string | number;
      }>("ensure-workspace", {
        body: {},
      });
      const resolvedOrgId = data?.organizationId ?? data?.organization?.id ?? data?.id;
      if (!error && resolvedOrgId) {
        setOrganizationId(String(resolvedOrgId));
      }
    };
    fetchOrgId();
  }, [user]);

  const fetchConnectors = useCallback(async () => {
    if (!organizationId) {
      setConnectors([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setConnectors([]);
    } catch (err) {
      console.error('Error fetching connectors:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch connectors');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

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
    if (!organizationId || !user) {
      toast.error('Not authenticated or no organization');
      return null;
    }
    toast.error('Connectors are not available in Strapi mode yet.');
    return null;

  }, [organizationId, user]);

  const updateConnector = useCallback(async (
    id: string, 
    updates: Partial<Connector>
  ): Promise<boolean> => {
    if (!user) return false;
    toast.error('Connectors are not available in Strapi mode yet.');
    return false;
  }, [user]);

  const deleteConnector = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;
    toast.error('Connectors are not available in Strapi mode yet.');
    return false;
  }, [user]);

  const enableConnector = useCallback(async (id: string): Promise<boolean> => {
    return updateConnector(id, { is_enabled: true, status: 'connected' });
  }, [updateConnector]);

  const disableConnector = useCallback(async (id: string): Promise<boolean> => {
    return updateConnector(id, { is_enabled: false, status: 'disconnected' });
  }, [updateConnector]);

  const testConnection = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };
    return { success: false, error: 'Connectors are not available yet.' };
  }, [user]);

  const executeAction = useCallback(async (
    connectorId: string,
    actionType: string,
    params: Record<string, unknown>
  ): Promise<ConnectorAction | null> => {
    toast.error('Connectors are not available in Strapi mode yet.');
    return null;
  }, []);

  const getConnectorActions = useCallback(async (
    connectorId: string, 
    limit = 50
  ): Promise<ConnectorAction[]> => {
    return [];
  }, []);

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
