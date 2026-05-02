// Auth shim: the local-first plugin has no users. Every page sees a fixed
// "local" identity. Pages that called `await auth()` continue to work.
export async function auth() {
  return {
    user: { id: "local", email: "local", name: "Local" },
    expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export const LOCAL_USER_ID = "local";
