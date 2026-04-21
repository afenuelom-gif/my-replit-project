import { setAuthTokenGetter } from "@workspace/api-client-react";

type TokenGetter = () => Promise<string | null>;

let _origFetch: typeof fetch | null = null;
let _tokenGetter: TokenGetter | null = null;

function patchGlobalFetch(tokenGetter: TokenGetter): void {
  if (_origFetch) return;
  _origFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    let url: string;
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.href;
    } else {
      url = (input as Request).url;
    }

    const origin = window.location.origin;
    const isApiCall =
      url.startsWith("/api/") ||
      (url.startsWith(origin) && url.slice(origin.length).startsWith("/api/"));

    if (isApiCall && _tokenGetter) {
      const headers = new Headers(init?.headers ?? {});
      if (!headers.has("authorization")) {
        const token = await _tokenGetter();
        if (token) headers.set("authorization", `Bearer ${token}`);
      }
      return _origFetch!(input, { ...init, headers });
    }

    return _origFetch!(input, init);
  };
}

function restoreGlobalFetch(): void {
  if (_origFetch) {
    window.fetch = _origFetch;
    _origFetch = null;
  }
}

export function initAuth(tokenGetter: TokenGetter | null): void {
  _tokenGetter = tokenGetter;
  setAuthTokenGetter(tokenGetter);

  if (tokenGetter) {
    patchGlobalFetch(tokenGetter);
  } else {
    restoreGlobalFetch();
  }
}
