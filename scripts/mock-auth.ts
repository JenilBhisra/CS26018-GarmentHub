let session: any = null;

export const auth = async () => {
  console.log("[MOCK AUTH] auth() called, returning session:", JSON.stringify(session));
  return session;
};

export function setMockSession(s: any) {
  console.log("[MOCK AUTH] setMockSession() called with:", JSON.stringify(s));
  session = s;
}
