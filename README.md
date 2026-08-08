# My Trimble Extension

This project registers **My Trimble Extension** in the Trimble Connect project
left navigation. Its **Assignment** submenu is activated when the extension is
enabled in the project.

## Local deployment

1. Install dependencies:

```bash
npm install
```

2. Start the local server:

```bash
npm run start
```

3. Deploy the site to the HTTPS URL in `manifest.json`. The included GitHub
   Pages workflow deploys the site after a push to `main`; in the repository
   settings, set **Pages → Source** to **GitHub Actions** before the first run.
4. In the Trimble Connect project, open **Settings → Extensions**, add or edit
   the extension with the deployed manifest URL, and enable it. Reload the
   project page; the extension connects to the host and registers its left
   navigation item automatically.

`http://localhost:8080` is useful for development only; a live project must be
able to load the extension URL over HTTPS.

Edited
