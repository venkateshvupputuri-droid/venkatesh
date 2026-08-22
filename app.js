const API_BASE = (window.ERECTION_PLANNER_API_BASE || "/api").replace(/\/$/, "");
let workspace, projectId, activePlan, selectedPlans = [], accessToken, tokenWaiter, displayedAssemblies = [];
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
  if (!currentModel) { currentModel = (await workspace.viewer.getModels("loaded"))[0]; if (!currentModel) throw new Error("Open one IFC model in the 3D Viewer first."); }
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
async function choosePlan(plan) { const selected = selectedPlans.some(item => item.PlanId === plan.PlanId); selectedPlans = selected ? selectedPlans.filter(item => item.PlanId !== plan.PlanId) : [...selectedPlans, plan]; activePlan = selectedPlans[0]; el("assemblyCard").hidden = !selectedPlans.length; el("activePlanLabel").textContent = selectedPlans.map(item => `Plan ${item.PlanNumber}`).join(", "); await Promise.all([loadPlans(), loadAssemblies()]); }
async function loadAssemblies() { const rowsByPlan = await Promise.all(selectedPlans.map(plan => api(`/plans/${plan.PlanId}/assemblies`, {}, true))); displayedAssemblies = rowsByPlan.flat(); const body = el("assemblyTableBody"); let total = 0; const tableRows = displayedAssemblies.map((row, index) => { total += Number(row.Weight) || 0; const tr = document.createElement("tr"); tr.innerHTML = `<td>${index + 1}</td><td>${row.SequenceCode}</td><td>${escapeHtml(row.AssemblyName || row.AssemblyGuid)}</td><td>${escapeHtml(row.AssemblyMark || "—")}</td><td>${Number(row.Weight || 0).toFixed(3)}</td><td>${escapeHtml(row.Grid || "—")}</td><td>${escapeHtml(row.Tos || "—")}</td>`; return tr; }); const totalRow = document.createElement("tr"); totalRow.innerHTML = `<td colspan="4"><strong>Total weight</strong></td><td><strong>${total.toFixed(3)}</strong></td><td colspan="2">t</td>`; body.replaceChildren(...tableRows, totalRow); el("assemblyEmpty").hidden = displayedAssemblies.length > 0; el("totalWeight").hidden = true; }
function propertyValue(item, names) { const flat = (item.properties || []).flatMap(set => set.properties || []); const found = flat.find(p => names.includes(String(p.name || "").toLowerCase().replace(/[_/]+/g, " ").trim())); return found?.value == null ? "" : String(found.value); }
async function addSelection() { if (!activePlan) return; const selection = await workspace.viewer.getSelection(); if (!selection?.length) throw new Error("Select one or more assemblies in the 3D Viewer first."); const assemblies = []; for (const group of selection) { const props = await workspace.viewer.getObjectProperties(group.modelId, group.objectRuntimeIds); props.forEach((item, i) => { const runtimeId = group.objectRuntimeIds[i]; const guid = propertyValue(item, ["globalid", "ifcguid", "guid"]) || `${group.modelId}:${runtimeId}`; const mark = propertyValue(item, ["assembly cast unit mark"]); const name = propertyValue(item, ["assembly name"]) || item.name || item.class || guid; const weight = Number((propertyValue(item, ["assembly cast unit weight", "weight"]) || "0").replace(/[^0-9.-]/g, "")) || 0; const grid = propertyValue(item, ["assembly cast unit position code"]); const tos = propertyValue(item, ["assembly cast unit top elevation"]); assemblies.push({ modelId: group.modelId, runtimeId, guid, name, mark, weight, grid, tos }); }); } const result = await api(`/plans/${activePlan.PlanId}/assemblies`, { method: "POST", body: JSON.stringify({ assemblies }) }, true); await loadAssemblies(); status(result.inserted.length ? `${result.inserted.length} assembly(s) added.` : "Those assemblies are already in this plan.", "success"); }
function colourSelector(rows) {
  const objectRuntimeIds = [...new Set(rows
    .filter(row => String(row.ModelId || currentModel.id) === String(currentModel.id))
    .map(row => Number(row.ObjectRuntimeId))
    .filter(runtimeId => Number.isInteger(runtimeId) && runtimeId > 0))];
  return objectRuntimeIds.length ? { modelId: currentModel.id, objectRuntimeIds } : undefined;
}

