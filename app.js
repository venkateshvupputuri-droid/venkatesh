let api;

// Trimble Connect renders this as the extension's entry in the project left
// navigation. The submenu is the page that opens inside this extension.
const menu = {
    title: "My Trimble Extension",
    icon: "https://venkateshvupputuri-droid.github.io/venkatesh/icon.svg",
    command: "my_trimble_extension",
    subMenus: [
        {
            title: "Assignment",
            icon: "https://venkateshvupputuri-droid.github.io/venkatesh/icon.svg",
            command: "assignment"
        }
    ]
};

function updateStatus(message, isError = false) {
    const status = document.getElementById("statusMessage");
    status.textContent = message;
    status.classList.toggle("status-error", isError);
    status.classList.toggle("status-success", !isError);
}

function showPage(command) {
    document.getElementById("assignment").hidden = command !== "assignment";
}

async function registerLeftNavigation() {
    if (!api?.ui?.setMenu) {
        throw new Error("This Trimble Connect host does not expose the UI navigation API.");
    }

    await api.ui.setMenu(menu);
    await api.ui.setActiveMenuItem("assignment");
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

    const command = eventArgs?.data ?? eventArgs;
    if (command === "assignment") {
        showPage(command);
        api?.extension?.requestFocus?.();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("connectButton").addEventListener("click", connectToWorkspace);
    document.getElementById("refreshButton").addEventListener("click", () => {
        registerLeftNavigation().catch((error) => updateStatus(error.message, true));
    });
    showPage("assignment");
    connectToWorkspace();
});
