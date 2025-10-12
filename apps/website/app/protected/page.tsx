import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { 
  InfoIcon, 
  ShieldCheckIcon, 
  UserIcon, 
  ClockIcon,
  KeyIcon,
  CheckIcon
} from "lucide-react";
import { CopyButton } from "@/components/copy-button";

export default async function ProtectedPage() {
  const supabase = await createClient();

  // Lấy session hiện tại (chứa access_token = JWT)
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    redirect("/auth/login");
  }

  const jwt = session.access_token;
  const user = session.user;
  const expiresAt = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : null;

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 rounded-full mb-4">
            <ShieldCheckIcon className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-black mb-2">
            Protected Dashboard
          </h1>
          <p className="text-muted-foreground text-lg">
            Welcome to your secure, authenticated space
          </p>
        </div>

        {/* Success Alert */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <CheckIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                Authentication Successful
              </h3>
              <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                You are successfully authenticated and can access this protected content.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* User Information Card */}
          <div className="bg-card border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <UserIcon className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold">User Information</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-border/50">
                <span className="text-muted-foreground font-medium">User ID</span>
                <code className="px-3 py-1 bg-muted rounded-md text-sm font-mono">
                  {user.id}
                </code>
              </div>
              
              <div className="flex justify-between items-center py-3 border-b border-border/50">
                <span className="text-muted-foreground font-medium">Role</span>
                <span className="font-medium">{user.user_metadata.role}</span>
              </div>
            </div>
          </div>
        </div>

        {/* JWT Token Section */}
        <div className="mt-8 bg-card border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <KeyIcon className="w-5 h-5 text-orange-600" />
              </div>
              <h2 className="text-xl font-semibold">JWT Access Token</h2>
            </div>
            <CopyButton text={jwt} label="Token" />
          </div>
          
          <div className="bg-muted/30 rounded-lg p-4 border border-dashed">
            <div className="flex items-center gap-2 mb-3">
              <InfoIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Your JWT token for API authentication
              </span>
            </div>
            <pre className="text-xs font-mono bg-background border rounded-md p-4 overflow-auto max-h-40 leading-relaxed">
{jwt}
            </pre>
          </div>
          
          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <InfoIcon className="w-4 h-4 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <p className="font-medium">Security Note:</p>
                <p className="mt-1">Keep this token secure and never share it publicly. It provides full access to your authenticated resources.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Raw Session Data (Collapsible) */}
        <details className="mt-8 bg-card border rounded-xl shadow-sm group">
          <summary className="p-6 cursor-pointer hover:bg-muted/20 transition-colors rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-900/20 rounded-lg">
                <InfoIcon className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Raw Session Data</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Click to expand and view the complete session information
                </p>
              </div>
            </div>
          </summary>
          
          <div className="px-6 pb-6">
            <div className="flex justify-end mb-3">
              <CopyButton 
                text={JSON.stringify({ user: { id: user.id, email: user.email }, expiresAt }, null, 2)} 
                label="JSON" 
              />
            </div>
            <pre className="text-xs font-mono bg-muted/50 border rounded-lg p-4 overflow-auto max-h-60">
{JSON.stringify({ 
  user: { 
    id: user.id, 
    email: user.email,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at
  }, 
  expiresAt,
  tokenType: session.token_type,
  refreshToken: session.refresh_token ? '[HIDDEN FOR SECURITY]' : null,
  session
}, null, 2)}
            </pre>
          </div>
        </details>

        {/* Footer */}
        <div className="mt-12 text-center text-muted-foreground text-sm">
          <p>This protected page demonstrates successful authentication with Supabase</p>
        </div>
      </div>
    </div>
  );
}