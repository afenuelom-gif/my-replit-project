import { useEffect, useRef, useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Start from "@/pages/start";
import Interview from "@/pages/interview";
import Report from "@/pages/report";
import History from "@/pages/history";
import Pricing from "@/pages/pricing";
import Contact from "@/pages/contact";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

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
  const { openSignIn } = useClerk();

  return (
    <div className="flex items-center">
      <Show when="signed-in">
        <span className="text-sm text-muted-foreground truncate max-w-[120px]">
          {user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress ?? "Account"}
        </span>
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

function ClerkMobileActions() {
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  return (
    <Show when="signed-in">
      <button
        className="flex items-center w-full px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors text-left"
        onClick={() => setLocation("/history")}
      >
        History
      </button>
      <button
        className="flex items-center w-full px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors text-left"
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
          className="text-sm text-muted-foreground hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
          onClick={() => setLocation("/history")}
        >
          History
        </button>
        <button
          className="text-sm text-muted-foreground hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
          onClick={() => signOut({ redirectUrl: window.location.href })}
        >
          Sign Out
        </button>
      </div>
    </Show>
  );
}

function StartRoute() {
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
        <Redirect to="/sign-up" />
      </Show>
    </>
  );
}

function HistoryRoute() {
  const bypassActive = useDevMode();

  if (bypassActive) {
    return <History />;
  }

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
          <DevModeBanner />
          <Switch>
            <Route path="/" component={() => <Home authMenu={<><ClerkUserMenu /><ClerkDesktopActions /></>} authMobileMenu={<ClerkMobileActions />} />} />
            <Route path="/pricing" component={() => <Pricing authMenu={<><ClerkUserMenu /><ClerkDesktopActions /></>} authMobileMenu={<ClerkMobileActions />} />} />
            <Route path="/contact" component={() => <Contact authMenu={<><ClerkUserMenu /><ClerkDesktopActions /></>} authMobileMenu={<ClerkMobileActions />} />} />
            <Route path="/start" component={StartRoute} />
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
            <DevModeBanner />
            <Switch>
              <Route path="/" component={() => <Home />} />
              <Route path="/pricing" component={() => <Pricing />} />
              <Route path="/contact" component={() => <Contact />} />
              <Route path="/start" component={() => <Start />} />
              <Route path="/interview/:sessionId" component={Interview} />
              <Route path="/report/:sessionId" component={Report} />
              <Route path="/history" component={() => <Redirect to="/" />} />
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
