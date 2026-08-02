import * as WorkspaceAPI from "trimble-connect-workspace-api";

let API;
const currentMenu = {
    title: "My Trimble Extension",
    command: "main_nav_menu_clicked",
    subMenus: []
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

    listEl.innerHTML = currentMenu.subMenus
        .map((item, index) => `
            <div class="menu-item">
                <div><strong>${item.title}</strong></div>
                <div class="menu-item-meta">command: ${item.command}</div>
            </div>
        `)
        .join("");
}

function addSubMenu() {
    const title = document.getElementById("subMenuTitle")?.value.trim();
    const command = document.getElementById("subMenuCommand")?.value.trim();
    if (!title || !command) {
        updateStatus("Sub-menu title and command are required.", true);
        return;
    }
    currentMenu.subMenus.push({ title, command });
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

    try {
        const menuConfig = {
            title: currentMenu.title,
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

async function activateMenuItem() {
    if (!API || !API.ui) {
        updateStatus("Trimble Connect workspace API is not connected.", true);
        return;
    }
    const command = document.getElementById("activateCommand")?.value.trim();
    if (!command) {
        updateStatus("Enter a valid submenu command to activate.", true);
        return;
    }

    try {
        await API.ui.setActiveMenuItem(command);
        updateStatus(`Activated command: ${command}`);
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

async function start() {
    try {
        API = await WorkspaceAPI.connect(window.parent);
        console.log("Connected to Trimble Connect workspace API", API);
        updateStatus("Connected to Trimble Connect workspace API.");
    } catch (err) {
        console.error("Workspace API connect failed", err);
        updateStatus("Not connected to Trimble Connect workspace API.", true);
    }
}

window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("addSubmenuButton")?.addEventListener("click", addSubMenu);
    document.getElementById("setMenuButton")?.addEventListener("click", setMenu);
    document.getElementById("activateMenuButton")?.addEventListener("click", activateMenuItem);
    document.getElementById("updateStatusButton")?.addEventListener("click", updateExtensionStatus);
    renderMenuList();
    start();
});