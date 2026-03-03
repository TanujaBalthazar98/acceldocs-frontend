/**
 * Admin Dashboard - Simple test version
 */

import { useAuth } from '@/hooks/useAuthNew';
import { UserMenu } from '@/components/UserMenuNew';

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold">AccelDocs Admin</h1>
          <UserMenu />
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl">
          <h2 className="text-3xl font-bold mb-4">Welcome to Admin Dashboard!</h2>

          <div className="bg-card rounded-lg shadow p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">✅ Authentication Working!</h3>
              <p className="text-muted-foreground">
                You successfully signed in with Google OAuth.
              </p>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Your Profile:</h4>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm text-gray-500">Name:</dt>
                  <dd className="font-medium">{user?.name || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Email:</dt>
                  <dd className="font-medium">{user?.email}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Role:</dt>
                  <dd>
                    <span className="inline-block px-3 py-1 rounded-full bg-primary/15 text-primary text-sm font-medium">
                      {user?.role}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">User ID:</dt>
                  <dd className="font-mono text-sm">{user?.id}</dd>
                </div>
              </dl>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Next Steps:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Phase 2: Build public docs viewer</li>
                <li>Phase 3: Build admin features (document management, approvals)</li>
                <li>Phase 4: Connect Google Drive sync</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
