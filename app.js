let api;
let resolveAccessToken;
let currentOrigin;
let currentToken;

const COMMANDS = Object.freeze({
    menu: "my_trimble_extension_menu",
    assignment: "my_trimble_extension_assignment"
});

const menu = {
    title: "My Trimble Extension",
    icon: "https://venkateshvupputuri-droid.github.io/venkatesh/icon.svg",
    command: COMMANDS.menu,
    subMenus: [
        { title: "Assignment", icon: "https://venkateshvupputuri-droid.github.io/venkatesh/icon.svg", command: COMMANDS.assignment }
    ]
};

function updateStatus(message, isError = false) {
    const status = document.getElementById("statusMessage");
    status.textContent = message;
    status.classList.toggle("status-error", isError);
    status.classList.toggle("status-success", !isError);
}

function setOptions(selectId, items, emptyText) {
    const select = document.getElementById(selectId);
    select.replaceChildren(new Option(emptyText, ""));
    if (!Array.isArray(items)) items = [];
    items.sort((a, b) => (a.name || "").localeCompare(b.name || "")).forEach((item) => {
        select.add(new Option(item.name || item.id || "(unnamed)", item.id || ""));
    });
    select.disabled = false;
}

function normalizeItems(result) {
    return Array.isArray(result) ? result : (result && (result.items || result.data)) || [];
}

function isFolder(item) {
    return String(item.type || item.kind || item.fileType || "").toUpperCase() === "FOLDER";
}

function findByName(items, name) {
    return items.find((item) => isFolder(item) && item.name?.toLowerCase() === name.toLowerCase());
}

// Improved requestJson: include response body in errors and handle non-JSON bodies
async function requestJsonRaw(url, token) {
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });
    const text = await response.text().catch(() => "");
    let body;
    try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
    if (!response.ok) {
        const msg = typeof body === "object" ? JSON.stringify(body) : (body || response.statusText);
        throw new Error(`Trimble Connect data request failed (${response.status}): ${msg}`);
    }
    return body;
}

async function requestJson(url, token) {
    return normalizeItems(await requestJsonRaw(url, token));
}

function collectOrigins(value, origins = new Set()) {
    if (Array.isArray(value)) value.forEach((item) => collectOrigins(item, origins));
    else if (value && typeof value === "object") {
        Object.entries(value).forEach(([key, item]) => {
            if ((key === "origin" || key === "url") && typeof item === "string" && item.startsWith("https://")) origins.add(item.replace(/\/$/, ""));
            else collectOrigins(item, origins);
        });
    }
    return origins;
}

// Looks up the project's home region AND fetches its Core API record.
// Root cause fix: the Workspace API's project.id is NOT the project's root
// folder id. The Core API record has a separate `rootId` field that must be
// used when listing the contents of the project's top-level folder.
async function findProjectDetails(projectId, token) {
    const origins = new Set(["https://app.connect.trimble.com", "https://app21.connect.trimble.com", "https://app31.connect.trimble.com"]);
    try {
        const regions = await requestJson("https://app.connect.trimble.com/tc/api/2.0/regions", token);
        collectOrigins(regions, origins);
    } catch (error) {
        console.warn("Trimble region discovery failed; using known Connect regions.", error);
    }

    for (const origin of origins) {
        try {
            const url = `${origin}/tc/api/2.0/projects/${encodeURIComponent(projectId)}`;
            const project = await requestJsonRaw(url, token);
            if (project && (project.id || project.rootId)) return { origin, project };
        } catch (e) {
            console.warn(`project lookup failed for origin ${origin}`, e);
        }
    }
    throw new Error("The current project could not be found in any Trimble Connect region.");
}

async function getFolderItems(origin, folderId, token) {
    const url = `${origin}/tc/api/2.0/folders/${encodeURIComponent(folderId)}/items`;
    return requestJson(url, token);
}

function extractAccessToken(value) {
    if (typeof value === "string") return value.trim();
    if (value && typeof value === "object") return value.accessToken || value.access_token || value.token || value.value || "";
    return "";
}

function looksLikeAccessToken(value) {
    // requestPermission may return a status string (for example "success")
    // while the actual access token arrives through extension.accessToken.
    return typeof value === "string" && value.length > 32 && !/^(success|granted|true|ok)$/i.test(value);
}

async function getWorkspaceAccessToken() {
    return new Promise(async (resolve, reject) => {
        const timeout = window.setTimeout(() => {
            resolveAccessToken = undefined;
            reject(new Error("Trimble Connect did not send an access token."));
        }, 10000);

        resolveAccessToken = (token) => {
            window.clearTimeout(timeout);
            resolveAccessToken = undefined;
            resolve(token);
        };

        try {
            const permissionResult = await api.extension.requestPermission("accesstoken");
            const returnedToken = extractAccessToken(permissionResult);
            // Older hosts return the token directly; newer hosts emit it as an event.
            if (looksLikeAccessToken(returnedToken) && resolveAccessToken) resolveAccessToken(returnedToken);
        } catch (error) {
            window.clearTimeout(timeout);
            resolveAccessToken = undefined;
            reject(error);
        }
    });
}

