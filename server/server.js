require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
// Local SQL Express commonly has TCP/IP disabled. The native driver supports
// Windows Authentication and named local instances without opening SQL Server
// to the network. Production deployments continue to use the default mssql driver.
const sql = process.env.DB_AUTH === "windows"
  ? require("mssql/msnodesqlv8")
  : require("mssql");
const app = express();
const origins = (process.env.CORS_ORIGIN || "").split(",").map(x => x.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : false }));
app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "..")));
const db = process.env.DB_AUTH === "windows"
  ? {
      driver: "msnodesqlv8",
      connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${process.env.DB_SERVER || "localhost\\SQLEXPRESS"};Database=${process.env.DB_NAME};Trusted_Connection=Yes;TrustServerCertificate=Yes;`
    }
  : {
      server: process.env.DB_SERVER,
      port: Number(process.env.DB_PORT || 1433),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      options: { encrypt: process.env.DB_ENCRYPT !== "false", trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === "true" }
    };
let poolPromise;
const pool = () => poolPromise ||= new sql.ConnectionPool(db).connect();
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
function validProjectId(value) { return typeof value === "string" && value.length > 0 && value.length <= 100; }
async function verifyProjectAccess(req, res, next) {
  const projectId = req.params.projectId;
  const auth = req.get("authorization");
  if (!validProjectId(projectId)) return res.status(400).json({error:"Invalid project id"});
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({error:"A Trimble Connect access token is required."});
  const origins = [
    process.env.TRIMBLE_API_ORIGIN,
    "https://app.connect.trimble.com",
    "https://app21.connect.trimble.com",
    "https://app31.connect.trimble.com",
    "https://app32.connect.trimble.com",
    "https://app22.connect.trimble.com"
  ].filter(Boolean).map(x => x.replace(/\/$/, ""));
  let completedRequest = false;
  for (const base of [...new Set(origins)]) {
    try {
      const check = await fetch(`${base}/tc/api/2.0/projects/${encodeURIComponent(projectId)}`, { headers:{authorization:auth,accept:"application/json"} });
      completedRequest = true;
      if (check.ok) return next();
    } catch (error) { console.warn("Trimble project validation failed for", base, error.message); }
  }
  if (completedRequest) return res.status(403).json({error:"You do not have access to this Trimble Connect project."});
  return res.status(503).json({error:"Could not verify Trimble Connect access."});
}
app.get("/api/contractors", asyncRoute(async (_req,res) => { const r=await (await pool()).request().query("SELECT ContractorId, ContractorName FROM dbo.Contractors WHERE IsActive=1 ORDER BY ContractorName"); res.json(r.recordset); }));
app.get("/api/projects/:projectId/contractor", verifyProjectAccess, asyncRoute(async (req,res) => { const r=await (await pool()).request().input("projectId",sql.NVarChar(100),req.params.projectId).query("SELECT pc.ProjectId,pc.ContractorId,c.ContractorName,pc.IsLocked,pc.AssignedDate FROM dbo.ProjectContractor pc JOIN dbo.Contractors c ON c.ContractorId=pc.ContractorId WHERE pc.ProjectId=@projectId"); res.json(r.recordset[0] || null); }));
app.post("/api/projects/:projectId/contractor", verifyProjectAccess, asyncRoute(async (req,res) => { const contractorId=Number(req.body.contractorId); if(!Number.isInteger(contractorId)) return res.status(400).json({error:"contractorId is required"}); const p=await pool(), tx=new sql.Transaction(p); await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE); try { const q=new sql.Request(tx); const exists=await q.input("projectId",sql.NVarChar(100),req.params.projectId).query("SELECT IsLocked FROM dbo.ProjectContractor WITH (UPDLOCK,HOLDLOCK) WHERE ProjectId=@projectId"); if(exists.recordset[0]?.IsLocked) { await tx.rollback(); return res.status(409).json({error:"Contractor is already locked."}); } const result=await new sql.Request(tx).input("contractorId",sql.Int,contractorId).query("SELECT ContractorId FROM dbo.Contractors WHERE ContractorId=@contractorId AND IsActive=1"); if(!result.recordset.length) { await tx.rollback(); return res.status(400).json({error:"Unknown contractor."}); } await new sql.Request(tx).input("projectId",sql.NVarChar(100),req.params.projectId).input("contractorId",sql.Int,contractorId).query("MERGE dbo.ProjectContractor AS t USING (SELECT @projectId AS ProjectId) s ON t.ProjectId=s.ProjectId WHEN MATCHED THEN UPDATE SET ContractorId=@contractorId,IsLocked=1,AssignedDate=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(ProjectId,ContractorId,IsLocked) VALUES(@projectId,@contractorId,1);"); await tx.commit(); res.json({success:true}); } catch(e) { try{await tx.rollback();}catch{} throw e; } }));
app.get("/api/projects/:projectId/plans", verifyProjectAccess, asyncRoute(async (req,res)=>{const r=await (await pool()).request().input("projectId",sql.NVarChar(100),req.params.projectId).query("SELECT PlanId,ProjectId,PlanNumber,PlanName,CreatedDate FROM dbo.Plans WHERE ProjectId=@projectId ORDER BY PlanNumber");res.json(r.recordset);}));
app.post("/api/projects/:projectId/plans", verifyProjectAccess, asyncRoute(async(req,res)=>{const no=Number(req.body.planNumber),name=String(req.body.planName||"").trim()||null;if(!Number.isInteger(no)||no<1)return res.status(400).json({error:"planNumber must be a positive whole number"});try{const r=await (await pool()).request().input("projectId",sql.NVarChar(100),req.params.projectId).input("no",sql.Int,no).input("name",sql.NVarChar(200),name).query("INSERT dbo.Plans(ProjectId,PlanNumber,PlanName) OUTPUT INSERTED.PlanId VALUES(@projectId,@no,@name)");res.status(201).json({planId:r.recordset[0].PlanId});}catch(e){if([2601,2627].includes(e.number))return res.status(409).json({error:"That plan number already exists."});throw e;}}));
async function projectForPlan(planId){const r=await (await pool()).request().input("id",sql.Int,planId).query("SELECT ProjectId FROM dbo.Plans WHERE PlanId=@id");return r.recordset[0]?.ProjectId;}
async function planAuth(req,res,next){const id=Number(req.params.planId);if(!Number.isInteger(id))return res.status(400).json({error:"Invalid plan id"});const pid=await projectForPlan(id);if(!pid)return res.status(404).json({error:"Plan not found"});req.params.projectId=pid;return verifyProjectAccess(req,res,next);}
app.get("/api/plans/:planId/assemblies", planAuth, asyncRoute(async(req,res)=>{const r=await (await pool()).request().input("id",sql.Int,req.params.planId).query("SELECT pa.Id,pa.PlanId,pa.ModelId,pa.ObjectRuntimeId,pa.AssemblyGuid,pa.AssemblyName,pa.AssemblyMark,pa.Weight,pa.SequenceOrder,CONCAT(p.PlanNumber,'-',pa.SequenceOrder) SequenceCode FROM dbo.PlanAssemblies pa JOIN dbo.Plans p ON p.PlanId=pa.PlanId WHERE pa.PlanId=@id ORDER BY pa.SequenceOrder");res.json(r.recordset);}));
app.post("/api/plans/:planId/assemblies", planAuth, asyncRoute(async(req,res)=>{const items=Array.isArray(req.body.assemblies)?req.body.assemblies:[];const clean=[...new Map(items.filter(x=>x&&typeof x.guid==="string"&&x.guid.length<=100).map(x=>[x.guid,{guid:x.guid,modelId:String(x.modelId||"").slice(0,100)||null,runtimeId:Number(x.runtimeId)||null,name:String(x.name||"").slice(0,300)||null,mark:String(x.mark||"").slice(0,100)||null,weight:Number(x.weight)||0}])).values()];if(!clean.length)return res.status(400).json({error:"Select at least one valid assembly."});const tx=new sql.Transaction(await pool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);try{const plan=(await new sql.Request(tx).input("id",sql.Int,req.params.planId).query("SELECT PlanNumber FROM dbo.Plans WITH(UPDLOCK,HOLDLOCK) WHERE PlanId=@id")).recordset[0];if(!plan){await tx.rollback();return res.status(404).json({error:"Plan not found"});}let order=(await new sql.Request(tx).input("id",sql.Int,req.params.planId).query("SELECT ISNULL(MAX(SequenceOrder),0) maxOrder FROM dbo.PlanAssemblies WITH(UPDLOCK,HOLDLOCK) WHERE PlanId=@id")).recordset[0].maxOrder+1;const inserted=[];for(const x of clean){const dupe=await new sql.Request(tx).input("id",sql.Int,req.params.planId).input("guid",sql.NVarChar(100),x.guid).query("SELECT 1 found FROM dbo.PlanAssemblies WHERE PlanId=@id AND AssemblyGuid=@guid");if(dupe.recordset.length)continue;await new sql.Request(tx).input("id",sql.Int,req.params.planId).input("model",sql.NVarChar(100),x.modelId).input("runtime",sql.Int,x.runtimeId).input("guid",sql.NVarChar(100),x.guid).input("name",sql.NVarChar(300),x.name).input("mark",sql.NVarChar(100),x.mark).input("weight",sql.Decimal(12,3),x.weight).input("order",sql.Int,order).query("INSERT dbo.PlanAssemblies(PlanId,ModelId,ObjectRuntimeId,AssemblyGuid,AssemblyName,AssemblyMark,Weight,SequenceOrder) VALUES(@id,@model,@runtime,@guid,@name,@mark,@weight,@order)");inserted.push({guid:x.guid,name:x.name,sequenceCode:`${plan.PlanNumber}-${order++}`});}await tx.commit();res.json({success:true,inserted});}catch(e){try{await tx.rollback();}catch{}throw e;}}));
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:"Unexpected server error."});});
app.listen(process.env.PORT||4000,()=>console.log(`Erection Planner listening on ${process.env.PORT||4000}`));
