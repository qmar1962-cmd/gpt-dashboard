# Permission Presets for Agent Teams

Pre-configured permission settings to reduce friction during team execution.

---

## Overview

Teammates inherit the lead's permission settings at spawn time. These presets allow you to pre-approve common operations before spawning, reducing permission prompts during execution.

**Key principle:** The more you pre-approve upfront, the smoother the team execution.

---

## Preset 1: "Permissive Development"

**Use case:** Development environment, fast iteration, trust your teammates.

**Philosophy:** Auto-approve common development operations. Teammates move fast without asking for permission.

**What gets auto-approved:**
- File reads across the codebase
- File writes to existing files
- Creating new files in designated directories (src/, tests/)
- Running test suites
- Running linters and formatters
- Running package installations
- Environment variables for development

**What still requires approval:**
- Destructive operations (delete, reset, cleanup)
- Pushing to version control
- Accessing secrets or production keys
- Database writes/mutations (in production)

### settings.json

```json
{
  "permissions": {
    "mode": "permissive",
    "context": "development",
    "preApproved": {
      "fileOperations": {
        "read": true,
        "write": true,
        "createNew": {
          "enabled": true,
          "paths": ["src/", "tests/", "docs/"]
        }
      },
      "codeExecution": {
        "testRun": true,
        "linting": true,
        "formatting": true,
        "build": true
      },
      "packageManagement": {
        "install": true,
        "update": true,
        "audit": true
      },
      "environmentVariables": {
        "read": true,
        "writeDevOnly": true
      }
    },
    "requiresApproval": {
      "fileOperations": ["delete", "move", "cleanup"],
      "codeExecution": ["push", "deployCloud"],
      "secrets": ["readProduction", "modifyProduction"],
      "database": ["deletionOperations", "productionWrites"]
    }
  },
  "teammateMode": "in-process"
}
```

### How to Activate

```bash
# Option 1: Set in ~/.claude/settings.json
cp preset-permissive-dev.json ~/.claude/settings.json

# Option 2: Override per session
claude --permissions permissive-development
```

### Expected Experience

```
Teammate: "Running tests..."
→ Auto-approved, tests run immediately

Teammate: "Formatting code..."
→ Auto-approved, formatter runs

Teammate: "I need to install a dev dependency"
→ Auto-approved, npm install runs

Teammate: "I want to delete test fixtures"
→ Blocked, requires approval
```

---

## Preset 2: "Guarded Production"

**Use case:** Production environment, safety-first, careful changes.

**Philosophy:** Require explicit approval for any write operation. Prevent accidental data loss or misconfiguration.

**What gets auto-approved:**
- File reads (read-only exploration)
- Test runs in isolated environment
- Code linting (analysis only, no changes)
- Build/compilation (no deployment)

**What requires approval:**
- Any file writes (new files, edits, modifications)
- Database operations (reads of metadata OK, writes require approval)
- Executing shell commands outside sandbox
- Installing packages
- Environment variable changes
- Deleting anything

### settings.json

```json
{
  "permissions": {
    "mode": "guarded",
    "context": "production",
    "preApproved": {
      "fileOperations": {
        "read": true,
        "write": false,
        "delete": false
      },
      "codeExecution": {
        "testRun": true,
        "linting": true,
        "formatting": false,
        "build": true,
        "deploy": false
      },
      "packageManagement": {
        "install": false,
        "update": false,
        "audit": true
      },
      "environmentVariables": {
        "read": true,
        "write": false
      },
      "database": {
        "readMetadata": true,
        "readData": false,
        "write": false,
        "delete": false
      }
    },
    "requiresApproval": {
      "fileOperations": ["write", "delete", "move", "createNew"],
      "codeExecution": ["push", "deploy", "runShell"],
      "packageManagement": ["install", "update"],
      "environmentVariables": ["write", "modify"],
      "database": ["readData", "write", "delete"]
    }
  },
  "teammateSandbox": true,
  "sandboxRestrictions": {
    "networkAccess": false,
    "fileSystemWrite": false,
    "shellCommandsUnrestricted": false
  }
}
```

### How to Activate

```bash
# Option 1: Set in ~/.claude/settings.json
cp preset-guarded-production.json ~/.claude/settings.json

# Option 2: Override per session
claude --permissions guarded-production
```