async function loadCompletedData() {
    const cwa = document.getElementById("cwaSelect");
    const str = document.getElementById("strSelect");
    cwa.disabled = str.disabled = true;
    cwa.replaceChildren(new Option("Loading CWA folders…", ""));
    str.replaceChildren(new Option("Loading STR files…", ""));

    // getProject is scoped by Trimble Connect to the project hosting this extension.
    const [project, token] = await Promise.all([
        api.project.getProject(),
        getWorkspaceAccessToken()
    ]);

    console.debug("project:", project);
    console.debug("access token present:", Boolean(token));
    if (!token) throw new Error("Trimble Connect did not provide an access token.");

    const { origin, project: projectRecord } = await findProjectDetails(project.id, token);
    console.debug("chosen origin:", origin);
    console.debug("project record:", projectRecord);

    // The project's root folder id is a distinct value from the project id
    // itself (exposed as `rootId` on the Core API project record). Using
    // project.id here was the bug: it silently pointed at a non-existent
    // folder, which looked like a permissions/data problem but was really a
    // wrong-id problem that affected every user, including admins.
    const rootFolderId = projectRecord.rootId || projectRecord.rootFolderId;
    if (!rootFolderId) throw new Error("The project's root folder id (rootId) was not returned by Trimble Connect.");

    const rootItems = await getFolderItems(origin, rootFolderId, token);
    console.debug("rootItems:", rootItems);
    const completedFolder = findByName(rootItems, "Completed");
    if (!completedFolder) throw new Error("The Completed folder was not found in this project.");

    const completedItems = await getFolderItems(origin, completedFolder.id, token);
    console.debug("completedItems:", completedItems);

    // Keep origin/token for subsequent folder/item queries
    currentOrigin = origin;
    currentToken = token;

    // Populate CWA selector with subfolders found under Completed. STR files will be loaded
    // when the user selects a CWA folder (so they come from the same folder the user chose).
    setOptions("cwaSelect", completedItems.filter(isFolder), "Select a CWA folder");
    // Reset STR selector until a CWA folder is chosen
    const strSelect = document.getElementById("strSelect");
    strSelect.replaceChildren(new Option("Select a CWA folder to show models…", ""));
    strSelect.disabled = true;

    // Wire change handlers
    cwa.addEventListener("change", (ev) => {
        const folderId = ev.target.value;
        if (!folderId) return;
        loadCwaFolderItems(folderId).catch((error) => updateStatus(error.message || String(error), true));
    });

    str.addEventListener("change", (ev) => {
        const itemId = ev.target.value;
        if (!itemId) return;
        loadModelDetails(itemId).catch((error) => updateStatus(error.message || String(error), true));
    });

    updateStatus("CWA folders loaded from Completed. Select a CWA folder to view models.");
}

async function loadCwaFolderItems(folderId) {
    if (!currentOrigin || !currentToken) throw new Error("Missing origin or access token.");
    const items = await getFolderItems(currentOrigin, folderId, currentToken);
    console.debug("CWA folder items:", items);

    // List files in the left panel for visibility
    const listEl = document.getElementById("folderFileList");
    listEl.replaceChildren();
    (items || []).forEach((it) => {
        const li = document.createElement("li");
        li.textContent = it.name || it.id || "(unnamed)";
        listEl.appendChild(li);
    });

    // Populate STR/model select with IFC files in this selected folder
    const models = (items || []).filter((item) => !isFolder(item) && /\.ifc$/i.test(item.name || ""));
    setOptions("strSelect", models, "Select an IFC file");
    document.getElementById("strSelect").disabled = false;
    document.getElementById("leftPanelMessage").textContent = "Files in selected CWA folder:";
}

