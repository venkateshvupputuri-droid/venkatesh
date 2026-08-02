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
        let completedItems;
        if (API.data) {
            if (typeof API.data.getCompleted === "function") {
                completedItems = await API.data.getCompleted();
            } else if (typeof API.data.listCompleted === "function") {
                completedItems = await API.data.listCompleted();
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

        cwaSelect.addEventListener("change", async () => {
            const selected = cwaFolders.find((folder) => folder.name === cwaSelect.value);
            await loadStrFiles(selected);
        });

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
        return;
    }

    strSelect.innerHTML = "<option>Loading IFC files...</option>";
    strSelect.disabled = true;
    strMessage.textContent = "";

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
                    items: item.items || item.children || item.data || item.files
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