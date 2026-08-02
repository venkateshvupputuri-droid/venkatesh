import * as API from "trimble-connect-workspace-api";

async function start() {
    // Connect to Trimble Connect
    const workspace = await API.connect(window.parent);

    console.log("Connected to Trimble Connect");

    // Get current project
    const project = await workspace.project.getCurrentProject();

    console.log(project);

    // Display project name
    document.getElementById("projectName").innerText = project.name;
}

start();