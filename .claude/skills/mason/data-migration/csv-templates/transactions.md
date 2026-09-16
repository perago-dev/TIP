# Transaction CSV Templates

Templates for importing transaction records.

## Important: Transaction Order

Load transactions in chronological order (oldest first) and by dependency:

```
1. Purchase Orders
2. Item Receipts (from POs)
3. Vendor Bills (from POs)
4. Sales Orders
5. Item Fulfillments (from SOs)
6. Invoices (from SOs)
7. Customer Payments
8. Vendor Payments
```

## Sales Order Template

### Header Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| External ID | Text | Unique identifier | SO-001 |
| Customer | Reference | Customer name/ID | Acme Corp |
| Date | Date | Transaction date | 1/15/2024 |
| PO Number | Text | Customer's PO # | PO-12345 |
| Subsidiary | Reference | Subsidiary | Parent Company |
| Location | Reference | Default location | Main Warehouse |
| Terms | Reference | Payment terms | Net 30 |
| Currency | Reference | Currency | USD |
| Memo | Text | Internal notes | Rush order |

### Line Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| Item | Reference | Item SKU/ID | WIDGET-001 |
| Quantity | Number | Order quantity | 10 |
| Rate | Currency | Unit price | 25.00 |
| Tax Code | Reference | Tax code | CA-Tax |
| Location | Reference | Fulfillment location | Main Warehouse |

### CSV Format (Multi-Line Records)

```csv
External ID,Customer,Date,PO Number,Subsidiary,Location,Terms,Currency,Memo,Item,Quantity,Rate,Tax Code
SO-001,Acme Corp,1/15/2024,PO-12345,Parent Company,Main Warehouse,Net 30,USD,Rush order,WIDGET-BLU-SM,10,25.00,CA-Tax
SO-001,,,,,,,,,,WIDGET-BLU-MD,5,30.00,CA-Tax
SO-001,,,,,,,,,,WIDGET-BLU-LG,2,35.00,CA-Tax
SO-002,Beta Industries,1/16/2024,PO-67890,Parent Company,Main Warehouse,Net 15,USD,,WIDGET-RED-SM,20,25.00,CA-Tax
```

**Note**: Empty header fields on subsequent lines indicate continuation of the same transaction.

## Invoice Template

### Header Fields

| Field | Type | Description |
|-------|------|-------------|
| External ID | Text | Unique identifier |
| Customer | Reference | Customer |
| Date | Date | Invoice date |
| Due Date | Date | Payment due date |
| Terms | Reference | Payment terms |
| Created From | Reference | Source SO (if applicable) |

### CSV Format

```csv
External ID,Customer,Date,Due Date,Terms,Memo,Item,Quantity,Rate,Tax Code
INV-001,Acme Corp,1/20/2024,2/19/2024,Net 30,January invoice,WIDGET-BLU-SM,10,25.00,CA-Tax
INV-001,,,,,,WIDGET-BLU-MD,5,30.00,CA-Tax
INV-002,Beta Industries,1/21/2024,2/5/2024,Net 15,,SERVICE-INSTALL,1,250.00,CA-Tax
```

## Purchase Order Template

### CSV Format

```csv
External ID,Vendor,Date,Subsidiary,Location,Memo,Item,Quantity,Rate
PO-001,Acme Supplies,1/10/2024,Parent Company,Main Warehouse,January restock,WIDGET-BLU-SM,100,10.00
PO-001,,,,,,,WIDGET-BLU-MD,75,12.00
PO-001,,,,,,,WIDGET-BLU-LG,50,15.00
PO-002,Beta Distributors,1/12/2024,Parent Company,West Coast DC,,WIDGET-RED-SM,200,10.00
```

## Customer Payment Template

### Header Fields

