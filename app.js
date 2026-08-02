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
        },
        {
            title: "Embed API",
            icon: "https://venkateshvupputuri-droid.github.io/venkatesh/icon.png",
            command: "render_tc_embed_api"
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

async function setMenu() {
    if (!API || !API.ui) {
        updateStatus("Trimble Connect workspace API is not connected.", true);
        return;
    }
    currentMenu.title = document.getElementById("mainMenuTitle")?.value.trim() || currentMenu.title;
    currentMenu.command = document.getElementById("mainMenuCommand")?.value.trim() || currentMenu.command;
    currentMenu.icon = document.getElementById("mainMenuIcon")?.value.trim() || currentMenu.icon;

    try {
        const menuConfig = {
            title: currentMenu.title,
            icon: currentMenu.icon,
            command: currentMenu.command,
            subMenus: currentMenu.subMenus
        };
        await API.ui.setMenu(menuConfig);
        updateStatus("Menu configured successfully.");
    } catch (error) {
        console.error(error);
        updateStatus("Failed to set menu. Check console for errors.", true);
    }
}

async function activateMenuItem(commandOverride) {
    if (!API || !API.ui) {
        updateStatus("Trimble Connect workspace API is not connected.", true);
        return;
    }
    const command = commandOverride || document.getElementById("activateCommand")?.value.trim();
    if (!command) {
        updateStatus("Enter a valid submenu command to activate.", true);
        return;
    }

    try {
        await API.ui.setActiveMenuItem(command);
        updateStatus(`Activated command: ${command}`);
        if (command === "render_tc_embed_api") {
            setActiveTab("embed");
        } else if (command === "render_tc_extension_api") {
            setActiveTab("menu");
        }
    } catch (error) {
        console.error(error);
        updateStatus("Failed to activate menu item. Check console for errors.", true);
    }
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
        API = await TrimbleConnectWorkspace.connect(window.parent);
        console.log("Connected to Trimble Connect workspace API", API);
        updateStatus("Connected to Trimble Connect workspace API.");
        await setMenu();
    } catch (err) {
        console.error("Workspace API connect failed", err);
        updateStatus("Not connected to Trimble Connect workspace API.", true);
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
    start();
});