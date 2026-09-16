# NetSuite-Magento Integration Patterns

> Extracted from Softype Slack channels (#netsuitemagento, #proj-vinfolio-bau) and client implementation discussions.
> Last updated: January 2026

---

## Overview

This document captures integration patterns, common issues, and solutions for NetSuite-Magento integrations based on real client implementations at Softype, primarily drawn from the Vinfolio BAU engagement.

## Integration Architecture

### Typical Data Flow

```
                    ┌─────────────────┐
                    │    Magento      │
                    │  (E-commerce)   │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Product Sync   │ │   Order Sync    │ │  Inventory Sync │
│ (NS → Magento)  │ │ (Magento → NS)  │ │ (NS → Magento)  │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────▼────────┐
                    │    NetSuite     │
                    │  (ERP/Backend)  │
                    └─────────────────┘
```

### Sync Types

| Sync Type | Direction | Method | Trigger |
|-----------|-----------|--------|---------|
| Product/Item Master | NetSuite → Magento | REST API | Item create/update |
| Pricing | NetSuite → Magento | REST API | Price change |
| Inventory Levels | NetSuite → Magento | REST API | Inventory transaction |
| Sales Orders | Magento → NetSuite | REST API | Order placed |
| Customer Data | Bidirectional | REST API | Record changes |
| Item Fulfillment | NetSuite → Magento | REST API | Shipment confirmation |

---

## Product Sync Patterns

### Configurable vs Simple Products

**Magento Product Hierarchy:**
```
Configurable Product (Parent)     ← C-6157417 (NetSuite)
├── Simple Product (Variant 1)    ← S-1344002 (NetSuite IVA)
├── Simple Product (Variant 2)    ← S-1344302 (NetSuite IVA)
└── Simple Product (Variant 3)    ← S-1299803 (NetSuite IVA)
```

**NetSuite Item Structure:**
- **Matrix Parent Item**: Maps to Magento Configurable Product
- **Matrix Child Items (IVAs)**: Maps to Magento Simple Products
- **Item Variant ID**: Unique identifier for child/simple product sync

### Common Product Sync Issues

#### 1. Child Items Not Syncing

**Symptoms:**
- Configurable product exists in Magento but has no associated simple products
- Unable to create sales orders because variants are missing

**Root Causes:**
- Incomplete item master data in NetSuite
- Missing required field values for sync
- Integration user deactivated in Magento
- Script execution limit exceeded during large sync

**Resolution:**
```
1. Review item master completeness checklist:
   - All required custom fields populated
   - Matrix relationships properly configured
   - IVA records exist for all variants

2. Check integration user status in Magento
   - Reactivate if deactivated
   - Verify API credentials are valid

3. For script crashes due to backlog size:
   - Process in smaller batches
   - Use Map/Reduce for high-volume syncs
   - Implement pagination in sync scripts
```

#### 2. Products Not Appearing on Website

**Symptoms:**
- Product synced to Magento successfully but not visible on storefront
- Product shows in Magento admin but not on frontend

**Root Causes Identified:**
1. **In-Stock Attribute**: Parent product `in-stock` flag not enabled
2. **Visibility Attribute**: Set to "Not Visible Individually" in default store view
3. **Scope Mismatch**: Product not assigned to correct store view scope

**Resolution:**
```javascript
// Ensure these attributes are set correctly in sync payload:
{
  "visibility": 4,  // Catalog, Search
  "status": 1,      // Enabled
  "stock_data": {
    "in_stock": true,
    "manage_stock": true
  }
}
```

**Magento Store View Behavior:**
- If default store view has a value, it takes precedence
- If default store view is empty, falls back to "All Store Views" value
- Always explicitly set values for default store view

#### 3. Duplicate NetSuite IDs

**Symptoms:**
- Order sync fails with "Item Variant is not valid" error
- Multiple products pointing to same NetSuite internal ID

**Example Error:**
```
"Errored while creating Sales Order. Message - Item Variant 1485902
is not valid. Please provide a valid item name."
```

**Resolution:**
1. Identify duplicate products in Magento catalog
2. Disable or delete incorrect duplicate record
3. Verify NetSuite ID mapping is unique
4. Re-trigger sync for corrected product

---

## Inventory Sync Patterns

### Real-Time Inventory Updates

**Trigger Points:**
- Item Receipt (PO receiving)
- Item Fulfillment (SO shipping)
- Inventory Adjustment
- Transfer Orders

### Common Inventory Issues

#### 1. Stock Mismatch Between Systems

**Symptoms:**
- Magento shows stock available, NetSuite shows zero
- Oversold orders due to delayed sync

**Root Causes:**
- Sync lag/delay between systems
- Indexer not running in Magento
- Specific products not included in sync scope

**Resolution:**
```
1. Run Magento indexer manually after large updates
2. Verify sync script includes all relevant transaction types
3. Implement real-time webhooks for critical inventory items
4. Add reconciliation report to identify mismatches
```

#### 2. Items Marked Lost Not Syncing

**Symptoms:**
- Lost/damaged items still show as available on website
- Inventory reports include items that should be excluded

**Resolution:**
- Add status filter to inventory sync query
- Exclude items with specific status codes:
  - Lost
  - Damaged
  - Quality Hold
  - Quarantine

### Inventory Sync Script Pattern

```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @description Sync inventory to Magento
 */
define(['N/search', 'N/https', 'N/runtime'], function(search, https, runtime) {

    function execute(context) {
        const inventorySearch = search.create({
            type: search.Type.INVENTORY_ITEM,
            filters: [
                ['isinactive', 'is', 'F'],
                'AND',
                ['custitem_sync_to_magento', 'is', 'T'],
                'AND',
                ['quantityavailable', 'isnotempty', '']
            ],
            columns: [
                'itemid',
                'custitem_magento_sku',
                'quantityavailable',
                'location'
            ]
        });

        inventorySearch.run().each(function(result) {
            const payload = {
                sku: result.getValue('custitem_magento_sku'),
                qty: result.getValue('quantityavailable'),
                is_in_stock: parseFloat(result.getValue('quantityavailable')) > 0
            };

            syncToMagento(payload);
            return true; // Continue iteration
        });
    }

    function syncToMagento(payload) {
        // REST API call to Magento
        const response = https.post({
            url: MAGENTO_API_URL + '/stockItems/' + payload.sku,
            headers: {
                'Authorization': 'Bearer ' + MAGENTO_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ stockItem: payload })
        });

        if (response.code !== 200) {
            log.error('Inventory sync failed', {
                sku: payload.sku,
                response: response.body
            });
        }
    }

    return { execute: execute };
});
```

---

## Order Sync Patterns

### Order Import Flow

```
Magento Order Placed
        │
        ▼
┌───────────────────┐
│ Validate Customer │──► Create if new
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Validate Products │──► Check IVA mappings
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Create Sales Order│──► Map all fields
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Link Back to      │──► Store NS Order ID
│ Magento Order     │    in Magento
└───────────────────┘
```

### Common Order Sync Issues

#### 1. Invalid Item Variant Error

**Error:**
```
"Item Variant 1485902 is not valid. Please provide a valid item name."
```

**Causes:**
- Item variant doesn't exist in NetSuite
- Incorrect mapping between Magento SKU and NetSuite IVA
- Product was deactivated in NetSuite after being sold on Magento

**Resolution:**
1. Verify IVA exists and is active in NetSuite
2. Check SKU mapping in custom record
3. If IVA was deleted, create new variant and update mapping

#### 2. Serial Number Attachment Issues

**Symptoms:**
- Serial numbers attaching to already-fulfilled sales orders
- Over-ordering stock due to incorrect available quantities

**Impact:**
- Inventory management problems
- Fulfillment confusion
- Customer service issues

**Resolution:**
- Implement validation to check fulfillment status before serial assignment
- Add custom workflow to lock serial assignment after fulfillment

---

## Integration Approaches

### Native SuiteScript Integration

**Pros:**
- Full control over logic
- No additional licensing costs
- Direct database access

**Cons:**
- Requires SuiteScript expertise
- Governance limits to manage
- Maintenance overhead

**Recommended For:**
- Single e-commerce platform
- Simple sync requirements
- Budget constraints

### Middleware Solutions

**Options:**
- Celigo
- Workato
- Dell Boomi
- Custom middleware

**Pros:**
- Pre-built connectors
- Error handling and monitoring
- Non-technical management interface

**Cons:**
- Additional licensing costs
- Less customization flexibility
- Dependency on vendor

**Recommended For:**
- Multi-channel e-commerce
- Complex transformation requirements
- Need for monitoring dashboard

### Partner Management Model

From Vinfolio implementation:

```
┌─────────────────┐     ┌─────────────────┐
│ Softype         │     │ Magento Partner │
│ (NetSuite)      │ ◄── │ (Ziffity)       │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │   Joint Sync Calls    │
         └───────────┬───────────┘
                     │
             ┌───────▼───────┐
             │    Client     │
             │  (Vinfolio)   │
             └───────────────┘
```

**Key Success Factors:**
- Regular joint calls between NetSuite and Magento partners
- Clear ownership of each integration component
- Shared tracking system (Monday.com, Jira) for issues
- Single point of contact from client side for validation

---

## Troubleshooting Checklist

### Product Not Syncing

- [ ] Item active in NetSuite?
- [ ] All required custom fields populated?
- [ ] Integration user active in both systems?
- [ ] Sync script running without errors?
- [ ] API credentials valid?
- [ ] Magento indexer running?

### Inventory Mismatch

- [ ] Sync timestamp matches expected?
- [ ] All transaction types triggering sync?
- [ ] Location filters correct?
- [ ] Item status filters applied?
- [ ] Indexer up to date?

### Order Sync Failure

- [ ] All line items exist in NetSuite?
- [ ] Customer record exists or can be created?
- [ ] Required fields mapped?
- [ ] Payment method supported?
- [ ] Shipping method mapped?

---

## Client Implementations

### Vinfolio (Wine Distribution)

**Industry:** Wine Distribution / E-commerce
**Integration Type:** Custom SuiteScript + Magento Partner (Ziffity)
**Key Features:**
- Wine product catalog with vintage variants
- Serialized inventory (bottle-level tracking)
- Multi-channel sales (website + collector services)

**Specific Challenges:**
- Complex variant structure (vintage, bottle size, case quantity)
- Serialized inventory tracking for individual bottles
- Integration with VinCellar for collector services
- RF-Smart WMS integration

**Lessons Learned:**
1. Regular sync status checks are essential
2. Magento partner involvement critical for catalog issues
3. Weekly review calls help catch sync gaps early
4. Clear escalation path for production-blocking issues

### Mannatech (Health Products MLM)

**Industry:** Health Products / Multi-level Marketing
**Integration Type:** Transitional (legacy Magento during ERP migration)
**Key Features:**
- Multi-country operations (30 countries)
- Multiple e-commerce platforms (including Magento)
- Complex pricing and commission structures

**Architecture Notes:**
- iPaaS solution (Workato) recommended for integration layer
- API-based integrations for real-time data sync
- File-based integrations for batch processes
- Webhook implementations for status updates

---

## Best Practices Summary

### Development

1. **Always use Map/Reduce for bulk syncs** - Prevents script timeout issues
2. **Implement idempotency** - Allow safe retries without duplicates
3. **Log all sync operations** - Critical for debugging and audits
4. **Validate data before sync** - Catch issues at source system

### Operations

1. **Monitor sync health daily** - Set up alerts for failures
2. **Regular reconciliation reports** - Catch drift before it becomes critical
3. **Documented escalation path** - Know who to contact for each system
4. **Staging environment testing** - Always test sync changes in sandbox first

### Communication

1. **Joint partner calls** - Regular syncs between NetSuite and Magento teams
2. **Shared issue tracking** - Single source of truth for integration issues
3. **Clear ownership matrix** - Document who owns what component
4. **Status update cadence** - Daily updates during active issues

---

## Sources

- Slack #netsuitemagento channel discussions
- Slack #proj-vinfolio-bau project channel
- Vinfolio BAU engagement (2023-present)
- Mannatech implementation planning (2024-2025)
- Team discussions: Gaurav S., Rohit J., Kishore R., Arvind K.
