/**
 * Simple home page for testing
 */

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuthNew';
import { UserMenu } from '@/components/UserMenuNew';

export default function HomeSimple() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b bg-white/50 dark:bg-gray-900/50 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold">AccelDocs</h1>
          <UserMenu />
        </div>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-10 md:py-20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h1 className="text-3xl md:text-5xl font-bold">
            Knowledge Workspace
          </h1>

          <p className="text-xl text-gray-600 dark:text-gray-400">
            Google Docs → Beautiful Documentation
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <Button asChild size="lg">
                <Link to="/admin">Go to Dashboard →</Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link to="/login">Sign In to Admin →</Link>
              </Button>
            )}

            <Button asChild variant="outline" size="lg">
              <Link to="/docs">View Docs</Link>
            </Button>
          </div>

          {/* Status */}
          <div className="pt-12">
            <div className="inline-block bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 md:p-6">
              <h3 className="font-semibold mb-4">System Status</h3>
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-sm">✅ Authentication System</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-sm">✅ FastAPI Backend</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <span className="text-sm">🚧 Docs Viewer (Phase 2)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <span className="text-sm">🚧 Admin Dashboard (Phase 3)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
