let API;
let discoveredFolders = [];
let discoveredIfcFiles = [];
let selectedCwaFolder = null;
const currentMenu = {
    title: "My Trimble Extension",
    icon: "https://venkateshvupputuri-droid.github.io/venkatesh/icon.png",
    command: "main_nav_menu_clicked",
    subMenus: [
        {
            title: "Extension API",
            icon: "https://venkateshvupputuri-droid.github.io/venkatesh/icon.png",
            command: "render_tc_extension_api"
        }
    ]
};

function updateStatus(text, isError = false) {
    const statusEl = document.getElementById("statusMessage");
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = `status-note ${isError ? "status-error" : "status-success"}`;
}

function isDataApiAvailable() {
    return API && API.data && typeof API.data === "object";
}

function getApiMethods(obj) {
    if (!obj || typeof obj !== "object") return [];
    return Object.keys(obj).sort();
}

function logDebug(message) {
    const debugEl = document.getElementById("apiDebug");
    if (!debugEl) return;
    debugEl.style.display = "block";
    debugEl.textContent += `\n${message}`;
}

function getDataApiFunctionNames() {
    if (!isDataApiAvailable()) return [];
    return Object.entries(API.data)
        .filter(([_, value]) => typeof value === "function")
        .map(([name]) => name)
        .sort();
}

async function probeDataApiMethods() {
    if (!isDataApiAvailable()) return [];
    const functions = getDataApiFunctionNames().filter((name) => /get|list|fetch|explorer|folder|completed|project/i.test(name));
    const results = [];
    for (const fnName of functions) {
        const fn = API.data[fnName];
        if (typeof fn !== "function") continue;
        try {
            const value = await fn();
            results.push({ name: fnName, result: value });
            logDebug(`Probed data API ${fnName}: ${Array.isArray(value) ? `array(${value.length})` : typeof value}`);
        } catch (error) {
            logDebug(`Probed data API ${fnName} threw: ${error && error.message ? error.message : String(error)}`);
        }
    }
    return results;
}

function workspaceEventHandler(event, data) {
    const debugEl = document.getElementById("apiDebug");
    const payload = data?.data || data;
    const eventFile = payload?.file || payload?.files?.[0] || payload?.fileSelection?.file;
    if (debugEl) {
        const eventText = `${event}: ${JSON.stringify(eventFile || payload || data)}`;
        debugEl.style.display = "block";
        debugEl.textContent += `\nEVENT: ${eventText}`;
    }

    if (!eventFile) {
        if (event === "extension.onFileCustomAction" && Array.isArray(payload?.files)) {
            payload.files.forEach((f) => handleExplorerItem(f));
        }
        return;
    }
    handleExplorerItem(eventFile);
}

function handleExplorerItem(item) {
    if (!item || typeof item !== "object" || !item.name) return;
    const name = item.name.trim();
    if (!name) return;

    if (item.type === "FOLDER") {
        const completedMatch = /completed/i.test(name);
        const existing = discoveredFolders.find((folder) => folder.id === item.id || folder.name === name);
        if (!existing && completedMatch) {
            discoveredFolders.push({ name, id: item.id, rawItem: item });
            refreshCwaOptions();
            updateStatus(`Discovered Completed folder: ${name}`);
        }
    }

    if (item.type === "FILE") {
        if (name.toLowerCase().endsWith(".ifc")) {
            const existing = discoveredIfcFiles.find((file) => file.id === item.id || file.name === name);
            if (!existing) {
                discoveredIfcFiles.push({ name, id: item.id, rawItem: item });
                refreshStrOptions();
                updateStatus(`Discovered IFC file: ${name}`);
            }
        }

        const inferredFolders = inferCompletedFoldersFromFile(item);
        inferredFolders.forEach((folderName) => {
            const existing = discoveredFolders.find((folder) => folder.name === folderName);
            if (!existing) {
                discoveredFolders.push({ name: folderName, id: `${folderName}-inferred`, rawItem: item });
                refreshCwaOptions();
                updateStatus(`Inferred Completed folder from file: ${folderName}`);
            }
        });
    }
}

