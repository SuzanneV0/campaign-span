// The admin page asks for the Clerk publishable key at runtime, so it lives in Vercel's settings
// rather than in the HTML. It's public by design: Clerk uses it to identify the app, not to grant access.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json({ clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY || '' });
}
