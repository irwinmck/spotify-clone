import NextAuth from 'next-auth';
import SpotifyProvider from 'next-auth/providers/spotify';
import { spotifyApi, LOGIN_URL } from '../../../lib/spotify';

// Function for refreshing access token from spotify.
const refreshAccessToken = async token => {
  try {
    spotifyApi.setAccessToken(token.accessToken);
    spotifyApi.setRefreshToken(token.refreshToken);
    const { body: refreshedToken } = await spotifyApi.refreshAccessToken();
    return {
      ...token,
      accessToken: refreshedToken.access_token,
      accessTokenExpires: Date.now() + refreshedToken.expires_in * 1000,
      refreshToken: refreshedToken.refresh_token ?? token.refreshToken,
    };
  } catch (err) {
    console.error(err);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
};

// NextAuth Configuration
export default NextAuth({
  // Configure one or more authentication providers
  providers: [
    SpotifyProvider({
      clientId: process.env.NEXT_PUBLIC_CLIENT_ID,
      clientSecret: process.env.NEXT_PUBLIC_CLIENT_SECRET,
      authorization: LOGIN_URL,
    }),
  ],
  secret: process.env.JWT_SECRET,
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial Sign In, if there is account & user, there is no token yet.
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          username: account.providerAccountId,
          accessTokenExpires: account.expires_at * 1000, // convert to milliseconds
        };
      }

      // If previous token has not yet expired, simply return it.
      if (Date.now() < token.accessTokenExpires) {
        console.log('Valid existing spotify auth token found. 😎');
        return token;
      }

      // Access token has expired, need to refresh it!
      console.log('Spotify auth token is expired, refreshing... 🔃');
      return await refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.user.accessToken = token.accessToken;
      session.user.refreshToken = token.refreshToken;
      session.user.username = token.username;
      return session;
    },
  },
});