function inferCompletedFoldersFromFile(file) {
    if (!file || typeof file !== "object") return [];
    const folderNames = new Set();
    const sourceKeys = ["folderName", "path", "link", "displayName", "title", "name"];
    for (const key of sourceKeys) {
        const value = file[key];
        if (!value || typeof value !== "string") continue;
        const lower = value.toLowerCase();
        if (!lower.includes("completed")) continue;
        const parts = value.split(/[\/\\]/).map((part) => part.trim()).filter(Boolean);
        const candidate = parts.reverse().find((part) => /completed/i.test(part));
        if (candidate) {
            folderNames.add(candidate);
        }
    }
    return Array.from(folderNames);
}

function fileMatchesFolder(file, folder) {
    if (!file || !folder || !folder.name) return false;
    const lowerFolder = folder.name.toLowerCase();
    const sourceKeys = ["folderName", "path", "link", "displayName", "title", "name"];
    return sourceKeys.some((key) => {
        const value = file.rawItem?.[key];
        return typeof value === "string" && value.toLowerCase().includes(lowerFolder);
    });
}

function refreshCwaOptions() {
    const cwaSelect = document.getElementById("cwaSelect");
    if (!cwaSelect) return;
    if (!discoveredFolders.length) return;
    cwaSelect.innerHTML = discoveredFolders
        .map((folder) => `<option value="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</option>`)
        .join("");
    cwaSelect.disabled = false;
    cwaSelect.onchange = async () => {
        selectedCwaFolder = discoveredFolders.find((f) => f.name === cwaSelect.value);
        await loadStrFiles(selectedCwaFolder);
    };
}

function refreshStrOptions() {
    const strSelect = document.getElementById("strSelect");
    const strMessage = document.getElementById("strMessage");
    if (!strSelect || !strMessage) return;
    if (!discoveredIfcFiles.length) return;
    strSelect.innerHTML = discoveredIfcFiles
        .map((file) => `<option value="${escapeHtml(file.name)}">${escapeHtml(file.name)}</option>`)
        .join("");
    strSelect.disabled = false;
    strMessage.textContent = `Discovered ${discoveredIfcFiles.length} IFC file(s) from selection events.`;
}

async function setMenu() {
    if (!API || !API.extension) return;
    if (typeof API.extension.setMenu === "function") {
        try {
            await API.extension.setMenu({
                title: currentMenu.title,
                icon: currentMenu.icon,
                command: currentMenu.command,
                subMenus: currentMenu.subMenus
            });
        } catch (error) {
            console.warn("Extension setMenu failed:", error);
        }
    }
}

async function activateMenuItem(command = "render_tc_extension_api") {
    if (!API || !API.extension) return;
    if (typeof API.extension.activateMenuItem === "function") {
        try {
            await API.extension.activateMenuItem(command);
        } catch (error) {
            console.warn("Extension activateMenuItem failed:", error);
        }
    }
}

function renderMenuList() {
    const listEl = document.getElementById("menuList");
    if (!listEl) return;
    if (!currentMenu.subMenus.length) {
        listEl.innerHTML = "<div class=\"menu-empty\">No sub-menu items added yet.</div>";
        return;
    }

    const mainIcon = currentMenu.icon ? `<img class="menu-item-icon main-menu-icon" src="${currentMenu.icon}" alt="${currentMenu.title}">` : "";
    const mainMenuHtml = `
        <div class="menu-item main-menu-card">
            ${mainIcon}
            <div>
                <div><strong>${currentMenu.title}</strong></div>
                <div class="menu-item-meta">Main command: ${currentMenu.command}</div>
            </div>
        </div>
    `;

    const submenuHtml = currentMenu.subMenus.length
        ? `<div class="submenu-list">
                ${currentMenu.subMenus
                    .map((item) => `
                        <div class="menu-item submenu-item">
                            ${item.icon ? `<img class="menu-item-icon" src="${item.icon}" alt="${item.title}">` : ""}
                            <div>
                                <div><strong>${item.title}</strong> <span class="menu-item-label">(${item.command})</span></div>
                                <div class="menu-item-meta">Sub-menu command</div>
                            </div>
                        </div>
                    `)
                    .join("")}
            </div>`
        : "<div class=\"menu-empty\">No sub-menu items added yet.</div>";

    listEl.innerHTML = mainMenuHtml + submenuHtml;
}

