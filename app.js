let api;

const COMMANDS = Object.freeze({
    menu: "my_trimble_extension_menu",
    cwa: "my_trimble_extension_cwa",
    str: "my_trimble_extension_str"
});

const menu = {
    title: "My Trimble Extension",
    icon: "https://venkateshvupputuri-droid.github.io/venkatesh/icon.svg",
    command: COMMANDS.menu,
    subMenus: [
        { title: "CWA", icon: "https://venkateshvupputuri-droid.github.io/venkatesh/icon.svg", command: COMMANDS.cwa },
        { title: "STR", icon: "https://venkateshvupputuri-droid.github.io/venkatesh/icon.svg", command: COMMANDS.str }
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
    items.sort((a, b) => a.name.localeCompare(b.name)).forEach((item) => {
        select.add(new Option(item.name, item.id));
    });
    select.disabled = false;
}

function normalizeItems(result) {
    return Array.isArray(result) ? result : (result.items || result.data || []);
}

function isFolder(item) {
    return String(item.type || item.kind || item.fileType || "").toUpperCase() === "FOLDER";
}

function findByName(items, name) {
    return items.find((item) => isFolder(item) && item.name?.toLowerCase() === name.toLowerCase());
}

async function getFolderItems(projectId, folderId, token) {
    const response = await fetch(`https://app.connect.trimble.com/tc/api/2.0/folders/${encodeURIComponent(folderId)}/items?projectId=${encodeURIComponent(projectId)}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Trimble Connect data request failed (${response.status}).`);
    return normalizeItems(await response.json());
}

async function loadCompletedData() {
    const cwa = document.getElementById("cwaSelect");
    const str = document.getElementById("strSelect");
    cwa.disabled = str.disabled = true;
    cwa.replaceChildren(new Option("Loading CWA folders…", ""));
    str.replaceChildren(new Option("Loading STR files…", ""));

    const [project, token] = await Promise.all([
        api.project.getProject(),
        api.extension.requestPermission("accesstoken")
    ]);
    if (!token) throw new Error("Trimble Connect did not provide an access token.");

    const rootItems = await getFolderItems(project.id, project.id, token);
    const dataFolder = findByName(rootItems, "Data");
    if (!dataFolder) throw new Error("The Data folder was not found in this project.");

    const dataItems = await getFolderItems(project.id, dataFolder.id, token);
    const explorerFolder = findByName(dataItems, "Explorer");
    if (!explorerFolder) throw new Error("The Data/Explorer folder was not found in this project.");

    const explorerItems = await getFolderItems(project.id, explorerFolder.id, token);
    const completedFolder = findByName(explorerItems, "Completed");
    if (!completedFolder) throw new Error("The Data/Explorer/Completed folder was not found in this project.");

    const completedItems = await getFolderItems(project.id, completedFolder.id, token);
    setOptions("cwaSelect", completedItems.filter(isFolder), "Select a CWA folder");
    setOptions("strSelect", completedItems.filter((item) => !isFolder(item) && /\.ifc$/i.test(item.name || "")), "Select an IFC file");
    updateStatus("CWA folders and STR IFC files loaded from Data/Explorer/Completed.");
}

async function registerLeftNavigation() {
    if (!api?.ui?.setMenu) throw new Error("This Trimble Connect host does not expose the UI navigation API.");
    await api.ui.setMenu(menu);
    await api.ui.setActiveMenuItem(COMMANDS.cwa);
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
    updateStatus(`${eventArgs.data === COMMANDS.str ? "STR" : "CWA"} opened from the Trimble Connect navigation.`);
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("connectButton").addEventListener("click", connectToWorkspace);
    document.getElementById("refreshButton").addEventListener("click", () => {
        if (!api) return connectToWorkspace();
        loadCompletedData().catch((error) => updateStatus(error.message || String(error), true));
    });
    connectToWorkspace();
});
