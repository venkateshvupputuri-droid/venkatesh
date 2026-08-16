# Erection Sequence Planner

Trimble Connect 3D Viewer extension for locking an erection contractor, creating multiple plans, and assigning selected IFC assemblies an ordered sequence such as `2-1`, `2-2`, `2-3`.

## What is deployed where

- **Extension files**: this repository root, hosted on HTTPS (the supplied GitHub Pages URL is in `manifest.json`).
- **Planner API**: `server/`, hosted on a Node-capable HTTPS service such as Azure App Service, Render, or an internal IIS/Node server.
- **Data**: SQL Server schema in `sql/schema.sql`.

GitHub Pages cannot run the API or SQL Server. Do not register the extension until both hosts are configured.

## Production setup

1. Create an empty SQL Server database and run [`sql/schema.sql`](sql/schema.sql). Replace the three sample contractor rows with your real contractor names.
2. In `server/`, copy `.env.example` to `.env`, set the database values and exact HTTPS frontend origin, then run `npm install` and `npm start` locally. Deploy this folder to your Node host.
3. Set [`config.js`](config.js) to the HTTPS API address, for example `https://erection-planner-api.company.com/api`. If the API and frontend share the same Node host, leave it as `/api`.
4. Publish the root static files to HTTPS, then make sure the `url` and `icon` in [`manifest.json`](manifest.json) match their final public addresses.
5. As a Trimble Connect project administrator, use **Project Settings → Apps & Capabilities → Add Custom**, enter the public manifest URL, enable the extension, then open the 3D Viewer.

## Notes

- The API checks the Trimble access token against the project before project data is read or written.
- The contractor lock is enforced by SQL Server, not just the browser UI.
- The server uses serializable transactions so two users cannot receive the same sequence number during a simultaneous save.
- IFC exports use different property names. The extension recognizes `GlobalId`, `IfcGUID`, `GUID`, `Assembly Mark`, `Assembly`, `Mark`, and `Name`; amend the lists in `app.js` if your IFC uses different labels.
