import * as WorkspaceAPI from "trimble-connect-workspace-api";

async function start(){

    const API = await WorkspaceAPI.connect(window.parent);

    console.log(API);

    const project = await API.project.getCurrentProject();

    console.log(project);

}

start();