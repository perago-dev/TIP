# Customer CSV Template

Template for importing customer records.

## Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| External ID | Text | Unique identifier from source | CUST-001 |
| Company Name | Text | Customer name | Acme Corp |
| Subsidiary | Reference | NetSuite subsidiary | Parent Company |

## Recommended Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| Email | Email | Primary email | sales@acme.com |
| Phone | Phone | Primary phone | (555) 123-4567 |
| Category | List | Customer category | Commercial |
| Terms | Reference | Payment terms | Net 30 |
| Currency | Reference | Default currency | USD |
| Sales Rep | Reference | Assigned rep | John Smith |
| Credit Limit | Currency | Credit limit | 50000.00 |
| Tax Item | Reference | Default tax code | CA-Sales Tax |

## Address Fields

| Field | Type | Description |
|-------|------|-------------|
| Address 1 | Text | Street address line 1 |
| Address 2 | Text | Street address line 2 |
| City | Text | City |
| State | Text | State/Province (2-letter code) |
| Zip | Text | Postal code |
| Country | Text | Country (2-letter code) |
| Is Default Billing | Boolean | Default billing address |
| Is Default Shipping | Boolean | Default shipping address |

## CSV Template

```csv
External ID,Company Name,Subsidiary,Email,Phone,Category,Terms,Currency,Sales Rep,Credit Limit,Address 1,City,State,Zip,Country,Default Billing,Default Shipping
CUST-001,Acme Corporation,Parent Company,sales@acme.com,(555) 123-4567,Commercial,Net 30,USD,John Smith,50000.00,123 Main St,San Francisco,CA,94102,US,T,T
CUST-002,Beta Industries,Parent Company,info@beta.com,(555) 234-5678,Industrial,Net 15,USD,Jane Doe,25000.00,456 Oak Ave,Los Angeles,CA,90001,US,T,T
```

## Field Mapping

### Standard Mappings

| CSV Column | NetSuite Field | Notes |
|------------|----------------|-------|
| External ID | externalid | For updates |
| Company Name | companyname | Required |
| Subsidiary | subsidiary | Match by name or ID |
| Email | email | |
| Phone | phone | Auto-formatted |
| Category | category | Match to list value |
| Terms | terms | Match by name |
| Currency | currency | 3-letter code |
| Sales Rep | salesrep | Match by name or ID |
| Credit Limit | creditlimit | Numeric |

### Address Mapping

Addresses require special handling - either:

1. **Single Address per Row**: Include address fields in main CSV
2. **Separate Address Import**: Import addresses after customers

## Import Configuration

```
Record Type: Customer
Import Type: Add
Handle Duplicates: Update (by External ID)
Multi-Select Delimiter: |
Log System Notes: Yes
```

## Validation Rules

### Pre-Import Checks

```javascript
// Validation functions
function validateCustomer(row) {
    const errors = [];

    // Required fields
    if (!row['Company Name']) {
        errors.push('Company Name is required');
    }

    // Email format
    if (row['Email'] && !isValidEmail(row['Email'])) {
        errors.push('Invalid email format');
    }

    // Credit limit numeric
    if (row['Credit Limit'] && isNaN(parseFloat(row['Credit Limit']))) {
        errors.push('Credit Limit must be numeric');
    }

    // State code
    if (row['State'] && row['State'].length !== 2) {
        errors.push('State must be 2-letter code');
    }

    return errors;
}
```

### Reference Lookups

Before import, verify these exist:
- Subsidiaries
- Payment Terms
- Currencies
- Sales Reps (Employees)
- Customer Categories
- Tax Items

## Post-Import Validation

```sql
-- Count customers by subsidiary
SELECT subsidiary, COUNT(*) as count
FROM customer
WHERE datecreated > TODAY-1
GROUP BY subsidiary

-- Verify email uniqueness
SELECT email, COUNT(*) as count
FROM customer
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1

-- Check missing required data
SELECT internalid, companyname
FROM customer
WHERE email IS NULL
AND datecreated > TODAY-1
```

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Duplicate customers | Same company name | Use External ID for matching |
| Missing subsidiary | Typo in subsidiary name | Verify subsidiary list |
| Invalid terms | Terms not in system | Create terms first |
| Email duplicates | Same email multiple rows | Dedupe source data |

## See Also

- `../INDEX.md` - Migration methodology
- `../validation.md` - Validation patterns
- `items.md` - Item import template
