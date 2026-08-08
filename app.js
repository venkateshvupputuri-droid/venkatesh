let api;
let resolveAccessToken;
let currentOrigin;
let currentToken;

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

function setOptions(selectId, items, emptyText) {
    const select = document.getElementById(selectId);
    select.replaceChildren(new Option(emptyText, ""));

    if (!Array.isArray(items)) items = [];

    items
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        .forEach((item) => {
            select.add(new Option(item.name || item.id || "(unnamed)", item.id || ""));
        });

    select.disabled = false;
}

function normalizeItems(result) {
    return Array.isArray(result)
        ? result
        : (result && (result.items || result.data)) || [];
}

function isFolder(item) {
    return String(item.type || item.kind || item.fileType || "").toUpperCase() === "FOLDER";
}

function findByName(items, name) {
    return items.find(
        (item) =>
            isFolder(item) &&
            item.name?.toLowerCase() === name.toLowerCase()
    );
}

async function requestJsonRaw(url, token) {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json"
        }
    });

    const text = await response.text().catch(() => "");
    let body;

    try {
        body = text ? JSON.parse(text) : null;
    } catch {
        body = text;
    }

    if (!response.ok) {
        const msg =
            typeof body === "object"
                ? JSON.stringify(body)
                : (body || response.statusText);

        throw new Error(
            `Trimble Connect data request failed (${response.status}): ${msg}`
        );
    }

    return body;
}

async function requestJson(url, token) {
    return normalizeItems(await requestJsonRaw(url, token));
}

function collectOrigins(value, origins = new Set()) {
    if (Array.isArray(value)) {
        value.forEach((item) => collectOrigins(item, origins));
    } else if (value && typeof value === "object") {
        Object.entries(value).forEach(([key, item]) => {
            if (
                (key === "origin" || key === "url") &&
                typeof item === "string" &&
                item.startsWith("https://")
            ) {
                origins.add(item.replace(/\/$/, ""));
            } else {
                collectOrigins(item, origins);
            }
        });
    }

    return origins;
}

async function findProjectDetails(projectId, token) {
    const origins = new Set([
        "https://app.connect.trimble.com",
        "https://app21.connect.trimble.com",
        "https://app31.connect.trimble.com"
    ]);

    try {
        const regions = await requestJson(
            "https://app.connect.trimble.com/tc/api/2.0/regions",
            token
        );
        collectOrigins(regions, origins);
    } catch (error) {
        console.warn(
            "Trimble region discovery failed; using known Connect regions.",
            error
        );
    }

    for (const origin of origins) {
        try {
            const url = `${origin}/tc/api/2.0/projects/${encodeURIComponent(projectId)}`;
            const project = await requestJsonRaw(url, token);

            if (project && (project.id || project.rootId)) {
                return { origin, project };
            }
        } catch (e) {
            console.warn(`project lookup failed for origin ${origin}`, e);
        }
    }

    throw new Error(
        "The current project could not be found in any Trimble Connect region."
    );
}

async function getFolderItems(origin, folderId, token) {
    const url = `${origin}/tc/api/2.0/folders/${encodeURIComponent(folderId)}/items`;
    return requestJson(url, token);
}

function extractAccessToken(value) {
    if (typeof value === "string") return value.trim();

    if (value && typeof value === "object") {
        return (
            value.accessToken ||
            value.access_token ||
            value.token ||
            value.value ||
            ""
        );
    }

    return "";
}

function looksLikeAccessToken(value) {
    return (
        typeof value === "string" &&
        value.length > 32 &&
        !/^(success|granted|true|ok)$/i.test(value)
    );
}

async function getWorkspaceAccessToken() {
    return new Promise(async (resolve, reject) => {
        const timeout = window.setTimeout(() => {
            resolveAccessToken = undefined;
            reject(
                new Error("Trimble Connect did not send an access token.")
            );
        }, 10000);

        resolveAccessToken = (token) => {
            window.clearTimeout(timeout);
            resolveAccessToken = undefined;
            resolve(token);
        };

        try {
            const permissionResult =
                await api.extension.requestPermission("accesstoken");

            const returnedToken = extractAccessToken(permissionResult);

            if (
                looksLikeAccessToken(returnedToken) &&
                resolveAccessToken
            ) {
                resolveAccessToken(returnedToken);
            }
        } catch (error) {
            window.clearTimeout(timeout);
            resolveAccessToken = undefined;
            reject(error);
        }
    });
}

