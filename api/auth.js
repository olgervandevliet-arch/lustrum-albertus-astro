// Step 1 of the GitHub OAuth flow for Sveltia CMS (/admin).
// Sveltia opens a popup pointed at this endpoint; we redirect it to GitHub's
// own authorize screen, with our OAuth app's client id.
export default function handler(req, res) {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;

  if (!clientId) {
    res.status(500).send('Server misconfigured: GITHUB_OAUTH_CLIENT_ID is not set.');
    return;
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = `${proto}://${host}/api/callback`;

  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', 'repo,user');

  res.writeHead(302, { Location: authorizeUrl.toString() });
  res.end();
}
