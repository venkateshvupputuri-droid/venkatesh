let api;

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
async function requestJson(url, token) {
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
    return normalizeItems(body);
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

async function findProjectApiOrigin(projectId, token) {
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
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
            });
            if (response.ok) return origin;
        } catch (e) {
            console.warn(`project lookup failed for origin ${origin}`, e);
        }
    }
    throw new Error("The current project could not be found in any Trimble Connect region.");
}

async function getFolderItems(origin, projectId, folderId, token) {
    const url = `${origin}/tc/api/2.0/folders/${encodeURIComponent(folderId)}/items?projectId=${encodeURIComponent(projectId)}`;
    // debug log the exact URL being fetched
    console.debug("GET folder items:", url);
    return requestJson(url, token);
}

async function loadCompletedData() {
    const cwa = document.getElementById("cwaSelect");
    const str = document.getElementById("strSelect");
    cwa.disabled = str.disabled = true;
    cwa.replaceChildren(new Option("Loading CWA folders…", ""));
    str.replaceChildren(new Option("Loading STR files…", ""));

    // Request project and token in parallel
    const [project, tokenRaw] = await Promise.all([
        api.project.getProject(),
        api.extension.getPermission("accesstoken")
    ]);

    console.debug("project:", project);
    console.debug("tokenRaw:", tokenRaw);

    // tokenRaw may be a string or an object containing the token.
    const token = (typeof tokenRaw === "string") ? tokenRaw : (tokenRaw && (tokenRaw.accessToken || tokenRaw.access_token || tokenRaw.token || tokenRaw.value));
    console.debug("access token present:", Boolean(token));
    if (!token) throw new Error("Trimble Connect did not provide an access token.");

    const origin = await findProjectApiOrigin(project.id, token);
    console.debug("chosen origin:", origin);

    // Some Trimble project objects expose the root folder id separately; prefer that if available
    const rootFolderId = project.rootFolderId || project.rootFolder || project.id;
    console.debug("rootFolderId used for folder listing:", rootFolderId);

    const rootItems = await getFolderItems(origin, project.id, rootFolderId, token);
    console.debug("rootItems:", rootItems);
    const dataFolder = findByName(rootItems, "Data");
    if (!dataFolder) throw new Error("The Data folder was not found in this project.");

    const dataItems = await getFolderItems(origin, project.id, dataFolder.id, token);
    console.debug("dataItems:", dataItems);
    const explorerFolder = findByName(dataItems, "Explorer");
    if (!explorerFolder) throw new Error("The Data/Explorer folder was not found in this project.");

    const explorerItems = await getFolderItems(origin, project.id, explorerFolder.id, token);
    console.debug("explorerItems:", explorerItems);
    const completedFolder = findByName(explorerItems, "Completed");
    if (!completedFolder) throw new Error("The Data/Explorer/Completed folder was not found in this project.");

    const completedItems = await getFolderItems(origin, project.id, completedFolder.id, token);
    console.debug("completedItems:", completedItems);

    setOptions("cwaSelect", completedItems.filter(isFolder), "Select a CWA folder");
    setOptions("strSelect", completedItems.filter((item) => !isFolder(item) && /\.ifc$/i.test(item.name || "")), "Select an IFC file");
    updateStatus("CWA folders and STR IFC files loaded from Data/Explorer/Completed.");
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