async function loadCompletedData() {
    const cwa = document.getElementById("cwaSelect");
    const str = document.getElementById("strSelect");
    const strName = document.getElementById("modelDescription");

    cwa.disabled = true;
    str.disabled = true;

    cwa.replaceChildren(new Option("Loading CWA folders…", ""));
    str.replaceChildren(new Option("Loading model files…", ""));
    strName.value = "";

    const [project, token] = await Promise.all([
        api.project.getProject(),
        getWorkspaceAccessToken()
    ]);

    if (!token) {
        throw new Error("Trimble Connect did not provide an access token.");
    }

    const { origin, project: projectRecord } =
        await findProjectDetails(project.id, token);

    const rootFolderId =
        projectRecord.rootId || projectRecord.rootFolderId;

    if (!rootFolderId) {
        throw new Error(
            "The project's root folder id (rootId) was not returned by Trimble Connect."
        );
    }

    const rootItems = await getFolderItems(
        origin,
        rootFolderId,
        token
    );

    const completedFolder = findByName(rootItems, "Completed");

    if (!completedFolder) {
        throw new Error("The Completed folder was not found in this project.");
    }

    const completedItems = await getFolderItems(
        origin,
        completedFolder.id,
        token
    );

    currentOrigin = origin;
    currentToken = token;

    setOptions(
        "cwaSelect",
        completedItems.filter(isFolder),
        "Select a CWA folder"
    );

    str.replaceChildren(
        new Option("Select a CWA folder to show models…", "")
    );
    str.disabled = true;

    cwa.onchange = (ev) => {
        const folderId = ev.target.value;

        if (!folderId) {
            str.replaceChildren(
                new Option("Select a CWA folder to show models…", "")
            );
            str.disabled = true;
            strName.value = "";
            return;
        }

        loadCwaFolderItems(folderId).catch((error) =>
            updateStatus(error.message || String(error), true)
        );
    };

    str.onchange = (ev) => {
        const itemId = ev.target.value;

        if (!itemId) {
            strName.value = "";
            return;
        }

        loadModelDetails(itemId).catch((error) =>
            updateStatus(error.message || String(error), true)
        );
    };

    updateStatus(
        "CWA folders loaded. Select a CWA folder and Model No."
    );
}

async function loadCwaFolderItems(folderId) {
    if (!currentOrigin || !currentToken) {
        throw new Error("Missing origin or access token.");
    }

    const items = await getFolderItems(
        currentOrigin,
        folderId,
        currentToken
    );

    // The IFC files are used only to populate Model No.
    // They are intentionally not displayed in a separate DATA/file-list panel.
    const models = (items || []).filter(
        (item) =>
            !isFolder(item) &&
            /\.ifc$/i.test(item.name || "")
    );

    setOptions(
        "strSelect",
        models,
        "Select a Model No"
    );

    document.getElementById("modelDescription").value = "";

    updateStatus(
        `${models.length} model(s) found in the selected CWA folder.`
    );
}

/*
 * Product Name in the Trimble Connect Properties panel corresponds to
 * the Product object's "name" value. The selected model's STR-name is
 * therefore taken from product.name first.
 *
 * The fallbacks below keep compatibility with different Core API response
 * shapes while still preferring Product Name.
 */
function extractStrName(item) {
    const candidates = [
        item?.product?.name,
        item?.product?.productName,
        item?.productName,

        item?.properties?.["Product Name"],
        item?.properties?.["product name"],
        item?.properties?.productName,

        item?.metadata?.product?.name,
        item?.metadata?.productName,

        item?.data?.product?.name,
        item?.data?.product?.productName,
        item?.data?.productName
    ];

    for (const value of candidates) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return "";
}