function addSubMenu() {
    const title = document.getElementById("subMenuTitle")?.value.trim();
    const command = document.getElementById("subMenuCommand")?.value.trim();
    const icon = document.getElementById("subMenuIcon")?.value.trim();
    if (!title || !command) {
        updateStatus("Sub-menu title and command are required.", true);
        return;
    }
    currentMenu.subMenus.push({ title, command, icon });
    renderMenuList();
    updateStatus(`Added submenu: ${title}`);
}

async function updateExtensionStatus() {
    if (!API || !API.extension) {
        updateStatus("Trimble Connect workspace API is not connected.", true);
        return;
    }
    const message = document.getElementById("statusText")?.value.trim();
    if (!message) {
        updateStatus("Enter a status message to update.", true);
        return;
    }

    try {
        await API.extension.setStatusMessage(message);
        updateStatus("Extension status message updated.");
    } catch (error) {
        console.error(error);
        updateStatus("Failed to update status message. Check console for errors.", true);
    }
}

async function loadCwaFolders() {
    const cwaSelect = document.getElementById("cwaSelect");
    const strSelect = document.getElementById("strSelect");
    const strMessage = document.getElementById("strMessage");
    if (!cwaSelect || !strSelect || !strMessage) return;

    cwaSelect.innerHTML = "<option>Listening for Completed folder items...</option>";
    cwaSelect.disabled = true;
    strSelect.innerHTML = "<option>Select a CWA folder first</option>";
    strSelect.disabled = true;
    strMessage.textContent = "Select an IFC file in Trimble Connect Explorer to discover Completed folders.";

    if (!API) {
        cwaSelect.innerHTML = "<option>Not connected to Trimble Connect API</option>";
        return;
    }

    if (discoveredFolders.length) {
        refreshCwaOptions();
        selectedCwaFolder = selectedCwaFolder && discoveredFolders.some((f) => f.name === selectedCwaFolder.name)
            ? selectedCwaFolder
            : discoveredFolders[0];
        cwaSelect.value = selectedCwaFolder.name;
        await loadStrFiles(selectedCwaFolder);
        return;
    }

    const hasDataApi = isDataApiAvailable();
    if (!hasDataApi) {
        // Attempt REST-based discovery as a fallback (uses access token if available)
        try {
            const explorerFolders = await fetchCompletedFromServer();
            if (explorerFolders && explorerFolders.length) {
                discoveredFolders = explorerFolders.map((folder) => ({
                    name: folder.name,
                    id: folder.id,
                    rawItem: folder
                }));
                refreshCwaOptions();
                selectedCwaFolder = discoveredFolders[0];
                cwaSelect.value = selectedCwaFolder.name;
                await loadStrFiles(selectedCwaFolder);
                return;
            }
        } catch (err) {
            console.error('REST Completed fetch failed', err);
        }

        cwaSelect.innerHTML = "<option>No Completed folders discovered yet.</option>";
        return;
    }

    try {
        const explorerFolders = await fetchExplorerCompleted();
        if (explorerFolders && explorerFolders.length) {
            discoveredFolders = explorerFolders.map((folder) => ({
                name: folder.name,
                id: folder.id,
                rawItem: folder
            }));
            refreshCwaOptions();
            selectedCwaFolder = discoveredFolders[0];
            cwaSelect.value = selectedCwaFolder.name;
            await loadStrFiles(selectedCwaFolder);
            return;
        }

        cwaSelect.innerHTML = "<option>No Completed folders discovered yet.</option>";
    } catch (error) {
        console.error(error);
        cwaSelect.innerHTML = "<option>Unable to load CWA folders</option>";
    }
}

