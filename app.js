const API_BASE = (window.ERECTION_PLANNER_API_BASE || "/api").replace(/\/$/, "");
let workspace, projectId, activePlan, accessToken, tokenWaiter;
const el = (id) => document.getElementById(id);
const status = (message, kind = "") => { const n = el("statusMessage"); n.textContent = message; n.className = kind; };
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const extractToken = (value) => typeof value === "string" ? value : value?.accessToken || value?.token || value?.data?.accessToken || value?.data?.token || "";
const isAccessToken = (value) => typeof value === "string" && value.length > 32 && !/^(pending|denied)$/i.test(value);

async function token() {
  if (isAccessToken(accessToken)) return accessToken;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { tokenWaiter = undefined; reject(new Error("Allow access-token permission in Trimble Connect, then reload the extension.")); }, 15000);
    tokenWaiter = (value) => { clearTimeout(timeout); tokenWaiter = undefined; accessToken = value; resolve(value); };
    workspace.extension.requestPermission("accesstoken").then((result) => {
      const value = extractToken(result);
      if (isAccessToken(value) && tokenWaiter) tokenWaiter(value);
      if (/denied/i.test(String(result))) { clearTimeout(timeout); tokenWaiter = undefined; reject(new Error("Trimble access-token permission was denied.")); }
    }).catch((error) => { clearTimeout(timeout); tokenWaiter = undefined; reject(error); });
  });
}

async function api(path, options = {}, needsToken = false) {
  const headers = new Headers(options.headers); headers.set("Content-Type", "application/json");
  if (needsToken) headers.set("Authorization", `Bearer ${await token()}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function loadContractor() {
  const contractors = await api("/contractors");
  const select = el("contractorSelect");
  select.replaceChildren(new Option("Select contractor…", ""), ...contractors.map(c => new Option(c.ContractorName, c.ContractorId)));
  try {
    const assignment = await api(`/projects/${encodeURIComponent(projectId)}/contractor`, {}, true);
    const locked = Boolean(assignment?.IsLocked); el("contractorLocked").hidden = !locked; el("contractorEditor").hidden = locked;
    if (locked) { el("lockedContractorName").textContent = `Locked: ${assignment.ContractorName}`; el("lockedContractorMeta").textContent = `Locked ${new Date(assignment.AssignedDate).toLocaleString()}`; }
  } catch (error) { status(error.message, "error"); }
}

async function saveContractor() { const contractorId = el("contractorSelect").value; if (!contractorId || !confirm("Save and permanently lock this contractor for the project?")) return; await api(`/projects/${encodeURIComponent(projectId)}/contractor`, { method: "POST", body: JSON.stringify({ contractorId }) }, true); await loadContractor(); status("Contractor saved and locked.", "success"); }
async function loadPlans() { const plans = await api(`/projects/${encodeURIComponent(projectId)}/plans`, {}, true); const list = el("planList"); list.replaceChildren(...plans.map(plan => { const button = document.createElement("button"); button.className = activePlan?.PlanId === plan.PlanId ? "active" : ""; button.innerHTML = `<span>Plan ${plan.PlanNumber}${plan.PlanName ? ` — ${escapeHtml(plan.PlanName)}` : ""}</span><span>›</span>`; button.onclick = () => choosePlan(plan); const li = document.createElement("li"); li.append(button); return li; })); }
async function createPlan() { const planNumber = Number(el("newPlanNumber").value); const planName = el("newPlanName").value.trim(); if (!Number.isInteger(planNumber) || planNumber < 1) throw new Error("Enter a positive whole plan number."); await api(`/projects/${encodeURIComponent(projectId)}/plans`, { method: "POST", body: JSON.stringify({ planNumber, planName }) }, true); el("newPlanNumber").value = ""; el("newPlanName").value = ""; await loadPlans(); status(`Plan ${planNumber} created.`, "success"); }
async function choosePlan(plan) { activePlan = plan; el("assemblyCard").hidden = false; el("activePlanLabel").textContent = `Plan ${plan.PlanNumber}`; await Promise.all([loadPlans(), loadAssemblies()]); }
async function loadAssemblies() { const rows = await api(`/plans/${activePlan.PlanId}/assemblies`, {}, true); const body = el("assemblyTableBody"); body.replaceChildren(...rows.map(row => { const tr = document.createElement("tr"); tr.innerHTML = `<td>${row.SequenceCode}</td><td>${escapeHtml(row.AssemblyName || row.AssemblyGuid)}</td><td>${escapeHtml(row.AssemblyGuid)}</td>`; return tr; })); el("assemblyEmpty").hidden = rows.length > 0; }
function propertyValue(item, names) { const flat = (item.properties || []).flatMap(set => set.properties || []); const found = flat.find(p => names.includes(String(p.name || "").toLowerCase())); return found?.value == null ? "" : String(found.value); }
async function addSelection() { if (!activePlan) return; const selection = await workspace.viewer.getSelection(); if (!selection?.length) throw new Error("Select one or more assemblies in the 3D Viewer first."); const assemblies = []; for (const group of selection) { const props = await workspace.viewer.getObjectProperties(group.modelId, group.objectRuntimeIds); props.forEach((item, i) => { const runtimeId = group.objectRuntimeIds[i]; const guid = propertyValue(item, ["globalid", "ifcguid", "guid"]) || `${group.modelId}:${runtimeId}`; const name = propertyValue(item, ["assembly mark", "assembly", "mark", "name"]) || item.name || item.class || guid; assemblies.push({ modelId: group.modelId, guid, name }); }); } const result = await api(`/plans/${activePlan.PlanId}/assemblies`, { method: "POST", body: JSON.stringify({ assemblies }) }, true); await loadAssemblies(); status(result.inserted.length ? `${result.inserted.length} assembly(s) added.` : "Those assemblies are already in this plan.", "success"); }

function onWorkspaceEvent(event, eventArgs) { if (event !== "extension.accessToken") return; const value = extractToken(eventArgs); if (isAccessToken(value) && tokenWaiter) tokenWaiter(value); }
async function run(action) { try { await action(); } catch (error) { console.error(error); status(error.message || "Operation failed.", "error"); } }
async function init() { try { workspace = await TrimbleConnectWorkspace.connect(window.parent, onWorkspaceEvent, 30000); const project = await workspace.project.getProject(); projectId = project.id; el("projectName").textContent = project.name || projectId; el("contractorSelect").onchange = e => el("saveContractorBtn").disabled = !e.target.value; el("saveContractorBtn").onclick = () => run(saveContractor); el("createPlanBtn").onclick = () => run(createPlan); el("addSelectionBtn").onclick = () => run(addSelection); await loadContractor(); loadPlans().catch(error => status(error.message, "error")); status("Ready. Select a plan, then select assemblies in the 3D Viewer.", "success"); } catch (error) { console.error(error); status(error.message || "Unable to connect to Trimble Connect.", "error"); } }
init();
