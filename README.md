# Noti Family Website

Public marketing site for **Noti Family**. Production GitHub Pages still serves **[notifuse.net](https://notifuse.net)** from branch `main`.

This branch (`notifamily-domain-migration`) prepares the Noti Family site for `https://notifamily.net` **without** changing the live custom domain.

**Do not merge to `main` until authorized.**  
**Do not change the `CNAME` file from `notifuse.net` until DNS cutover is authorized.**  
GitHub Pages allows only **one** custom domain per site. Replacing `CNAME` on `main` would stop `notifuse.net` from being the Pages custom domain.

## Routes

| URL | File |
|-----|------|
| `/` | `index.html` — Noti Family company homepage |
| `/notisignal/` | `notisignal/index.html` — NotiSignal product page |
| `/notibus/` | `notibus/index.html` — NotiBus coming soon |
| `/notibus/privacy/` | NotiBus Privacy Policy |
| `/notibus/terms/` | NotiBus Terms of Service |
| `/notifuse/` | HTML fallback redirect to `/notisignal/` |
| `/privacy.html` | NotiSignal Privacy Policy |
| `/terms.html` | NotiSignal Terms of Use |
| `/notifuse-delete-account.html` | Account deletion (store compliance URL) |

Canonical URLs in HTML already use `https://notifamily.net`. They are ready for cutover; they are not live until DNS and the Pages custom domain switch.

## Preview locally

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

## GitHub Pages notes

- Source: `main`, `/(root)` — this branch is **not** published.
- `CNAME` on this branch remains `notifuse.net` so a premature merge would not take `notifuse.net` offline.
- `_redirects` is for Cloudflare/Netlify later. GitHub Pages ignores it. Same-host `/notifuse/` uses the HTML stub plus `404.html`.
- Apex + `www` of **one** domain is supported. `notifuse.net` and `notifamily.net` cannot both be the Pages custom domain. After cutover, 301 `notifuse.net` from DNS/Cloudflare/Vercel.

Pure HTML, CSS, and JavaScript — no build step.