async function loadStrFiles(selectedFolder) {
    const strSelect = document.getElementById("strSelect");
    const strMessage = document.getElementById("strMessage");
    if (!strSelect || !strMessage) return;

    if (!selectedFolder) {
        strSelect.innerHTML = "<option>Select a CWA folder first</option>";
        strSelect.disabled = true;
        strMessage.textContent = "";
        await loadDataTableForFolder(null);
        return;
    }

    strSelect.innerHTML = "<option>Loading IFC files...</option>";
    strSelect.disabled = true;
    strMessage.textContent = "";
    await loadDataTableForFolder(selectedFolder);

    if (!API || !API.data) {
        let ifcFiles = discoveredIfcFiles
            .filter((file) => fileMatchesFolder(file, selectedFolder))
            .map((file) => file.name)
            .filter((name) => name.toLowerCase().endsWith(".ifc"));

        if (!ifcFiles.length) {
            ifcFiles = discoveredIfcFiles.map((file) => file.name).filter((name) => name.toLowerCase().endsWith(".ifc"));
        }

        if (!ifcFiles.length) {
            strSelect.innerHTML = "<option>No IFC files discovered yet</option>";
            strMessage.textContent = "Select IFC files in Trimble Connect Explorer to populate the list.";
            return;
        }

        strSelect.disabled = false;
        strSelect.innerHTML = ifcFiles
            .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
            .join("");
        strMessage.textContent = `Showing ${ifcFiles.length} discovered IFC file(s).`;
        return;
    }

    try {
        let items = [];
        const candidates = [selectedFolder.items, selectedFolder.children, selectedFolder.files, selectedFolder.data];
        for (const candidate of candidates) {
            if (Array.isArray(candidate) && candidate.length) {
                items = candidate;
                break;
            }
        }

        if (!items.length && typeof API.data?.getFolder === "function" && selectedFolder.id) {
            const folderDetails = await API.data.getFolder(selectedFolder.id);
            items = Array.isArray(folderDetails?.items) ? folderDetails.items : folderDetails?.children || folderDetails?.files || [];
        }

        const ifcFiles = (Array.isArray(items) ? items : [])
            .map((item) => {
                const name = item?.name || item?.title || item;
                return typeof name === "string" ? name : null;
            })
            .filter((name) => name && name.toLowerCase().endsWith(".ifc"));

        if (!ifcFiles.length) {
            strSelect.innerHTML = "<option>No IFC files available</option>";
            strMessage.textContent = "No IFC files available.";
            return;
        }

        strSelect.disabled = false;
        strSelect.innerHTML = ifcFiles
            .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
            .join("");
    } catch (error) {
        console.error(error);
        strSelect.innerHTML = "<option>No IFC files available</option>";
        strMessage.textContent = "No IFC files available.";
    }
}

function normalizeFolderItems(data) {
    if (!data) return [];
    let items = [];
    if (Array.isArray(data)) {
        items = data;
    } else if (Array.isArray(data.items)) {
        items = data.items;
    } else if (Array.isArray(data.folders)) {
        items = data.folders;
    }
    return items
        .map((item) => {
            if (typeof item === "string") {
                return { name: item };
            }
            if (item && typeof item === "object") {
                return {
                    name: item.name || item.title || item.folderName || item.displayName || item.label,
                    id: item.id,
                    items: item.items || item.children || item.data || item.files,
                    rawItem: item
                };
            }
            return null;
        })
        .filter((item) => item && typeof item.name === "string" && item.name.trim());
}

function renderCompletedList(items) {
    const uniqueItems = Array.from(new Set(items));
    const rows = uniqueItems.map((name) => `
        <li class="completed-item">${escapeHtml(name)}</li>
    `);
    if (!rows.length) {
        return "<div class=\"menu-empty\">No completed folders found.</div>";
    }
    return `<ul class="completed-list">${rows.join("")}</ul>`;
}