### Expected Experience

```
Teammate: "Reading the schema..."
→ Auto-approved, schema is displayed

Teammate: "Running integration tests..."
→ Auto-approved, tests run in sandbox

Teammate: "I need to update error handling"
→ Blocked, requires approval
  (Teammate submits changes, lead reviews and approves)

Teammate: "Deploying to production"
→ Blocked, requires approval
  (Lead must explicitly approve this)
```

---

## Preset 3: "Read-Only Research"

**Use case:** Research, analysis, code review, no execution or modifications.

**Philosophy:** Explore and analyze the codebase without touching anything. Safe for junior developers or external consultants.

**What gets auto-approved:**
- File reads
- Code search and analysis
- Running linters (analysis only)
- Viewing documentation
- Asking clarifying questions

**What is blocked:**
- Any file writes or creations
- Running code
- Installing anything
- Modifying environment
- Database access

### settings.json

```json
{
  "permissions": {
    "mode": "readonly",
    "context": "research",
    "preApproved": {
      "fileOperations": {
        "read": true,
        "write": false,
        "createNew": false,
        "delete": false
      },
      "codeExecution": {
        "testRun": false,
        "linting": "analysisOnly",
        "formatting": false,
        "build": false,
        "deploy": false
      },
      "packageManagement": {
        "install": false,
        "update": false,
        "audit": false
      },
      "environmentVariables": {
        "read": false,
        "write": false
      },
      "database": {
        "read": false,
        "write": false,
        "delete": false
      },
      "search": true,
      "analysis": true
    },
    "blockedOperations": [
      "fileWrites",
      "codeExecution",
      "packageManagement",
      "environmentChanges",
      "databaseAccess",
      "shellCommands"
    ]
  }
}
```

### How to Activate

```bash
# Option 1: Set in ~/.claude/settings.json
cp preset-readonly-research.json ~/.claude/settings.json

# Option 2: Override per session
claude --permissions readonly-research
```

### Expected Experience

```
Teammate: "Searching for all API endpoints..."
→ Auto-approved, search results displayed

Teammate: "Let me read the auth middleware..."
→ Auto-approved, file displayed

Teammate: "I'd like to run the test suite"
→ Blocked, code execution not allowed

Teammate: "Creating a summary document..."
→ Blocked, file writes not allowed
```

---

## How Permission Prompts Bubble Up

When a teammate needs approval that's not pre-approved:

```
Timeline:
1. Teammate attempts operation
2. Permission system checks pre-approved list
3. Not found → Permission prompt sent to lead
4. Lead sees prompt in their chat
5. Lead approves/denies
6. Teammate's operation proceeds or fails based on decision
```

### Example: Permissive Development, Teammate Wants to Delete

```
Teammate: "Removing unused test fixtures..."
System: [Permission prompt] Teammate is requesting to delete:
  - tests/fixtures/old-data.json
  - tests/fixtures/deprecated.json

Do you want to allow this deletion? (Yes/No)

Lead: "Yes"
Teammate: "Deletion complete."
```

---

## Changing Teammate Permissions After Spawning

### Updating Individual Teammate Permissions

```bash
# Increase permissions for a specific teammate
Lead: "Teammate Database, I'm granting you database write permissions for schema changes only"

# Claude system: Permission updated
```

### Temporary Approval for One-Off Operations

```bash
Lead: "For this one time, Teammate API, you can push to GitHub"
Lead: "Then reset your permissions back to development"

Teammate: "Got it. Pushing now... Done. Resetting permissions."
```

### Emergency Restrictions

```bash
Lead: "Teammate Backend, all file writes are now blocked. Use read-only mode."
Lead: "When you've synced with Teammate Frontend, I'll re-enable writes"

Teammate: "Understood. Switching to read-only."
```

### Viewing Current Permissions

```bash
Lead: "Show my permissions"
System:
  Current permission preset: permissive-development
  Pre-approved: file reads/writes, test runs, linting
  Requires approval: delete, push, secrets

Lead: "Show Teammate Backend permissions"
System:
  Teammate Backend permissions: permissive-development
  Pre-approved: file reads/writes, test runs, linting
  Requires approval: delete, push, secrets
```