async function loadModelDetails(itemId) {
    if (!currentOrigin || !currentToken) throw new Error("Missing origin or access token.");
    const url = `${currentOrigin}/tc/api/2.0/items/${encodeURIComponent(itemId)}`;
    const item = await requestJsonRaw(url, currentToken);
    console.debug("model item details:", item);

    const nameEl = document.getElementById("modelName");
    const descEl = document.getElementById("modelDescription");
    const name = item?.name || item?.fileName || item?.id || "(unnamed)";
    nameEl.value = name;

    // Try multiple locations for a meaningful description:
    // 1. top-level item.description / summary
    // 2. item.properties or item.data fields
    // 3. latest version metadata
    // 4. attempt to fetch the start of the IFC file and parse FILE_DESCRIPTION/FILE_NAME
    let description = item?.description || item?.summary || (item?.properties && (item.properties.description || item.properties.Description));
    if (!description && item?.data && typeof item.data === "object") {
        description = item.data.description || item.data.summary || null;
    }

    async function tryGetVersionDescription() {
        try {
            const versionsUrl = `${currentOrigin}/tc/api/2.0/items/${encodeURIComponent(itemId)}/versions`;
            const versions = await requestJsonRaw(versionsUrl, currentToken);
            if (Array.isArray(versions) && versions.length) {
                // Assume the first is latest (or pick the max by version number)
                const latest = versions[0];
                const vId = latest?.id || latest?.versionId;
                if (vId) {
                    const vUrl = `${currentOrigin}/tc/api/2.0/versions/${encodeURIComponent(vId)}`;
                    const v = await requestJsonRaw(vUrl, currentToken);
                    return v?.description || v?.summary || (v?.metadata && (v.metadata.description || v.metadata.summary)) || null;
                }
            }
        } catch (e) {
            console.debug("version metadata lookup failed:", e);
        }
        return null;
    }

    async function tryFetchIfcHeader(downloadUrl) {
        try {
            // Fetch first chunk of file to parse header (range to limit bandwidth)
            const resp = await fetch(downloadUrl, {
                method: "GET",
                headers: { Authorization: `Bearer ${currentToken}`, Range: "bytes=0-65535" }
            });
            if (!resp.ok) return null;
            const text = await resp.text();
            // Simple heuristic: look for FILE_DESCRIPTION or a descriptive block
            const m = text.match(/FILE_DESCRIPTION\s*\(\s*\(([^)]+)\)/i);
            if (m && m[1]) return m[1].replace(/\'|\"/g, "").trim();
            // Fallback: look for a line with description-like words
            const lines = text.split(/\r?\n/).slice(0, 200).map(s => s.trim());
            for (const line of lines) {
                if (/DESCRIPTION[:=]/i.test(line) || /PIPE AND CABLE|PIPE AND|CABLE GALL/i.test(line)) return line;
            }
        } catch (e) {
            console.debug("IFC header fetch failed:", e);
        }
        return null;
    }

    if (!description) {
        description = await tryGetVersionDescription();
    }

    // If still not found, try to locate a download URL from item or version and read IFC header
    if (!description) {
        let downloadUrl = item?.downloadUrl || item?.fileUrl || item?.preview || null;
        // Try to find storage locations or version storage
        if (!downloadUrl && item?.storageLocations && Array.isArray(item.storageLocations) && item.storageLocations.length) {
            downloadUrl = item.storageLocations[0].url;
        }
        if (!downloadUrl) {
            try {
                const versionsUrl = `${currentOrigin}/tc/api/2.0/items/${encodeURIComponent(itemId)}/versions`;
                const versions = await requestJsonRaw(versionsUrl, currentToken);
                const latest = Array.isArray(versions) && versions[0];
                if (latest) {
                    downloadUrl = latest.downloadUrl || latest.storageLocations && latest.storageLocations[0] && latest.storageLocations[0].url;
                }
            } catch (e) {
                console.debug("could not determine version download url:", e);
            }
        }

        if (downloadUrl) {
            const hdr = await tryFetchIfcHeader(downloadUrl);
            if (hdr) description = hdr;
        }
    }

    if (!description) description = "(no description available)";
    descEl.value = typeof description === "string" ? description : JSON.stringify(description, null, 2);
}

async function registerLeftNavigation() {
    if (!api?.ui?.setMenu) throw new Error("This Trimble Connect host does not expose the UI navigation API.");
    await api.ui.setMenu(menu);
    await api.ui.setActiveMenuItem(COMMANDS.assignment);
}

async function connectToWorkspace() {
    if (!window.TrimbleConnectWorkspace) return updateStatus("The Trimble Connect Workspace API did not load.", true);
    try {
        api = await window.TrimbleConnectWorkspace.connect(window.parent, onWorkspaceEvent);
        await registerLeftNavigation();
        await loadCompletedData();
    } catch (error) {
        console.error("Trimble Connect Workspace connection failed:", error);
        updateStatus(`Unable to load Trimble Connect data: ${error.message || String(error)}`, true);
    }
}

function onWorkspaceEvent(event, eventArgs) {
    if (event === "extension.accessToken") {
        const token = extractAccessToken(eventArgs?.data);
        if (looksLikeAccessToken(token) && resolveAccessToken) resolveAccessToken(token);
        return;
    }
    if (event !== "extension.command" || !Object.values(COMMANDS).includes(eventArgs?.data)) return;
    updateStatus("Assignment opened from the Trimble Connect navigation.");
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("connectButton").addEventListener("click", connectToWorkspace);
    document.getElementById("refreshButton").addEventListener("click", () => {
        if (!api) return connectToWorkspace();
        loadCompletedData().catch((error) => updateStatus(error.message || String(error), true));
    });
    connectToWorkspace();
});
