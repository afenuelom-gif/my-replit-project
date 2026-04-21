import { useEffect, useRef, useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { initAuth } from "@/lib/auth-fetch";
import { ClerkAuthActionsProvider, Auth0AuthActionsProvider } from "@/contexts/auth-actions";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Start from "@/pages/start";
import Interview from "@/pages/interview";
import Report from "@/pages/report";
import History from "@/pages/history";
import Pricing from "@/pages/pricing";
import Contact from "@/pages/contact";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import AdminFeedback from "@/pages/admin-feedback";
import AdminUsers from "@/pages/admin-users";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.PROD
  ? `${window.location.origin}/api/__clerk`
  : import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const auth0ClientId: string = import.meta.env.VITE_AUTH0_CLIENT_ID ?? "";
const auth0Domain: string = import.meta.env.VITE_AUTH0_DOMAIN ?? "";
const IS_REPLIT_DEV: boolean = import.meta.env.VITE_IS_REPLIT === true || import.meta.env.DEV === true;
const USE_AUTH0 = !IS_REPLIT_DEV && Boolean(auth0ClientId && auth0Domain);

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function useDevMode() {
  const [bypassActive, setBypassActive] = useState(false);
  useEffect(() => {
    fetch("/api/dev/status")
      .then((r) => r.json())
      .then((data: { bypassActive?: boolean }) => {
        setBypassActive(data.bypassActive === true);
      })
      .catch(() => {});
  }, []);
  return bypassActive;
}

function DevModeBanner() {
  const bypassActive = useDevMode();
  if (!bypassActive) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-400 text-yellow-900 text-center text-sm font-semibold py-1.5 px-4">
      Dev Mode — auth bypassed
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auth0 Components
// ---------------------------------------------------------------------------

function Auth0LoadingGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth0();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background" />
    );
  }
  return <>{children}</>;
}

function Auth0TokenSetup() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const qc = useQueryClient();
  const prevAuthRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    if (isAuthenticated) {
      const getter = async () => {
        try {
          return await getAccessTokenSilently();
        } catch {
          return null;
        }
      };
      initAuth(getter);
    } else {
      initAuth(null);
    }

    if (prevAuthRef.current !== undefined && prevAuthRef.current !== isAuthenticated) {
      qc.clear();
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, getAccessTokenSilently, qc]);

  return null;
}

function Auth0UserMenu() {
  const { user, isAuthenticated, loginWithRedirect } = useAuth0();

  return (
    <div className="flex items-center">
      {isAuthenticated ? (
        <span className="text-sm font-medium text-slate-600 truncate max-w-[120px]">
          {user?.given_name ?? user?.name ?? user?.email ?? "Account"}
        </span>
      ) : (
        <button
          className="cursor-pointer text-sm text-slate-600 font-medium hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
          onClick={() => loginWithRedirect()}
        >
          Sign In
        </button>
      )}
    </div>
  );
}

function Auth0MobileActions() {
  const { isAuthenticated, logout } = useAuth0();
  const [, setLocation] = useLocation();

  if (!isAuthenticated) return null;

  return (
    <>
      <button
        className="cursor-pointer flex items-center w-full px-4 py-2.5 text-sm font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 transition-colors text-left"
        onClick={() => setLocation("/history")}
      >
        History
      </button>
      <button
        className="cursor-pointer flex items-center w-full px-4 py-2.5 text-sm font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 transition-colors text-left"
        onClick={() =>
          logout({ logoutParams: { returnTo: window.location.origin + basePath || window.location.origin } })
        }
      >
        Sign Out
      </button>
    </>
  );
}

