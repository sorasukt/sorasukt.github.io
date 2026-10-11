# Podcast API Worker

Cloudflare Worker source for `https://api.sorasukt.com`, maintained in this repository separately from the portfolio Pages site.

## Deploy

From this directory:

```sh
npm install
npx wrangler whoami
npx wrangler deploy
```

Before deploying, verify that the Cloudflare account contains the D1 database and R2 bucket configured in `wrangler.toml`. The Worker will not create those resources automatically. If the configured D1 database ID is not present in your account, update it to the real database ID before deployment.

## Configure

1. In Auth0, create/configure an API with Identifier exactly `https://api.sorasukt.com/`.
2. Enable RBAC and **Add Permissions in the Access Token**. Assign `manage:podcasts` to the Admin role.
3. Set Worker variables `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` to your actual Auth0 tenant domain and API identifier.
4. In Cloudflare Workers & Pages, open this Worker and add the custom domain `api.sorasukt.com`.
5. In Cloudflare Pages project for `podcast.sorasukt.com`, set `PODCAST_API_ORIGIN=https://api.sorasukt.com` for Production (and Preview if used). Pages' same-origin `/api/*` proxy will then forward requests to this Worker.

Do not put Auth0 secrets in frontend variables. The Auth0 domain and API audience are identifiers, not client secrets.

## Database

Inspect `schema.sql` first. If the D1 database is confirmed to be the intended podcast database, apply the schema:

```sh
npx wrangler d1 execute sorasuktrss --remote --file=./schema.sql
```

This creates the podcast tables; it does not create the D1 database or R2 bucket.

## Test

After deployment, `GET https://api.sorasukt.com/api/health` should return JSON with `ok: true`. Public endpoints include `/api/episodes` and `/api/feeds/{show-slug}.xml`; admin endpoints require a verified Auth0 access token with `manage:podcasts`.

Deployment, custom-domain routing, database migrations, and Pages environment variables are account-side steps and are not performed by adding these source files.
