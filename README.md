# Incident Register

A small static incident archive for GitHub Pages, with separate viewer and editor
passwords. Incident titles, dates, descriptions, and media URLs are encrypted before
publishing. Each incident supports multiple hosted videos, images, and audio items.
There is no backend, GitHub login integration, or direct media-file upload.

## Try Locally

Requires Node.js 24 LTS and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, then open **Editor**. Set two different passwords:
one for viewers and one for yourself. Each must be a single word without spaces,
at least 12 characters long. Prefer a much longer password-manager-generated value,
not a dictionary word. There are no default passwords and no recovery service.

## Publish From Your Other GitHub Account

No account has been connected and nothing has been published for you. The current
VS Code GitHub login is not used by this application.

1. Open GitHub in a browser profile or private window signed into the account you
   want to use. Create a **public** repository, for example `incident-register`,
   with `main` as its default branch. A public repository supports free Pages
   hosting on GitHub Free.
2. Upload the project source, including the hidden `.github` folder, the `public`
   folder, and the npm lockfile. Do **not** upload `node_modules` or `dist`.
   If the browser upload misses `.github`, create
   `.github/workflows/deploy.yml` using GitHub's **Add file** editor and the
   deployment workflow included in this project.
3. In the repository, open **Settings > Pages** and choose **GitHub Actions** as
   the build and deployment source.
4. Open **Actions > Deploy Incident Register > Run workflow** on `main`.
   Later commits to `main` deploy automatically after tests pass.
5. Open the published URL shown in **Settings > Pages**, normally
   `https://YOUR-ACCOUNT.github.io/incident-register/`.

The build uses relative paths and works for both repository Pages sites and an
account's `YOUR-ACCOUNT.github.io` repository. A different default branch requires
updating the workflow's `branches` setting. No personal access token is needed.

## Add Or Update Incidents

1. Open **Editor** on the local or published site. On first use, create your two
   passwords. Once a catalogue is published, enter its editor password instead.
   You can also import a previously exported encrypted catalogue.
2. Add an incident title, date/time, optional location (exact address or nearest
   intersection), optional description, and one or more media items. Dates are entered in the editor's local timezone, stored as UTC, and
   displayed in each viewer's local timezone with a timezone label.
3. For each media item, select its type, enter a meaningful label, and paste its
   embed code or HTTPS media URL. **Preview media** is optional.
4. Select **Save incident**, then **Export catalogue**. Saving alone keeps the
   incident only in the current browser session. Closing an unexported editor
   can lose changes; the editor warns before leaving.
5. In the GitHub repository, replace **`public/data/incidents.enc.json`** with the
   downloaded **`incidents.enc.json`**, keeping that exact filename. Commit the
   change to `main` and wait for the deployment to finish.
6. Reload the viewer and unlock with the viewer password. Select an incident's
   date/title, then choose any of its media items. Playback uses the host's player
   or native browser controls; it does not autoplay.

The starter catalogue is an empty setup marker, not a sample incident database.
Passwords and unlocked records are not saved in browser storage. Viewers lock
after 15 minutes without a click or keypress; the editor has a manual **Lock**
button so idle editing does not silently discard work.

## Supported Media

- Video: Vimeo and YouTube player embeds or video links; direct HTTPS video URLs.
- Image: a direct HTTPS image URL or an `<img>` embed. The label is its alt text.
- Audio: direct HTTPS audio URLs or SoundCloud/Spotify player embeds.
- Additional players: Internet Archive embeds and Google Drive file-preview embeds.

Paste one embed per media item. Script-based widgets, arbitrary HTML, and arbitrary
iframe hosts are not supported. The editor extracts a media URL and reconstructs
the player rather than executing the supplied HTML. Vimeo private-link `h` values
are preserved. Hosts may still block playback based on privacy, domain, cookies,
codec support, or authentication settings. Each item includes a source link.
Configure captions/transcripts at the media host for video/audio accessibility.

## Security And Hosting Limits

- **GitHub Pages is public static hosting, not a private evidence-management
  service.** Anyone can download its source and encrypted catalogue. Use a service
  with server-side authorization for sensitive evidence, regulated records, access
  auditing, per-user accounts, immediate revocation, or enforceable download limits.
- Content uses AES-256-GCM with a random content key, independently wrapped by each
  password using PBKDF2-SHA-256 with 600,000 iterations and random salts. Exporting
  uses a fresh encryption nonce. This implementation has not had an independent
  security audit. A public encrypted file permits offline password guessing;
  password strength is essential and there is no effective server-side rate limit.
- The editor password unlocks editing locally; **GitHub repository permissions
  authorize publication**. Viewer/editor passwords are not GitHub credentials.
  Do not put passwords, plaintext incident records, or private media files in commits.
- Encryption covers incident metadata and media links, **not the externally hosted
  media itself**. Configure access at each host. Unlisted links are not authentication.
  After selection, media hosts receive ordinary requests including the viewer's IP.
  A viewer can copy decrypted content or media links and share them.
- Changing passwords creates new encryption keys for future exports, but does not
  revoke old downloads, old GitHub commits, caches, or previously shared media URLs.
  Deleting an incident likewise does not erase historical copies. Coordinate edits
  with any other editor: publishing a stale export can overwrite newer changes.
- HTTPS (or localhost) is required for browser cryptography. Open the site through
  the development server or Pages, not by double-clicking an HTML file.

## Checks

```sh
npm test
npm run build
```

The deployment workflow runs both checks. The production build contains both
viewer and editor pages and the encrypted catalogue from `public/data`.
Limits: 1,000 incidents, 30 media items per incident, and an 8 MB encrypted catalogue.