function Auth0DesktopActions() {
  const { isAuthenticated, logout } = useAuth0();
  const [, setLocation] = useLocation();

  if (!isAuthenticated) return null;

  return (
    <div className="hidden sm:flex items-center gap-1">
      <button
        className="cursor-pointer text-sm font-medium text-slate-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
        onClick={() => setLocation("/history")}
      >
        History
      </button>
      <button
        className="cursor-pointer text-sm font-medium text-slate-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
        onClick={() =>
          logout({ logoutParams: { returnTo: window.location.origin + basePath || window.location.origin } })
        }
      >
        Sign Out
      </button>
    </div>
  );
}

function Auth0StartRoute() {
  const bypassActive = useDevMode();
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  if (bypassActive) return <Start />;
  if (isLoading) return null;

  const authMenu = <><Auth0UserMenu /><Auth0DesktopActions /></>;
  const authMobileMenu = <Auth0MobileActions />;

  if (isAuthenticated) {
    return <Start authMenu={authMenu} authMobileMenu={authMobileMenu} />;
  }

  return (
    <Start
      showAuthPrompt
      authMenu={authMenu}
      authMobileMenu={authMobileMenu}
    />
  );
}

function Auth0SignInRedirect() {
  const { loginWithRedirect } = useAuth0();
  useEffect(() => {
    loginWithRedirect();
  }, [loginWithRedirect]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-slate-500 text-sm">Redirecting to sign in…</p>
    </div>
  );
}

function Auth0ProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      authorizationParams={{
        redirect_uri: window.location.origin + (basePath || ""),
      }}
      onRedirectCallback={(appState) => {
        const returnTo = appState?.returnTo as string | undefined;
        setLocation(returnTo ? stripBase(returnTo) : "/");
      }}
    >
      <Auth0AuthActionsProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Auth0TokenSetup />
          <Auth0LoadingGate>
          <DevModeBanner />
          <Switch>
            <Route
              path="/"
              component={() => (
                <Home
                  authMenu={<><Auth0UserMenu /><Auth0DesktopActions /></>}
                  authMobileMenu={<Auth0MobileActions />}
                />
              )}
            />
            <Route
              path="/pricing"
              component={() => (
                <Pricing
                  authMenu={<><Auth0UserMenu /><Auth0DesktopActions /></>}
                  authMobileMenu={<Auth0MobileActions />}
                />
              )}
            />
            <Route
              path="/contact"
              component={() => (
                <Contact
                  authMenu={<><Auth0UserMenu /><Auth0DesktopActions /></>}
                  authMobileMenu={<Auth0MobileActions />}
                />
              )}
            />
            <Route path="/start" component={Auth0StartRoute} />
            <Route path="/sign-in/*?" component={Auth0SignInRedirect} />
            <Route path="/sign-up/*?" component={Auth0SignInRedirect} />
            <Route path="/interview/:sessionId" component={Interview} />
            <Route path="/report/:sessionId" component={Report} />
            <Route path="/history" component={History} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/terms" component={Terms} />
            <Route path="/admin/feedback" component={AdminFeedback} />
            <Route path="/admin/users" component={AdminUsers} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
          </Auth0LoadingGate>
        </TooltipProvider>
      </QueryClientProvider>
      </Auth0AuthActionsProvider>
    </Auth0Provider>
  );
}

// ---------------------------------------------------------------------------
// Clerk Components
// ---------------------------------------------------------------------------

function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkUserMenu() {
  const { user } = useUser();
  const { openSignIn } = useClerk();

  return (
    <div className="flex items-center">
      <Show when="signed-in">
        <span className="text-sm font-medium text-slate-600 truncate max-w-[120px]">
          {user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress ?? "Account"}
        </span>
      </Show>
      <Show when="signed-out">
        <button
          className="cursor-pointer text-sm text-slate-600 font-medium hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
          onClick={() => openSignIn()}
        >
          Sign In
        </button>
      </Show>
    </div>
  );
}

