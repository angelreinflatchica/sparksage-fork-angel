import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: credentials.password })
          })

          if (!res.ok) return null
          const data = await res.json()

          return {
            id: "admin",
            name: "Admin",
            token: data.access_token,
            expires: data.expires_at
          }
        } catch (err) {
          console.error("Authorize error:", err)
          return null
        }
      }
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.token
        token.expires = user.expires
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.expires = token.expires
      return session
    }
  }
})