function extractProductDescription(item) {
    const candidates = [
        item?.product?.description,
        item?.productDescription,

        item?.properties?.["Product Description"],
        item?.properties?.["product description"],
        item?.properties?.productDescription,

        item?.metadata?.product?.description,
        item?.metadata?.productDescription,

        item?.data?.product?.description,
        item?.data?.productDescription
    ];

    for (const value of candidates) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return "";
}

async function loadModelDetails(itemId) {
    if (!currentOrigin || !currentToken) {
        throw new Error("Missing origin or access token.");
    }

    const url =
        `${currentOrigin}/tc/api/2.0/items/${encodeURIComponent(itemId)}`;

    const item = await requestJsonRaw(url, currentToken);

    console.debug("selected model item details:", item);

    const strNameEl = document.getElementById("modelDescription");

    /*
     * IMPORTANT:
     * The UI label is "Str-name".
     * Its value comes from Product Name, i.e. item.product.name,
     * which is the value represented by the Product > Product Name
     * property in Trimble Connect.
     */
    let strName = extractStrName(item);

    /*
     * Some Connect responses expose Product Name through a nested
     * version/product metadata object. Check the latest version when
     * the item response itself does not contain it.
     */
    if (!strName) {
        try {
            const versionsUrl =
                `${currentOrigin}/tc/api/2.0/items/${encodeURIComponent(itemId)}/versions`;

            const versions = await requestJsonRaw(
                versionsUrl,
                currentToken
            );

            if (Array.isArray(versions) && versions.length) {
                const latest = versions[0];
                strName = extractStrName(latest);

                const versionId =
                    latest?.id || latest?.versionId;

                if (!strName && versionId) {
                    const versionUrl =
                        `${currentOrigin}/tc/api/2.0/versions/${encodeURIComponent(versionId)}`;

                    const version = await requestJsonRaw(
                        versionUrl,
                        currentToken
                    );

                    strName = extractStrName(version);
                }
            }
        } catch (error) {
            console.debug(
                "Product Name version lookup failed:",
                error
            );
        }
    }

    /*
     * Product Description is deliberately NOT shown.
     * The requested Str-name field is the Product Name.
     */
    const productDescription = extractProductDescription(item);
    console.debug("Product Name:", strName);
    console.debug("Product Description (not displayed):", productDescription);

    strNameEl.value =
        strName || "(Product Name not available)";
}

async function registerLeftNavigation() {
    if (!api?.ui?.setMenu) {
        throw new Error(
            "This Trimble Connect host does not expose the UI navigation API."
        );
    }

    await api.ui.setMenu(menu);
    await api.ui.setActiveMenuItem(COMMANDS.assignment);
}

async function connectToWorkspace() {
    if (!window.TrimbleConnectWorkspace) {
        return updateStatus(
            "The Trimble Connect Workspace API did not load.",
            true
        );
    }

    try {
        api = await window.TrimbleConnectWorkspace.connect(
            window.parent,
            onWorkspaceEvent
        );

        await registerLeftNavigation();
        await loadCompletedData();
    } catch (error) {
        console.error(
            "Trimble Connect Workspace connection failed:",
            error
        );

        updateStatus(
            `Unable to load Trimble Connect data: ${error.message || String(error)}`,
            true
        );
    }
}

function onWorkspaceEvent(event, eventArgs) {
    if (event === "extension.accessToken") {
        const token = extractAccessToken(eventArgs?.data);

        if (
            looksLikeAccessToken(token) &&
            resolveAccessToken
        ) {
            resolveAccessToken(token);
        }

        return;
    }

    if (
        event !== "extension.command" ||
        !Object.values(COMMANDS).includes(eventArgs?.data)
    ) {
        return;
    }

    updateStatus(
        "Assignment opened from the Trimble Connect navigation."
    );
}

document.addEventListener("DOMContentLoaded", () => {
    document
        .getElementById("connectButton")
        .addEventListener("click", connectToWorkspace);

    document
        .getElementById("refreshButton")
        .addEventListener("click", () => {
            if (!api) {
                return connectToWorkspace();
            }

            loadCompletedData().catch((error) =>
                updateStatus(
                    error.message || String(error),
                    true
                )
            );
        });

    connectToWorkspace();
});