async function loadDataTableForFolder(selectedFolder) {
    const debugEl = document.getElementById("apiDebug");
    const dataTableMessage = document.getElementById("dataTableMessage");
    if (dataTableMessage) {
        dataTableMessage.textContent = "";
    }

    if (!API || !API.dataTable) {
        if (dataTableMessage) {
            dataTableMessage.textContent = "Trimble Connect DataTable API is not available.";
        }
        return;
    }

    if (!selectedFolder || !selectedFolder.name) {
        if (dataTableMessage) {
            dataTableMessage.textContent = "No selected folder name available for DataTable filtering.";
        }
        return;
    }

    if (typeof API.dataTable.setConfig !== "function") {
        if (dataTableMessage) {
            dataTableMessage.textContent = "DataTable setConfig is not supported by this API version.";
        }
        return;
    }

    try {
        const currentConfig = typeof API.dataTable.getConfig === "function"
            ? await API.dataTable.getConfig()
            : {};

        const newConfig = {
            ...(currentConfig || {}),
            filter: selectedFolder.name,
            mode: currentConfig?.mode || "all"
        };

        await API.dataTable.setConfig(newConfig);

        if (dataTableMessage) {
            dataTableMessage.textContent = `DataTable filter applied: ${selectedFolder.name}`;
        }

        if (debugEl) {
            let columns = [];
            if (typeof API.dataTable.getAllColumns === "function") {
                columns = await API.dataTable.getAllColumns();
            }
            debugEl.textContent += `\nDataTable filter '${selectedFolder.name}' applied. Columns: ${Array.isArray(columns) ? columns.map((col) => col.field || col.label).join(", ") : "n/a"}`;
        }
    } catch (error) {
        console.error(error);
        if (dataTableMessage) {
            dataTableMessage.textContent = `DataTable update failed: ${error?.message || String(error)}`;
        }
    }
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function setActiveTab(tabId) {
    document.querySelectorAll(".tab-button").forEach((button) => {
        button.classList.toggle("active", button.dataset.tab === tabId);
    });
    document.querySelectorAll(".tab-content").forEach((section) => {
        section.classList.toggle("active", section.id === tabId);
    });
}

function initTabs() {
    document.querySelectorAll(".tab-button").forEach((button) => {
        button.addEventListener("click", () => {
            setActiveTab(button.dataset.tab);
        });
    });
}

function getRouteCommand() {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.has("command")) {
            return params.get("command");
        }
    } catch (ignore) {
        // ignore
    }
    const path = window.location.pathname.split("/").filter(Boolean).pop();
    return path;
}

function setActiveTabFromRoute() {
    const command = getRouteCommand();
    if (command === "render_tc_embed_api") {
        setActiveTab("embed");
    } else if (command === "render_tc_extension_api") {
        setActiveTab("menu");
    } else {
        setActiveTab("documents");
    }
}

window.addEventListener("message", (event) => {
    if (!event.data || typeof event.data !== "object") {
        return;
    }
    const command = event.data.command;
    if (!command) {
        return;
    }
    if (command === "render_tc_embed_api") {
        setActiveTab("embed");
    } else if (command === "render_tc_extension_api") {
        setActiveTab("menu");
    }
});

async function start() {
    try {
        await connectToWorkspace();
    } catch (err) {
        console.error("Workspace API connect failed", err);
        updateStatus("Not connected to Trimble Connect workspace API.", true);
        const cwaSelect = document.getElementById("cwaSelect");
        const strSelect = document.getElementById("strSelect");
        const strMessage = document.getElementById("strMessage");
        if (cwaSelect) {
            cwaSelect.innerHTML = "<option>Unable to load CWA folders</option>";
        }
        if (strSelect) {
            strSelect.innerHTML = "<option>Select a CWA folder first</option>";
        }
        if (strMessage) {
            strMessage.textContent = "";
        }
    }
}

