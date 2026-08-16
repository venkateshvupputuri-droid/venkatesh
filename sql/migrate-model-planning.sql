/* Run once against ErectionPlanner before deploying model-specific planning. */
IF OBJECT_ID(N'dbo.ModelContractor', N'U') IS NULL
CREATE TABLE dbo.ModelContractor (
  ProjectId NVARCHAR(100) NOT NULL,
  ModelId NVARCHAR(100) NOT NULL,
  ModelName NVARCHAR(300) NULL,
  ContractorId INT NOT NULL REFERENCES dbo.Contractors(ContractorId),
  IsLocked BIT NOT NULL DEFAULT 0,
  AssignedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_ModelContractor PRIMARY KEY(ProjectId, ModelId)
);
IF COL_LENGTH('dbo.Plans','ModelId') IS NULL ALTER TABLE dbo.Plans ADD ModelId NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Plans','ModelName') IS NULL ALTER TABLE dbo.Plans ADD ModelName NVARCHAR(300) NULL;
IF COL_LENGTH('dbo.Plans','ViewId') IS NULL ALTER TABLE dbo.Plans ADD ViewId NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Plans','ViewImage') IS NULL ALTER TABLE dbo.Plans ADD ViewImage NVARCHAR(MAX) NULL;
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_Plans') ALTER TABLE dbo.Plans DROP CONSTRAINT UQ_Plans;
IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_Project_Model_PlanNumber') ALTER TABLE dbo.Plans ADD CONSTRAINT UQ_Project_Model_PlanNumber UNIQUE(ProjectId, ModelId, PlanNumber);