---

## Settings.json Format for Each Preset

### Template Structure

```json
{
  "permissions": {
    "mode": "permissive|guarded|readonly",
    "context": "development|production|research",
    "preApproved": {
      "fileOperations": {
        "read": boolean,
        "write": boolean,
        "delete": boolean,
        "createNew": boolean|object
      },
      "codeExecution": {
        "testRun": boolean,
        "linting": boolean|string,
        "formatting": boolean,
        "build": boolean,
        "deploy": boolean
      },
      "packageManagement": {
        "install": boolean,
        "update": boolean,
        "audit": boolean
      },
      "environmentVariables": {
        "read": boolean,
        "write": boolean
      },
      "database": {
        "read": boolean,
        "write": boolean,
        "delete": boolean
      },
      "search": boolean,
      "analysis": boolean
    },
    "requiresApproval": ["operation1", "operation2"],
    "blockedOperations": ["operation1", "operation2"]
  },
  "teammateSandbox": boolean,
  "sandboxRestrictions": {
    "networkAccess": boolean,
    "fileSystemWrite": boolean,
    "shellCommandsUnrestricted": boolean
  }
}
```

---

## Comparison Table: All Presets

| **Operation** | **Permissive Dev** | **Guarded Prod** | **Read-Only Research** |
|:---|:---|:---|:---|
| File reads | ✓ Auto | ✓ Auto | ✓ Auto |
| File writes | ✓ Auto | ✗ Ask | ✗ Blocked |
| Create new files | ✓ Auto (src/, tests/) | ✗ Ask | ✗ Blocked |
| Delete files | ✗ Ask | ✗ Ask | ✗ Blocked |
| Run tests | ✓ Auto | ✓ Auto (sandbox) | ✗ Blocked |
| Run linting | ✓ Auto | ✓ Auto | ✓ Auto (analysis only) |
| Format code | ✓ Auto | ✗ Ask | ✗ Blocked |
| Build/compile | ✓ Auto | ✓ Auto (no deploy) | ✗ Blocked |
| Deploy | ✗ Ask | ✗ Ask | ✗ Blocked |
| Install packages | ✓ Auto | ✗ Ask | ✗ Blocked |
| Update packages | ✓ Auto | ✗ Ask | ✗ Blocked |
| Env vars (read) | ✓ Auto (dev) | ✓ Auto (metadata) | ✗ Blocked |
| Env vars (write) | ✓ Auto (dev) | ✗ Ask | ✗ Blocked |
| Database (read) | ✓ Auto | ✗ Ask | ✗ Blocked |
| Database (write) | ✗ Ask (ask for prod) | ✗ Ask | ✗ Blocked |
| Search/analysis | ✓ Auto | ✓ Auto | ✓ Auto |

---

## Best Practices

### 1. Start with the Right Preset
```
Development work → Use Permissive Development
Production changes → Use Guarded Production
External reviewers → Use Read-Only Research
```

### 2. Pre-Approve Common Operations
Don't ask for permission on every linting or test run. Batch pre-approvals by operation type.

### 3. Reduce Permission Prompts Over Time
```
First session: 20 permission prompts
After tuning presets: 2-3 permission prompts
```

### 4. Audit Teammate Permissions
```bash
# Before spawning large team
Lead: "Show all permissions for this team"
System: [Lists all pre-approved and blocked operations]
```

### 5. Emergency Lockdown
```bash
# If you suspect misuse or need to be extra cautious
Lead: "Lock down all teammates to read-only"
System: All teammates now have read-only permissions
```

---

## Quick Setup Workflow

1. **Before spawning:**
   ```bash
   # Choose preset
   cp preset-permissive-dev.json ~/.claude/settings.json
   # (or guarded-production, or readonly-research)
   ```

2. **Spawn teammates:**
   ```
   Lead: "Spawn Backend specialist and Frontend specialist"
   # They inherit your permission preset
   ```

3. **Monitor permissions during execution:**
   ```
   Teammate: *Requests operation*
   System: *Checks pre-approved list*
   Lead: *Approves if needed*
   ```

4. **Adjust if needed:**
   ```
   Lead: "Teammate, you can now write to the database"
   # Permission updated on the fly
   ```
