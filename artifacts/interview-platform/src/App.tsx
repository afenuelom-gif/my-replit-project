import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Interview from "@/pages/interview";
import Report from "@/pages/report";
import History from "@/pages/history";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkUserMenu() {
  const { user } = useUser();
  const { signOut, openSignIn } = useClerk();
  const [, setLocation] = useLocation();

  return (
    <div className="flex items-center gap-2">
      <Show when="signed-in">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress ?? "Account"}
          </span>
          <button
            className="text-sm text-muted-foreground hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 transition-colors"
            onClick={() => setLocation("/history")}
          >
            History
          </button>
          <button
            className="text-sm text-muted-foreground hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 transition-colors"
            onClick={() => signOut({ redirectUrl: window.location.href })}
          >
            Sign Out
          </button>
        </div>
      </Show>
      <Show when="signed-out">
        <button
          className="text-sm text-muted-foreground hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
          onClick={() => openSignIn()}
        >
          Sign In
        </button>
      </Show>
    </div>
  );
}

function HistoryRoute() {
  return (
    <>
      <Show when="signed-in">
        <History />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
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
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <Switch>
            <Route path="/" component={() => <Home authMenu={<ClerkUserMenu />} />} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/interview/:sessionId" component={Interview} />
            <Route path="/report/:sessionId" component={Report} />
            <Route path="/history" component={HistoryRoute} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  if (!clerkPubKey) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/interview/:sessionId" component={Interview} />
              <Route path="/report/:sessionId" component={Report} />
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
