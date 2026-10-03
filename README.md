# moving image london

Artists' film and video in London: exhibitions and screenings.

- `index.html`, `app.js`: the public site (static, no build step).
- `settings.json`: colours, text size, film background and wording, edited in the admin page and exported with the listings.
- `/admin` redirects to the private admin page on claude.ai.
- `listings.json`: approved listings, exported from the editor page each morning. Don't edit by hand; changes are overwritten by the next export.
- `bg-quiet.mp4`, `bg-quiet.jpg`: background loop from *disintegrationline*.
- Visitor submissions go to Web3Forms, which emails them to the editor. The access key in index.html is public by design.