async function colourizePlan() {
  if (!selectedPlans.length) throw new Error("Select at least one plan first.");
  const rowsByPlan = await Promise.all(selectedPlans.map(plan => api(`/plans/${plan.PlanId}/assemblies`, {}, true)));
  const selectors = rowsByPlan.map(colourSelector);
  const usableRows = selectors.reduce((count, selector) => count + (selector?.objectRuntimeIds.length || 0), 0);
  if (!usableRows) throw new Error("The selected assemblies have no current viewer IDs. Select them again in the 3D Viewer and use Add current 3D selection.");

  // An undefined selector intentionally colours every loaded object grey first.
  await workspace.viewer.setObjectState(undefined, { color: "#8b9299", opacity: 1 });
  const palette = ["#f97316", "#ec4899", "#8b5cf6", "#14b8a6", "#eab308", "#ef4444", "#06b6d4", "#84cc16"];
  const coloured = new Set();
  let colouredCount = 0;
  for (const [index, selector] of selectors.entries()) {
    if (!selector) continue;
    selector.objectRuntimeIds = selector.objectRuntimeIds.filter(runtimeId => !coloured.has(`${selector.modelId}:${runtimeId}`));
    selector.objectRuntimeIds.forEach(runtimeId => coloured.add(`${selector.modelId}:${runtimeId}`));
    if (!selector.objectRuntimeIds.length) continue;

    // setObjectState accepts one ObjectSelector, not an array of selectors.
    await workspace.viewer.setObjectState(selector, { color: palette[index % palette.length], opacity: 1 });
    colouredCount += selector.objectRuntimeIds.length;
  }
  status(`${colouredCount} assemblies coloured across ${selectedPlans.length} plan(s); other IFC assemblies are grey.`, "success");
}
async function resetColours() { await workspace.viewer.setObjectState(undefined, { color: "reset" }); status("Model colours reset.", "success"); }
function downloadExcel() { if (!activePlan || !displayedAssemblies.length) throw new Error("Select a plan with assemblies first."); const total = displayedAssemblies.reduce((sum, row) => sum + (Number(row.Weight) || 0), 0); const cells = (values) => values.map(value => `<Cell><Data ss:Type="String">${escapeHtml(value)}</Data></Cell>`).join(""); const rows = displayedAssemblies.map((row, i) => `<Row>${cells([i + 1, row.SequenceCode, row.AssemblyName || row.AssemblyGuid, row.AssemblyMark || "", Number(row.Weight || 0).toFixed(3), row.Grid || "", row.Tos || ""])}</Row>`).join(""); const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Plan ${activePlan.PlanNumber}"><Table><Row>${cells(["Serial no.", "Sequence no.", "Assembly name", "Assembly mark", "Weight (t)", "Grid", "TOS"])}</Row>${rows}<Row>${cells(["", "", "", "Total weight (t)", total.toFixed(3), "", ""])}</Row></Table></Worksheet></Workbook>`; const blob = new Blob([xml], { type: "application/vnd.ms-excel" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `Erection-Plan-${activePlan.PlanNumber}.xls`; link.click(); URL.revokeObjectURL(link.href); }

function onWorkspaceEvent(event, eventArgs) { if (event !== "extension.accessToken") return; const value = extractToken(eventArgs); if (isAccessToken(value) && tokenWaiter) tokenWaiter(value); }
async function run(action) { try { await action(); } catch (error) { console.error(error); status(error.message || "Operation failed.", "error"); } }
async function init() { try { workspace = await TrimbleConnectWorkspace.connect(window.parent, onWorkspaceEvent, 30000); const project = await workspace.project.getProject(); projectId = project.id; el("projectName").textContent = project.name || projectId; el("contractorSelect").onchange = e => el("saveContractorBtn").disabled = !e.target.value; el("saveContractorBtn").onclick = () => run(saveContractor); el("createPlanBtn").onclick = () => run(createPlan); el("addSelectionBtn").onclick = () => run(addSelection); el("colourizePlansBtn").onclick = () => run(colourizePlan); el("resetColoursBtn").onclick = () => run(resetColours); el("downloadExcelBtn").onclick = () => run(downloadExcel); await loadContractor(); loadPlans().catch(error => status(error.message, "error")); status("Ready. Select a plan, then select assemblies in the 3D Viewer.", "success"); } catch (error) { console.error(error); status(error.message || "Unable to connect to Trimble Connect.", "error"); } }
init();

/* Override project-wide handlers with IFC-model scoped handlers. */
var currentModel;
async function loadContractor() { const contractors=await api("/contractors"); const select=el("contractorSelect"); select.replaceChildren(new Option("Select contractor…",""),...contractors.map(c=>new Option(c.ContractorName,c.ContractorId))); const assignment=await api(`/projects/${encodeURIComponent(projectId)}/models/${encodeURIComponent(currentModel.id)}/contractor`,{},true); const locked=Boolean(assignment?.IsLocked); el("contractorLocked").hidden=!locked; el("contractorEditor").hidden=locked; if(locked){el("lockedContractorName").textContent=`Locked: ${assignment.ContractorName}`;el("lockedContractorMeta").textContent=`Locked for ${currentModel.name||"this IFC"}`;} }
async function saveContractor(){const contractorId=el("contractorSelect").value;if(!contractorId||!confirm("Save and permanently lock this contractor for this IFC?"))return;await api(`/projects/${encodeURIComponent(projectId)}/models/${encodeURIComponent(currentModel.id)}/contractor`,{method:"POST",body:JSON.stringify({contractorId,modelName:currentModel.name})},true);await loadContractor();status("Contractor saved and locked for this IFC.","success");}
async function loadPlans(){const plans=await api(`/projects/${encodeURIComponent(projectId)}/models/${encodeURIComponent(currentModel.id)}/plans`,{},true);const list=el("planList");list.replaceChildren(...plans.map(plan=>{const checked=selectedPlans.some(item=>item.PlanId===plan.PlanId);const label=document.createElement("label");label.className="plan-toggle";const input=document.createElement("input");input.type="checkbox";input.checked=checked;input.setAttribute("aria-label",`Select plan ${plan.PlanNumber}`);input.onchange=()=>run(()=>choosePlan(plan));const text=document.createElement("span");text.textContent=`Plan ${plan.PlanNumber}${plan.PlanName?` — ${plan.PlanName}`:""}`;label.append(input,text);const li=document.createElement("li");li.append(label);return li;}));}
async function createPlan(){const planNumber=Number(el("newPlanNumber").value),planName=el("newPlanName").value.trim();if(!Number.isInteger(planNumber)||planNumber<1)throw new Error("Enter a positive whole plan number.");await api(`/projects/${encodeURIComponent(projectId)}/models/${encodeURIComponent(currentModel.id)}/plans`,{method:"POST",body:JSON.stringify({planNumber,planName,modelName:currentModel.name})},true);el("newPlanNumber").value="";el("newPlanName").value="";await loadPlans();}
async function resolveLoadedModel(){
  let models=[];
  try { models=await workspace.viewer.getModels("loaded"); } catch (_) { /* Older viewer API: use all viewer models below. */ }
  if (!models?.length) models=await workspace.viewer.getModels();
  currentModel=models.find(model=>model.state==="loaded"||model.loaded===true)||models[0];
  if(!currentModel)throw new Error("Open an IFC model in the 3D Viewer, then click Connect / refresh IFC.");
}
async function connectPlanner(){try{
  if(!workspace)workspace=await TrimbleConnectWorkspace.connect(window.parent,onWorkspaceEvent,30000);
  const project=await workspace.project.getProject();projectId=project.id;
  await resolveLoadedModel();activePlan=undefined;selectedPlans=[];el("assemblyCard").hidden=true;
  el("projectName").textContent=`${project.name||projectId} — ${currentModel.name||"Loaded IFC"}`;
  await loadContractor();await loadPlans();
  status("Connected. Contractor and plans shown for this IFC only.","success");
}catch(e){console.error(e);status(e.message||"Unable to connect.","error");}}
async function init(){
  el("contractorSelect").onchange=e=>el("saveContractorBtn").disabled=!e.target.value;
  el("saveContractorBtn").onclick=()=>run(saveContractor);el("createPlanBtn").onclick=()=>run(createPlan);
  el("addSelectionBtn").onclick=()=>run(addSelection);el("colourizePlansBtn").onclick=()=>run(colourizePlan);
  el("resetColoursBtn").onclick=()=>run(resetColours);el("downloadExcelBtn").onclick=()=>run(downloadExcel);
  el("connectButton").onclick=()=>run(connectPlanner);await connectPlanner();
}
