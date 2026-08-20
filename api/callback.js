// Step 2 of the GitHub OAuth flow for Sveltia CMS (/admin).
// GitHub redirects back here with a `code`; we exchange it for an access
// token and hand that token to the CMS popup via postMessage, following the
// handshake the CMS (a Decap-compatible client) expects.
export default async function handler(req, res) {
  const { code, error, error_description: errorDescription } = req.query;

  if (error) {
    res.status(400).send(renderResult('error', { message: errorDescription || error }));
    return;
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(500).send('Server misconfigured: GitHub OAuth environment variables are missing.');
    return;
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const data = await tokenRes.json();

    if (data.error || !data.access_token) {
      res.status(400).send(renderResult('error', { message: data.error_description || 'Authenticatie mislukt.' }));
      return;
    }

    res.status(200).send(renderResult('success', { token: data.access_token, provider: 'github' }));
  } catch (e) {
    res.status(500).send(renderResult('error', { message: 'Onverwachte fout tijdens het inloggen.' }));
  }
}

function renderResult(status, payload) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  return `<!doctype html>
<html>
<body>
<script>
(function () {
  function receiveMessage(e) {
    window.opener.postMessage(${JSON.stringify(message)}, e.origin);
    window.removeEventListener('message', receiveMessage, false);
  }
  window.addEventListener('message', receiveMessage, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script>
</body>
</html>`;
}