| Field | Type | Description |
|-------|------|-------------|
| External ID | Text | Payment ID |
| Customer | Reference | Customer |
| Date | Date | Payment date |
| Payment Method | Reference | Check/Wire/CC |
| Check Number | Text | Check # if applicable |
| Amount | Currency | Payment amount |
| Account | Reference | Deposit account |
| Apply To | Reference | Invoice to apply |

### CSV Format

```csv
External ID,Customer,Date,Payment Method,Check Number,Amount,Account,Apply To Invoice
PMT-001,Acme Corp,2/1/2024,Check,1234,500.00,1000 Checking,INV-001
PMT-002,Beta Industries,2/5/2024,Wire Transfer,,275.00,1000 Checking,INV-002
```

## Opening Balance Template

For historical balances without loading all transactions:

### Customer Opening Balances

```csv
Customer External ID,Date,Amount,Memo
CUST-001,12/31/2023,5000.00,Opening balance
CUST-002,12/31/2023,2500.00,Opening balance
```

### Vendor Opening Balances

```csv
Vendor External ID,Date,Amount,Memo
VEND-001,12/31/2023,3000.00,Opening balance
VEND-002,12/31/2023,1500.00,Opening balance
```

## Inventory Adjustment Template

For initial inventory quantities:

```csv
External ID,Date,Account,Location,Memo,Item,Quantity,Unit Cost
INVADJ-001,1/1/2024,1200 Inventory,Main Warehouse,Initial inventory,WIDGET-BLU-SM,1000,10.00
INVADJ-001,,,,,WIDGET-BLU-MD,800,12.00
INVADJ-001,,,,,WIDGET-BLU-LG,500,15.00
```

## Historical Transaction Import

### Considerations

1. **Cutoff Date**: Choose a date to separate historical from live
2. **Summary vs Detail**: Consider summary journal entries for old data
3. **Reconciliation**: Ensure trial balance matches after import
4. **Account Mapping**: Verify GL account mappings

### Import Strategy

```
OLD DATA (Before cutoff):
├── Opening balances via journal entries
├── AR/AP aging via opening balance invoices
└── Inventory via adjustment

NEW DATA (After cutoff):
├── Full transaction detail
├── All supporting documents
└── Complete audit trail
```

## Validation Rules

```javascript
function validateTransaction(header, lines) {
    const errors = [];

    // Header validation
    if (!header['Customer'] && !header['Vendor']) {
        errors.push('Customer or Vendor is required');
    }

    if (!header['Date']) {
        errors.push('Date is required');
    }

    // Date format
    const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
    if (header['Date'] && !dateRegex.test(header['Date'])) {
        errors.push('Invalid date format (use M/D/YYYY)');
    }

    // Line validation
    if (lines.length === 0) {
        errors.push('At least one line item is required');
    }

    lines.forEach(function(line, index) {
        if (!line['Item']) {
            errors.push('Line ' + (index + 1) + ': Item is required');
        }
        if (!line['Quantity'] || parseFloat(line['Quantity']) <= 0) {
            errors.push('Line ' + (index + 1) + ': Quantity must be positive');
        }
    });

    return errors;
}
```

## Post-Import Validation

```sql
-- Verify transaction counts by type
SELECT recordtype, COUNT(*) as count
FROM transaction
WHERE datecreated > TODAY-1
GROUP BY recordtype

-- Check for orphaned transactions
SELECT tranid, entity
FROM transaction
WHERE entity IS NULL
AND datecreated > TODAY-1

-- Verify amounts
SELECT SUM(amount) as total
FROM transaction
WHERE recordtype = 'salesorder'
AND datecreated > TODAY-1
```

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Line items not linking | Continuation rows wrong | Ensure header fields blank |
| Wrong customer | Name doesn't match | Use External ID |
| Missing items | Item not imported | Import items first |
| Date format error | Wrong format | Use M/D/YYYY |
| Tax not calculating | Missing tax code | Verify tax items exist |

## See Also

- `../INDEX.md` - Migration methodology
- `customers.md` - Customer import (do first)
- `items.md` - Item import (do first)