function ClerkMobileActions() {
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  return (
    <Show when="signed-in">
      <button
        className="cursor-pointer flex items-center w-full px-4 py-2.5 text-sm font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 transition-colors text-left"
        onClick={() => setLocation("/history")}
      >
        History
      </button>
      <button
        className="cursor-pointer flex items-center w-full px-4 py-2.5 text-sm font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 transition-colors text-left"
        onClick={() => signOut({ redirectUrl: window.location.href })}
      >
        Sign Out
      </button>
    </Show>
  );
}

function ClerkDesktopActions() {
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  return (
    <Show when="signed-in">
      <div className="hidden sm:flex items-center gap-1">
        <button
          className="cursor-pointer text-sm font-medium text-slate-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          onClick={() => setLocation("/history")}
        >
          History
        </button>
        <button
          className="cursor-pointer text-sm font-medium text-slate-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          onClick={() => signOut({ redirectUrl: window.location.href })}
        >
          Sign Out
        </button>
      </div>
    </Show>
  );
}

function ClerkStartRoute() {
  const bypassActive = useDevMode();

  if (bypassActive) {
    return <Start />;
  }

  return (
    <>
      <Show when="signed-in">
        <Start
          authMenu={<><ClerkUserMenu /><ClerkDesktopActions /></>}
          authMobileMenu={<ClerkMobileActions />}
        />
      </Show>
      <Show when="signed-out">
        <Start
          showAuthPrompt
          authMenu={<><ClerkUserMenu /><ClerkDesktopActions /></>}
          authMobileMenu={<ClerkMobileActions />}
        />
      </Show>
    </>
  );
}

function ClerkTokenSetup() {
  const clerk = useClerk();

  useEffect(() => {
    function syncToken() {
      if (clerk.user) {
        initAuth(async () => {
          try {
            return await clerk.session?.getToken() ?? null;
          } catch {
            return null;
          }
        });
      } else {
        initAuth(null);
      }
    }

    syncToken();
    const unsubscribe = clerk.addListener(() => syncToken());
    return unsubscribe;
  }, [clerk]);

  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkAuthActionsProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkTokenSetup />
          <ClerkQueryClientCacheInvalidator />
          <DevModeBanner />
          <Switch>
            <Route path="/" component={() => <Home authMenu={<><ClerkUserMenu /><ClerkDesktopActions /></>} authMobileMenu={<ClerkMobileActions />} />} />
            <Route path="/pricing" component={() => <Pricing authMenu={<><ClerkUserMenu /><ClerkDesktopActions /></>} authMobileMenu={<ClerkMobileActions />} />} />
            <Route path="/contact" component={() => <Contact authMenu={<><ClerkUserMenu /><ClerkDesktopActions /></>} authMobileMenu={<ClerkMobileActions />} />} />
            <Route path="/start" component={ClerkStartRoute} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/interview/:sessionId" component={Interview} />
            <Route path="/report/:sessionId" component={Report} />
            <Route path="/history" component={History} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/terms" component={Terms} />
            <Route path="/admin/feedback" component={AdminFeedback} />
            <Route path="/admin/users" component={AdminUsers} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
      </ClerkAuthActionsProvider>
    </ClerkProvider>
  );
}

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------

function App() {
  if (USE_AUTH0) {
    return (
      <WouterRouter base={basePath}>
        <Auth0ProviderWithRoutes />
      </WouterRouter>
    );
  }

  if (!clerkPubKey) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <DevModeBanner />
            <Switch>
              <Route path="/" component={() => <Home />} />
              <Route path="/pricing" component={() => <Pricing />} />
              <Route path="/contact" component={() => <Contact />} />
              <Route path="/start" component={() => <Start />} />
              <Route path="/interview/:sessionId" component={Interview} />
              <Route path="/report/:sessionId" component={Report} />
              <Route path="/history" component={() => <Redirect to="/" />} />
              <Route path="/privacy" component={Privacy} />
              <Route path="/terms" component={Terms} />
              <Route path="/admin/feedback" component={AdminFeedback} />
              <Route path="/admin/users" component={AdminUsers} />
              <Route component={NotFound} />
            </Switch>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
