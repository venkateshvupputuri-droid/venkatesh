let API;
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

    cwaSelect.innerHTML = "<option>Loading CWA folders...</option>";
    strSelect.innerHTML = "<option>Select a CWA folder first</option>";
    strMessage.textContent = "";
    strSelect.disabled = true;

    if (!API) {
        cwaSelect.innerHTML = "<option>Not connected to Trimble Connect API</option>";
        return;
    }

    try {
        // First attempt: try to read Explorer -> Completed specifically
        const explorerFolders = await fetchExplorerCompleted();
        if (explorerFolders && explorerFolders.length) {
            cwaSelect.innerHTML = explorerFolders
                .map((folder) => `<option value="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</option>`)
                .join("");

            cwaSelect.onchange = async () => {
                const selected = explorerFolders.find((f) => f.name === cwaSelect.value);
                await loadStrFiles(selected);
            };

            await loadStrFiles(explorerFolders[0]);
            return;
        }

        // Fallback: generic completed/folders calls
        let completedItems;
        if (API.data) {
            if (typeof API.data.getCompleted === "function") {
                completedItems = await API.data.getCompleted();
            } else if (typeof API.data.listCompleted === "function") {
                completedItems = await API.data.listCompleted();
            } else if (typeof API.data.getFolders === "function") {
                completedItems = await API.data.getFolders();
            }
        }

        const cwaFolders = normalizeFolderItems(completedItems);
        if (!cwaFolders.length) {
            cwaSelect.innerHTML = "<option>No CWA folders found</option>";
            return;
        }

        cwaSelect.innerHTML = cwaFolders
            .map((folder) => `<option value="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</option>`)
            .join("");

        cwaSelect.onchange = async () => {
            const selected = cwaFolders.find((folder) => folder.name === cwaSelect.value);
            await loadStrFiles(selected);
        };

        await loadStrFiles(cwaFolders[0]);
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
        API = await TrimbleConnectWorkspace.connect(window.parent);
        console.log("Connected to Trimble Connect workspace API", API);
        updateStatus("Connected to Trimble Connect workspace API.");
        if (debugEl) {
            try {
                const keys = Object.keys(API || {}).sort();
                debugEl.style.display = "block";
                debugEl.textContent = `API keys: ${keys.join(', ')}`;
            } catch (e) {
                debugEl.textContent = "Connected (unable to enumerate API).";
            }
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

    const candidates = [
        { name: 'getExplorer', fn: () => API.data.getExplorer?.() },
        { name: 'getCompleted', fn: () => API.data.getCompleted?.() },
        { name: 'listCompleted', fn: () => API.data.listCompleted?.() },
        { name: 'getFolders', fn: () => API.data.getFolders?.() },
        { name: 'listFolders', fn: () => API.data.listFolders?.() },
        { name: 'getProject', fn: () => API.data.getProject?.() },
        { name: 'project.getProject', fn: () => API.project?.getProject?.() }
    ];

    for (const c of candidates) {
        if (typeof c.fn !== 'function') continue;
        try {
            const res = await c.fn();
            if (!res) continue;

            const folders = normalizeFolderItems(res);
            // Try to find a top-level 'Completed' folder
            const completed = folders.find(f => /completed/i.test(f.name));
            if (completed && (Array.isArray(completed.items) && completed.items.length)) {
                const children = normalizeFolderItems(completed.items);
                if (debugEl) debugEl.textContent += `\nExplorer method ${c.name} -> found Completed with ${children.length} children.`;
                return children;
            }

            // If no top-level Completed, search recursively for any Completed node
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