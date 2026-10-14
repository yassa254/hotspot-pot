# AirPulse Hotspot — live deployment

Static operator site plus MikroTik captive-portal files. Hotspot clients only see the portal. Dashboard, routers, and the payment database require administrator login.

## Default operator login

- Page: `/admin-login.html` or `/admin`
- Username: `admin`
- Password: `AirPulse#Admin`

Change this on the dashboard immediately after first sign-in. Session lasts 12 hours in the browser tab.

## What clients see (MikroTik)

Upload these files into the router **Files → hotspot** folder (the HTML directory set on the hotspot profile):

| File | Role |
| --- | --- |
| `login.html` | Captive portal (plans, M-Pesa, voucher / username login) |
| `alogin.html` | After successful login |
| `status.html` | Live session status |
| `logout.html` | Logged-out page |
| `error.html` | Login / gateway errors |
| `rlogin.html` | Already-logged-in redirect |
| `style.css` | Portal styles |
| `script.js` | Portal logic |
| `md5.js` | HTTP-CHAP password hash |

Do **not** upload `dashboard.html`, `devices.html`, `database.html`, `admin-login.html`, or `auth.js` to the router.

WinBox path: **IP → Hotspot → Server Profiles → html-directory = hotspot**.

On the router, clients authenticate with HTTP PAP/CHAP against hotspot users/vouchers. The portal posts to `$(link-login-only)`.

## What operators see (hosted site)

Host the whole folder on Netlify, Vercel, GitHub Pages, or any Apache/Nginx static host.

- Public preview of the portal: `index.html`
- Operator gate: `admin-login.html`
- Locked pages: `dashboard.html`, `devices.html`, `database.html`

Clients on Wi-Fi never get those links. Opening a locked URL without a valid login redirects to the operator sign-in page.

This is a static site: the login gate runs in the browser. For stronger protection on Apache, add HTTP Basic Auth in front of the admin HTML files.

## Host on Netlify

1. Drag this folder onto [Netlify Drop](https://app.netlify.com/drop), or connect the git repo.
2. Publish directory is the project root (`netlify.toml` is already set).
3. Open `https://your-site.netlify.app/admin-login.html`.

## Host on Vercel

Import the folder. `vercel.json` rewrites `/admin` to the operator login.

## Host on Apache

Document root = this folder. `.htaccess` disables directory listing and maps `/admin` to the login page.

## MikroTik checklist

1. Enable hotspot on the LAN / Wi-Fi bridge.
2. Copy the portal files listed above into `hotspot`.
3. Paste the 1-click script from the Routers page (after admin login) into the WinBox terminal.
4. Create trial or voucher users that match the plan profiles (`12h-pass`, `24h-pass`, …).
5. Walled-garden Safaricom / M-Pesa hosts if you use live STK.
6. Point `dns-name` at the hotspot DNS clients actually open.

M-Pesa STK in this pack is a front-end flow until you wire a live Tuma/Daraja callback that creates the hotspot user. After payment, **Start Browsing** submits the voucher PIN to MikroTik when the page is served by the router.
