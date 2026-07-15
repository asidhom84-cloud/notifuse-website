# Notifuse Website

Public marketing site for the **Noti** family of apps. Deployed from this repository to [notifuse.net](https://notifuse.net) via GitHub Pages.

## Routes

| URL | File |
|-----|------|
| `/` | `index.html` — app hub homepage |
| `/notifuse/` | `notifuse/index.html` — Notifuse product page |
| `/privacy.html` | Privacy Policy |
| `/terms.html` | Terms of Use |
| `/notifuse-delete-account.html` | Account deletion instructions (store compliance) |

## Preview locally

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

## Deployment

GitHub Pages deploys from the `main` branch, `/(root)`. Do not remove `CNAME` (`notifuse.net`).
