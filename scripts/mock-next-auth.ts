export class AuthError extends Error {}
export const handlers = {
  GET: () => {},
  POST: () => {},
};

const NextAuth = (config: any) => {
  return {
    auth: async () => null,
    handlers: { GET: () => {}, POST: () => {} },
    signIn: async () => {},
    signOut: async () => {},
  };
};

export default NextAuth;
