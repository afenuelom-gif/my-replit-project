import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useClerk, useAuth } from "@clerk/react";
import { useAuth0 } from "@auth0/auth0-react";

interface AuthActions {
  signIn: (opts?: { redirectUrl?: string }) => void;
  signUp: (opts?: { redirectUrl?: string }) => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
}

const noopHeaders = async (): Promise<Record<string, string>> => ({});

const AuthActionsContext = createContext<AuthActions>({
  signIn: () => {},
  signUp: () => {},
  getAuthHeaders: noopHeaders,
});

export function useAuthActions(): AuthActions {
  return useContext(AuthActionsContext);
}

export function ClerkAuthActionsProvider({ children }: { children: ReactNode }) {
  const { openSignIn, openSignUp } = useClerk();
  const { getToken } = useAuth();

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const token = await getToken();
      if (!token) return {};
      return { Authorization: `Bearer ${token}` };
    } catch {
      return {};
    }
  }, [getToken]);

  const value: AuthActions = {
    signIn: (opts) =>
      openSignIn({
        afterSignInUrl: opts?.redirectUrl ?? window.location.href,
        afterSignUpUrl: opts?.redirectUrl ?? window.location.href,
      }),
    signUp: (opts) =>
      openSignUp({
        afterSignUpUrl: opts?.redirectUrl ?? window.location.href,
        afterSignInUrl: opts?.redirectUrl ?? window.location.href,
      }),
    getAuthHeaders,
  };

  return <AuthActionsContext.Provider value={value}>{children}</AuthActionsContext.Provider>;
}

export function Auth0AuthActionsProvider({ children }: { children: ReactNode }) {
  const { loginWithRedirect, getAccessTokenSilently } = useAuth0();

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const token = await getAccessTokenSilently();
      if (!token) return {};
      return { Authorization: `Bearer ${token}` };
    } catch (err) {
      const code = (err as { error?: string })?.error ?? (err as Error)?.message ?? "";
      const needsLogin = ["login_required", "consent_required", "missing_refresh_token", "invalid_grant"].some(
        (e) => code.includes(e),
      );
      if (needsLogin) {
        loginWithRedirect({ appState: { returnTo: window.location.pathname } });
      }
      return {};
    }
  }, [getAccessTokenSilently, loginWithRedirect]);

  const value: AuthActions = {
    signIn: () => loginWithRedirect(),
    signUp: () =>
      loginWithRedirect({ authorizationParams: { screen_hint: "signup" } }),
    getAuthHeaders,
  };

  return <AuthActionsContext.Provider value={value}>{children}</AuthActionsContext.Provider>;
}
