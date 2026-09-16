# Workflow Governance

## Performance Impact

Workflows and User Event Scripts run in the same save pipeline — the user experiences the combined wall-clock time of all scripts and all workflows on every save.

- Each workflow is a separate execution unit — 6 workflows on SO afterSubmit means 6 sequential execution passes
- Workflow Action Scripts are double overhead: workflow engine overhead + SuiteScript execution overhead
- 4 afterSubmit scripts × 500ms each ≈ 2 seconds of perceived lag on every save

## When to Use Script vs. Workflow

| Use Case | Recommended Approach |
|----------|---------------------|
| Simple field updates on save | Workflow — no script overhead |
| Approval routing | Workflow — built-in state machine |
| Complex conditional logic | Script — more control, easier to debug |
| Cross-record operations | Script — workflows cannot easily span record types |
| Sending email notifications | Either — workflow is simpler |
| Integration triggers | Script — RESTlet / Scheduled |
| Heavy data processing | Script — Map/Reduce |

A common mistake is using workflows for logic that belongs in a script — this gives you workflow engine overhead + Workflow Action Script overhead with none of the benefits.

## Reducing Workflow Overhead

### Option 1: Single User Event Script (preferred)

Instead of multiple workflow actions triggering scripts, use one well-structured User Event Script with `beforeSubmit` or `afterSubmit` entry points. A single optimised script executes at a lower system level with significantly less latency than multiple workflow-script combinations.

### Option 2: Async Processing

For logic that does not need to happen synchronously on save — updating related records, sending emails, generating documents — move it to a Scheduled Script or Map/Reduce Script. This runs in the background without blocking the user-facing save operation.

### Option 3: Consolidated Workflow Action Script

If a workflow must remain, create **one** Workflow Action Script that handles all complex logic for that workflow state, rather than calling multiple smaller scripts across separate states.

### Option 4: Native Workflow Actions

Replace scripted workflow actions with native point-and-click workflow actions (Set Field Value, Send Email, Create Record) wherever possible. Native actions:
- Consume zero script governance units
- Are admin-maintainable without a code release
- Are less likely to cause deployment issues during upgrades

## Deployment Density Limits

These are practical caps for high-traffic records (SO, PO, Invoice, Customer, Item):

| Automation Type | Soft Limit | Hard Action |
|----------------|------------|-------------|
| User Event scripts per event per record | 3 | Merge beyond this. Note: create a separate script if governance units exceed 1,000 |
| Client Scripts per form | 1 | Must consolidate — multiple CS cause event conflicts |
| Active workflows per record type (same event) | 3–4 | Consolidation candidate |
| Combined automations (scripts + workflows) per record/event | 8–10 | Treat as consolidation candidate |

### Why Client Script consolidation matters

Multiple Client Script deployments on the same form cause:
- `pageInit` firing multiple times
- `saveRecord` validators conflicting
- Field-level events doubling up
- Unpredictable load order

## Merge vs. Keep Separate

**Merge workflows when:**
- Multiple workflows on the same record share the same trigger
- Workflows operate on overlapping fields
- You are experiencing save lag

**Keep separate when:**
- Workflows serve completely different business domains (e.g., approval routing vs. email notification)
- Different teams own different workflows
- Merging would create a single untestable monolith

**Target state:** One workflow per business process domain per record type (e.g., one for approvals, one for notifications, one for field automation).

## See Also

- `deployment.md` - Deployment density rules and SDF
- `../suitescript/snippets/execution-context.md` - Context filtering to prevent unintended triggers
- `../suitescript/INDEX.md` - Script type selection
