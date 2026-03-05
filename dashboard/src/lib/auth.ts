import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Password",
      credentials: {
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const password = credentials?.password as string;
        if (!password) return null;

        try {
          const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
          const res = await fetch(`${apiUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          });

          if (!res.ok) return null;

          const data = await res.json();
          return {
            id: "admin",
            name: "Admin",
            accessToken: data.access_token,
            expires: data.expires_at,
          };
        } catch (err) {
          console.error("Authorize error:", err); 
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = (user as { accessToken: string }).accessToken;
        token.expires = (user as { expires?: number }).expires;
      }
      return token;
    },
    async session({ session, token }) {
      (session as { accessToken?: string }).accessToken = token.accessToken as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});