# Deployment Standards

Deployment methods and best practices for NetSuite customizations.

## Deployment Density Limits

For high-traffic records (SO, PO, Invoice, Customer, Item), apply these practical caps before adding another script or workflow:

| Automation Type | Soft Limit | Action When Exceeded |
|----------------|------------|---------------------|
| User Event scripts per event per record | 3 | Merge into one. (Exception: create separate script if governance units exceed 1,000) |
| Client Scripts per form | **1** | Must consolidate — multiple CS cause event conflicts and unpredictable load order |
| Active workflows per record type (same event) | 3–4 | Consolidation candidate |
| Combined automations (scripts + workflows) per record/event | 8–10 | Consolidation candidate |

## Execution Context

Always gate User Event scripts with an execution context check to prevent unintended triggers during CSV imports, web service calls, or workflow actions. See `../suitescript/snippets/execution-context.md`.

## Script ID Naming

Script IDs in NetSuite must use underscores between ALL segments:
- `custrecord_othcfg_description` (correct)
- `custrecordothcfg_description` (incorrect — missing underscore, causes SDF deployment failures and lookup errors)

This applies to all custom object IDs: `customscript_`, `customrecord_`, `custbody_`, etc.

## Deployment Methods

| Method | Best For | Pros | Cons |
|--------|----------|------|------|
| **SDF (SuiteCloud Development Framework)** | Code-based projects, version control | Version control, automation | Learning curve |
| **SuiteBundler** | Distributable solutions | Easy packaging, marketplace | Limited versioning |
| **Manual Upload** | Quick fixes, small changes | Simple, immediate | No version control |

## SDF Deployment

### Project Structure

```
project/
├── src/
│   └── FileCabinet/
│       └── SuiteScripts/
│           └── [company]/
│               └── [module]/
│                   ├── script.js
│                   └── lib/
├── Objects/
│   ├── custbody_st_field.xml
│   ├── customscript_st_script.xml
│   └── customrecord_st_record.xml
├── deploy.xml
├── manifest.xml
└── project.json
```

### SDF Commands

```bash
# ALWAYS validate before deploying — catches missing object references and dependency errors
suitecloud account:validate

# Validate project structure locally
suitecloud project:validate

# Deploy to sandbox
suitecloud project:deploy --account SANDBOX_ACCOUNT_ID

# Deploy to production
suitecloud project:deploy --account PROD_ACCOUNT_ID

# Import objects from account
suitecloud object:import --type customscript --scriptid customscript_softype_ue_so_core

# List objects in project
suitecloud object:list
```

### deploy.xml

```xml
<deploy>
    <configuration>
        <path>~/FileCabinet/SuiteScripts/softype/*</path>
    </configuration>
    <objects>
        <path>~/Objects/*</path>
    </objects>
</deploy>
```

### Wave-Based Deployment Strategy

Use wave-based deployments to handle circular dependency and object mismatch errors at scale. Group objects by dependency tier — deploy independent objects first, dependent objects in later waves.

```
Wave 1: Custom lists, standalone custom records (no dependencies)
Wave 2: Custom fields that reference Wave 1 objects
Wave 3: Scripts, workflows, saved searches (depend on fields/records)
Wave 4: Script deployments and workflow deployments
```

**Additional SDF rules:**
- Always run `suitecloud account:validate` before deploying — catches missing object references before they cause partial/broken deployments
- Maintain separate SDF projects per module or functional domain — a monolithic project becomes unmanageable at scale
- Never include client-specific custom record IDs or hardcoded account values in a reusable bundle — parameterise via Script Parameters or config records

## Manual Deployment

### Pre-Deployment Checklist

- [ ] Code reviewed and approved
- [ ] Tested in sandbox
- [ ] UAT sign-off obtained
- [ ] Deployment window scheduled
- [ ] Rollback plan documented
- [ ] Stakeholders notified

### Deployment Steps

1. **Backup existing scripts** (if updating)
   - Download current version
   - Note current deployment settings

2. **Upload script files**
   - Documents > Files > SuiteScripts
   - Maintain folder structure

3. **Create/Update script record**
   - Customization > Scripting > Scripts
   - Set script file reference
   - Configure parameters

4. **Create/Update deployment**
   - Set trigger conditions
   - Configure execution context
   - Set status to Testing

5. **Test deployment**
   - Verify trigger conditions
   - Test all scenarios
   - Check logs

6. **Activate deployment**
   - Change status to Released
   - Monitor for issues

### Post-Deployment Verification

