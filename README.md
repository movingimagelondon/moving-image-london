# moving image london

Artists' film and video in London: exhibitions and screenings.

- `index.html`, `app.js`: the public site (static, no build step).
- `/admin` redirects to the private admin page on claude.ai.
- `listings.json`: approved listings, exported from the editor page each morning. Don't edit by hand; changes are overwritten by the next export.
- Visitor submissions (listings and venue suggestions) go to Web3Forms, which emails them to the editor. The access key in index.html is public by design.
- `netlify/functions/listings.mjs` serves live listings at `/api/listings` from Netlify Blobs. The publish task hands new listings over in `MIL_LISTINGS_*` environment variables (via the Netlify connector); the function moves them into Blobs on the next request and deletes the variables. Needs a `NETLIFY_API_TOKEN` env var (secret). `listings.json` is the fallback.
- `tools/build_payload.py` turns the editor's listings into those environment variables.
