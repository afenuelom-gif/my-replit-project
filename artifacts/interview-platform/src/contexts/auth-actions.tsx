import { createContext, useContext, type ReactNode } from "react";
import { useClerk } from "@clerk/react";
import { useAuth0 } from "@auth0/auth0-react";

interface AuthActions {
  signIn: (opts?: { redirectUrl?: string }) => void;
  signUp: (opts?: { redirectUrl?: string }) => void;
}

const AuthActionsContext = createContext<AuthActions>({
  signIn: () => {},
  signUp: () => {},
});

export function useAuthActions(): AuthActions {
  return useContext(AuthActionsContext);
}

export function ClerkAuthActionsProvider({ children }: { children: ReactNode }) {
  const { openSignIn, openSignUp } = useClerk();

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
  };

  return <AuthActionsContext.Provider value={value}>{children}</AuthActionsContext.Provider>;
}

export function Auth0AuthActionsProvider({ children }: { children: ReactNode }) {
  const { loginWithRedirect } = useAuth0();

  const value: AuthActions = {
    signIn: () => loginWithRedirect(),
    signUp: () =>
      loginWithRedirect({ authorizationParams: { screen_hint: "signup" } }),
  };

  return <AuthActionsContext.Provider value={value}>{children}</AuthActionsContext.Provider>;
}
