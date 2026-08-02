import * as WorkspaceAPI from "trimble-connect-workspace-api";

async function start(){

    const API = await WorkspaceAPI.connect(window.parent);

    API.extension.requestPermission("accesstoken");

}

start();