async function connectToWorkspace() {
    const debugEl = document.getElementById("apiDebug");
    try {
        API = await TrimbleConnectWorkspace.connect(window.parent, workspaceEventHandler);
        console.log("Connected to Trimble Connect workspace API", API);
        updateStatus("Connected to Trimble Connect workspace API.");
        if (debugEl) {
            try {
                const keys = Object.keys(API || {}).sort();
                const dataMethods = API?.data ? getApiMethods(API.data) : [];
                debugEl.style.display = "block";
                debugEl.textContent = `API keys: ${keys.join(', ')}\n` +
                    `API.data methods: ${dataMethods.join(', ') || 'n/a'}\n` +
                    `API.project methods: ${API?.project ? getApiMethods(API.project).join(', ') : 'n/a'}`;
            } catch (e) {
                debugEl.textContent = "Connected (unable to enumerate API).";
            }
        }
        if (isDataApiAvailable()) {
            await probeDataApiMethods();
        }
        await setMenu();
        await loadCwaFolders();
    } catch (err) {
        console.error("Workspace API connect failed", err);
        updateStatus("Not connected to Trimble Connect workspace API.", true);
        if (debugEl) {
            debugEl.style.display = "block";
            debugEl.textContent = `Connect error: ${err && err.message ? err.message : String(err)}`;
        }
    }
}

async function fetchExplorerCompleted() {
    const debugEl = document.getElementById("apiDebug");
    if (!API || !API.data) return [];

    const tried = new Set();
    const functionNames = getDataApiFunctionNames();
    const candidates = functionNames.filter((name) => /completed|explorer|folder|files?|list|get|fetch|project/i.test(name));

    const candidateCalls = [
        ...candidates,
        'getExplorer',
        'listExplorer',
        'fetchExplorer',
        'getCompleted',
        'listCompleted',
        'getFolders',
        'listFolders',
        'getFolder',
        'getFolderById',
        'getFiles',
        'listFiles',
        'getProject'
    ].filter((value, index, self) => self.indexOf(value) === index);

    for (const fnName of candidateCalls) {
        if (tried.has(fnName)) continue;
        tried.add(fnName);
        const fn = API.data?.[fnName];
        if (typeof fn !== 'function') continue;

        const attempts = [];
        if (fn.length === 0) {
            attempts.push(() => fn());
        }
        if (fn.length === 1) {
            attempts.push(() => fn('Completed'));
        }
        attempts.push(() => fn());

        for (const attempt of attempts) {
            try {
                const res = await attempt();
                if (!res) continue;

                const folders = normalizeFolderItems(res);
                const completed = folders.find((f) => /completed/i.test(f.name));
                if (completed && Array.isArray(completed.items) && completed.items.length) {
                    const children = normalizeFolderItems(completed.items);
                    if (debugEl) debugEl.textContent += `\nExplorer method ${fnName} -> found Completed with ${children.length} children.`;
                    return children;
                }

                const found = [];
                (function walk(node) {
                    if (!node) return;
                    if (Array.isArray(node)) return node.forEach(walk);
                    if (typeof node === 'object') {
                        const n = node.name || node.title || node.label || node.displayName;
                        if (n && /completed/i.test(n) && (node.items || node.children || node.data || node.files)) {
                            found.push(node);
                            return;
                        }
                        for (const key of ['items', 'children', 'folders', 'data', 'results', 'files']) {
                            if (node[key]) walk(node[key]);
                        }
                    }
                })(res);

                if (found.length) {
                    const list = normalizeFolderItems(found[0].items || found[0].children || found[0].data || found[0].files);
                    if (debugEl) debugEl.textContent += `\nExplorer method ${fnName} -> recursive Completed found with ${list.length} children.`;
                    if (list.length) return list;
                }
            } catch (err) {
                if (debugEl) debugEl.textContent += `\nExplorer method ${fnName} threw: ${err && err.message ? err.message : String(err)}`;
            }
        }
    }
    return [];
}

