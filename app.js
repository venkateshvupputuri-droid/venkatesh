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

    try {
        // First attempt: try to read Explorer -> Completed specifically
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
                debugEl.textContent = `API keys: ${keys.join(', ')}`;
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
                if (debugEl) debugEl.textContent += `\nExplorer method ${c.name} -> recursive Completed found with ${list.length} children.`;
                if (list.length) return list;
            }
        } catch (err) {
            if (debugEl) debugEl.textContent += `\nExplorer method ${c.name} threw: ${err && err.message ? err.message : String(err)}`;
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
    initTabs();
    renderMenuList();
    setActiveTabFromRoute();
    document.getElementById("connectButton")?.addEventListener("click", connectToWorkspace);
    start();
});