import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { useConnectors } from '@/hooks/useConnectors';
import { Connector, ConnectorAction } from '@/lib/connectors/types';

interface ConnectorActionsLogProps {
  connector: Connector;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'running':
      return <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />;
    case 'pending':
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Completed</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'running':
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Running</Badge>;
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export function ConnectorActionsLog({
  connector,
  projectId,
  open,
  onOpenChange,
}: ConnectorActionsLogProps) {
  const { getConnectorActions } = useConnectors(projectId);
  const [actions, setActions] = useState<ConnectorAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActions = async () => {
      setLoading(true);
      const data = await getConnectorActions(connector.id, 100);
      setActions(data);
      setLoading(false);
    };

    if (open) {
      loadActions();
    }
  }, [open, connector.id, getConnectorActions]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{connector.name} - Action Logs</DialogTitle>
          <DialogDescription>
            View the history of actions performed by this connector.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading action logs...
            </div>
          ) : actions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No actions have been performed yet.
            </div>
          ) : (
            <div className="space-y-4">
              {actions.map((action, index) => (
                <div key={action.id}>
                  <div className="flex items-start gap-3 p-3 bg-card/50 rounded-lg">
                    <div className="mt-0.5">
                      {getStatusIcon(action.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {action.action_type.replace(/_/g, ' ')}
                        </span>
                        {getStatusBadge(action.status)}
                        {action.duration_ms && (
                          <span className="text-xs text-muted-foreground">
                            {action.duration_ms}ms
                          </span>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(action.created_at).toLocaleString()}
                      </p>
                      
                      {action.error_message && (
                        <p className="text-sm text-destructive mt-2">
                          Error: {action.error_message}
                        </p>
                      )}
                      
                      {action.input_data && Object.keys(action.input_data).length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-muted-foreground">Input:</p>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                            {JSON.stringify(action.input_data, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      {action.output_data && Object.keys(action.output_data).length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-muted-foreground">Output:</p>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto max-h-32 overflow-y-auto">
                            {JSON.stringify(action.output_data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {index < actions.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