async function fetchCompletedFromServer() {
    const debugEl = document.getElementById("apiDebug");
    if (debugEl) debugEl.textContent += `\nAttempting server REST fetch for Completed folders...`;

    let token = null;
    try {
        if (API && API.extension && typeof API.extension.requestPermission === 'function') {
            token = await API.extension.requestPermission('accesstoken');
            if (debugEl) debugEl.textContent += `\nObtained access token: ${token ? 'yes' : 'no'}`;
        }
    } catch (err) {
        if (debugEl) debugEl.textContent += `\nrequestPermission failed: ${err && err.message ? err.message : String(err)}`;
    }

    let projectId = null;
    try {
        if (API && API.project && typeof API.project.getProject === 'function') {
            const proj = await API.project.getProject();
            projectId = proj?.id;
            if (debugEl) debugEl.textContent += `\nProject id: ${projectId || 'unknown'}`;
        }
    } catch (err) {
        if (debugEl) debugEl.textContent += `\nproject.getProject failed: ${err && err.message ? err.message : String(err)}`;
    }

    let base = window.location.origin;
    try {
        if (document && document.referrer) {
            const ref = new URL(document.referrer);
            if (ref.origin) base = ref.origin;
        }
    } catch (e) {
        // ignore, fallback to window.location.origin
    }
    const candidates = [];
    if (projectId) {
        candidates.push(`${base}/api/2/projects/${projectId}/folders`);
        candidates.push(`${base}/api/2/projects/${projectId}/explorer`);
        candidates.push(`${base}/api/projects/${projectId}/folders`);
        candidates.push(`${base}/api/projects/${projectId}/files`);
        candidates.push(`${base}/api/projects/${projectId}/explorer`);
        candidates.push(`${base}/api/2/projects/${projectId}/files`);
    }
    // also try some generic endpoints on same origin
    candidates.push(`${base}/api/2/explorer`);
    candidates.push(`${base}/api/explorer`);
    candidates.push(`${base}/api/2/folders`);

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    for (const url of candidates) {
        try {
            if (debugEl) debugEl.textContent += `\nTrying ${url}`;
            const res = await fetch(url, { headers, credentials: 'include' });
            if (!res.ok) {
                if (debugEl) debugEl.textContent += ` -> ${res.status}`;
                continue;
            }
            const json = await res.json();
            const folders = normalizeFolderItems(json);
            if (folders && folders.length) {
                const completed = folders.find((f) => /completed/i.test(f.name));
                if (completed) {
                    const children = normalizeFolderItems(completed.items || completed.children || completed.files || completed.data);
                    if (children && children.length) {
                        if (debugEl) debugEl.textContent += `\nREST ${url} -> found Completed with ${children.length} children.`;
                        return children;
                    }
                }

                // recursive search
                const found = [];
                (function walk(node) {
                    if (!node) return;
                    if (Array.isArray(node)) return node.forEach(walk);
                    if (typeof node === 'object') {
                        const n = node.name || node.title || node.label || node.displayName;
                        if (n && /completed/i.test(n) && (node.items || node.children || node.data || node.files)) {
                            found.push(node);
                            return;
                        }
                        for (const key of ['items', 'children', 'folders', 'data', 'results', 'files']) {
                            if (node[key]) walk(node[key]);
                        }
                    }
                })(json);

                if (found.length) {
                    const list = normalizeFolderItems(found[0].items || found[0].children || found[0].data || found[0].files);
                    if (list.length) {
                        if (debugEl) debugEl.textContent += `\nREST ${url} -> recursive Completed found with ${list.length} children.`;
                        return list;
                    }
                }
            }
        } catch (err) {
            if (debugEl) debugEl.textContent += `\nREST ${url} threw: ${err && err.message ? err.message : String(err)}`;
        }
    }
    return [];
}

window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("addSubmenuButton")?.addEventListener("click", addSubMenu);
    document.getElementById("setMenuButton")?.addEventListener("click", setMenu);
    document.getElementById("activateMenuButton")?.addEventListener("click", () => activateMenuItem());
    document.getElementById("activateEmbedButton")?.addEventListener("click", () => {
        const command = document.getElementById("activateEmbedCommand")?.value.trim();
        activateMenuItem(command || "render_tc_embed_api");
    });
    document.getElementById("updateStatusButton")?.addEventListener("click", updateExtensionStatus);
    document.getElementById("refreshButton")?.addEventListener("click", () => {
        updateStatus("Refreshing discovered explorer data...");
        loadCwaFolders();
    });
    initTabs();
    renderMenuList();
    setActiveTabFromRoute();
    document.getElementById("connectButton")?.addEventListener("click", connectToWorkspace);
    start();
});