```javascript
/**
 * Verify deployment is working
 */
function verifyDeployment(scriptId, deploymentId) {
    const checks = {
        scriptExists: false,
        deploymentActive: false,
        executionLogs: false
    };

    // Check script exists
    try {
        const scriptRec = record.load({
            type: 'script',
            id: scriptId
        });
        checks.scriptExists = true;
    } catch (e) {
        log.error({ title: 'Script not found', details: scriptId });
    }

    // Check deployment status
    const deployments = search.create({
        type: 'scriptdeployment',
        filters: [
            ['script', 'is', scriptId],
            'AND',
            ['status', 'is', 'RELEASED']
        ]
    }).run().getRange({ start: 0, end: 10 });

    checks.deploymentActive = deployments.length > 0;

    // Check recent execution logs
    const logs = search.create({
        type: 'scriptexecutionlog',
        filters: [
            ['script', 'is', scriptId],
            'AND',
            ['datecreated', 'within', 'today']
        ]
    }).run().getRange({ start: 0, end: 1 });

    checks.executionLogs = logs.length > 0;

    return checks;
}
```

## Deployment Environments

### Environment Flow

```
DEV (Local) → SANDBOX → UAT → PRODUCTION
     ↓             ↓        ↓         ↓
  Develop      Test     Validate   Release
```

### Environment Configuration

| Setting | Sandbox | Production |
|---------|---------|------------|
| Script Status | Testing/Released | Released |
| Log Level | Debug | Audit |
| Email Recipients | Test addresses | Real addresses |
| API Endpoints | Sandbox URLs | Production URLs |
| Rate Limits | Testing | Standard |

## Script Parameters

### Managing Environment-Specific Values

```javascript
// Use script parameters for environment-specific config
const scriptObj = runtime.getCurrentScript();
const apiUrl = scriptObj.getParameter({ name: 'custscript_api_url' });
const apiKey = scriptObj.getParameter({ name: 'custscript_api_key' });

// Set different values per environment in deployment settings
```

### Parameter Types

| Type | Use For |
|------|---------|
| Free-Form Text | URLs, messages |
| Password | API keys, secrets |
| Integer | Thresholds, limits |
| Checkbox | Feature flags |
| Select | Predefined options |

## Rollback Procedures

### Quick Rollback

```
1. Set deployment status to "Not Scheduled"
2. Users can continue working
3. Fix the issue
4. Re-deploy when ready
```

### Full Rollback

```
1. Deactivate current deployment
2. Upload previous script version
3. Revert deployment settings
4. Activate old deployment
5. Verify functionality
```

### Rollback Script

```javascript
/**
 * Rollback to previous script version
 */
function rollback(scriptId, previousFileId) {
    const script = record.load({
        type: 'script',
        id: scriptId
    });

    // Update to previous file
    script.setValue('scriptfile', previousFileId);
    script.save();

    log.audit({
        title: 'Rollback Complete',
        details: 'Script ' + scriptId + ' reverted to file ' + previousFileId
    });
}
```

## Change Management

### Deployment Request Form

```markdown
## Deployment Request

**Requested By:** [Name]
**Date:** [Date]
**Priority:** [Low/Medium/High/Critical]

### Changes
- Script: customscript_st_feature
- Type: [New/Update/Fix]
- Description: [Brief description]

### Testing
- [ ] Unit tests passed
- [ ] Integration tests passed
- [ ] UAT completed
- [ ] Sign-off obtained

### Dependencies
- Custom fields required: [List]
- Other scripts affected: [List]

### Deployment Window
- Preferred: [Date/Time]
- Alternate: [Date/Time]

### Rollback Plan
[Description of rollback steps]

### Approvals
- [ ] Development Lead
- [ ] QA Lead
- [ ] Business Owner
```

## Best Practices

1. **Never deploy on Friday** - No weekend emergencies
2. **Always test in sandbox** - Before production
3. **Use version control** - Track all changes
4. **Document deployments** - What, when, who
5. **Have rollback plan** - Before you deploy
6. **Monitor after deploy** - Watch for errors
7. **Communicate changes** - Notify stakeholders

## Deployment Log Template

```markdown
## Deployment Log

**Date:** 2024-01-15 14:30 PST
**Deployed By:** John Developer
**Environment:** Production

### Changes Deployed
| Script | Version | Change |
|--------|---------|--------|
| customscript_st_order | 1.2.0 | Added credit check |
| customscript_st_notify | 1.0.1 | Fixed email bug |

### Verification
- [ ] Scripts accessible
- [ ] Deployments active
- [ ] Test transaction successful
- [ ] No errors in logs

### Issues
None

### Sign-off
- Deployed by: JD
- Verified by: MQ
```

## See Also

- `testing.md` - Testing requirements
- `documentation.md` - Documentation standards
- `../review/checklist.md` - Pre-deployment review
