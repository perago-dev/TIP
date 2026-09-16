# Integration Decision Tree

How to choose the right integration pattern for NetSuite.

## Decision Tree

```
START: What type of integration do you need?
│
├─► Real-time, triggered by events?
│     │
│     ├─► External system triggers NetSuite?
│     │     └─► RESTLET (inbound)
│     │
│     └─► NetSuite triggers external system?
│           │
│           ├─► On record save?
│           │     └─► USER EVENT + HTTPS (outbound webhook)
│           │
│           └─► On workflow transition?
│                 └─► WORKFLOW ACTION SCRIPT + HTTPS
│
├─► Batch/scheduled sync?
│     │
│     ├─► File-based exchange?
│     │     └─► SFTP (file transfer)
│     │
│     ├─► API-based batch?
│     │     │
│     │     ├─► < 1000 records?
│     │     │     └─► SCHEDULED SCRIPT + API
│     │     │
│     │     └─► > 1000 records?
│     │           └─► MAP/REDUCE + API
│     │
│     └─► Need transformation/monitoring?
│           └─► MIDDLEWARE (Celigo, Workato, etc.)
│
└─► Two-way sync with complex logic?
      └─► MIDDLEWARE (recommended)
```

## Pattern Comparison

| Pattern | Direction | Timing | Volume | Complexity |
|---------|-----------|--------|--------|------------|
| RESTlet | Inbound | Real-time | Low-Medium | Low |
| User Event + HTTPS | Outbound | Real-time | Low | Low |
| Scheduled + API | Both | Batch | Medium | Medium |
| Map/Reduce + API | Both | Batch | High | Medium |
| SFTP | Both | Batch | High | Low |
| Middleware | Both | Both | High | High |

## When to Use What

### RESTlet (External → NetSuite)

**Use when:**
- External system needs to push data to NetSuite
- Real-time or near-real-time updates needed
- Volume is low to moderate (< 100 requests/minute)
- Simple CRUD operations

**Examples:**
- E-commerce order import
- CRM contact sync
- Webhook receivers

### User Event + HTTPS (NetSuite → External)

**Use when:**
- Need to notify external system on record changes
- Real-time notification is important
- Simple payload (record data only)

**Examples:**
- Order confirmation to fulfillment system
- Customer updates to CRM
- Inventory alerts

**Caution:**
- Keep payloads small
- Use async if possible
- Handle failures gracefully (don't block save)

### Scheduled Script + API

**Use when:**
- Batch sync is acceptable
- Volume is moderate (< 1000 records)
- Need to poll external system
- Simple transformation logic

**Examples:**
- Daily price updates
- Weekly inventory sync
- Status polling

### Map/Reduce + API

**Use when:**
- High volume (> 1000 records)
- Need parallel processing
- Error isolation important (one record failure shouldn't stop others)

**Examples:**
- Full catalog sync
- Historical data migration
- Large-scale updates

### SFTP File Transfer

**Use when:**
- Partner requires file-based exchange
- High volume batch transfers
- EDI or legacy system integration
- Audit trail via files needed

**Examples:**
- EDI document exchange
- Bank file imports
- Large data exports for BI

### Middleware (Celigo, Workato, Dell Boomi, etc.)

**Use when:**
- Two-way sync with conflict resolution
- Multiple systems to integrate
- Complex transformation logic
- Need monitoring and alerting UI
- Error retry and dead-letter handling
- Non-technical users need to manage

**Examples:**
- Multi-channel e-commerce (Shopify + Amazon + eBay)
- ERP-to-ERP migration
- Complex B2B integrations

## Integration Checklist

Before building any integration:

- [ ] **Direction**: Inbound, outbound, or both?
- [ ] **Timing**: Real-time or batch acceptable?
- [ ] **Volume**: How many records per day/hour/minute?
- [ ] **Frequency**: How often do syncs occur?
- [ ] **Data**: What fields need to sync?
- [ ] **Mapping**: What transformations are needed?
- [ ] **Errors**: How to handle failures?
- [ ] **Monitoring**: How to track health?
- [ ] **Security**: Authentication method?
- [ ] **Testing**: Sandbox available?

## Authentication Options

| Method | Use For |
|--------|---------|
| **Token-Based Auth (TBA)** | RESTlets, SuiteTalk (recommended) |
| **OAuth 2.0** | Modern third-party integrations |
| **Basic Auth** | Simple internal integrations |
| **API Key** | Custom implementations |
| **IP Allowlisting** | Additional security layer |

## See Also

- `patterns/rest-inbound.md` - RESTlet patterns
- `patterns/rest-outbound.md` - Outbound API calls
- `patterns/sftp.md` - File transfer patterns
- `patterns/middleware.md` - Middleware patterns
- `error-handling.md` - Integration error handling
