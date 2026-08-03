let api;

// Commands must be unique to this extension. Trimble Connect sends the selected
// command back to this iframe through the extension.command event.
const COMMANDS = Object.freeze({
    menu: "my_trimble_extension_menu",
    assignment: "my_trimble_extension_assignment"
});

const menu = {
    title: "My Trimble Extension",
    icon: "https://venkateshvupputuri-droid.github.io/venkatesh/icon.svg",
    command: COMMANDS.menu,
    subMenus: [
        {
            title: "Assignment",
            icon: "https://venkateshvupputuri-droid.github.io/venkatesh/icon.svg",
            command: COMMANDS.assignment
        }
    ]
};

function updateStatus(message, isError = false) {
    const status = document.getElementById("statusMessage");
    status.textContent = message;
    status.classList.toggle("status-error", isError);
    status.classList.toggle("status-success", !isError);
}

function showAssignmentPage() {
    document.getElementById("assignment").hidden = false;
}

async function registerLeftNavigation() {
    if (!api?.ui?.setMenu) {
        throw new Error("This Trimble Connect host does not expose the UI navigation API.");
    }

    await api.ui.setMenu(menu);
    await api.ui.setActiveMenuItem(COMMANDS.assignment);
}

async function connectToWorkspace() {
    if (!window.TrimbleConnectWorkspace) {
        updateStatus("The Trimble Connect Workspace API did not load.", true);
        return;
    }

    try {
        api = await window.TrimbleConnectWorkspace.connect(window.parent, onWorkspaceEvent);
        await registerLeftNavigation();
        updateStatus("Connected. My Trimble Extension is available in the left navigation.");
    } catch (error) {
        console.error("Trimble Connect Workspace connection failed:", error);
        updateStatus(`Not connected: ${error.message || String(error)}`, true);
    }
}

function onWorkspaceEvent(event, eventArgs) {
    if (event !== "extension.command") return;

    const command = eventArgs?.data;
    if (command !== COMMANDS.assignment && command !== COMMANDS.menu) return;

    showAssignmentPage();
    updateStatus("Assignment opened from the Trimble Connect navigation.");
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("connectButton").addEventListener("click", connectToWorkspace);
    document.getElementById("refreshButton").addEventListener("click", () => {
        registerLeftNavigation().catch((error) => updateStatus(error.message, true));
    });
    showAssignmentPage();
    connectToWorkspace();
});
