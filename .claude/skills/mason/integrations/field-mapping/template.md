# Field Mapping Template

Standard format for documenting field mappings between systems.

## Template Structure

```markdown
# [Source System] → [Target System] Field Mapping

## Overview
- **Source**: [System name and record type]
- **Target**: [System name and record type]
- **Direction**: [One-way / Bidirectional]
- **Sync Type**: [Real-time / Batch]
- **Last Updated**: [Date]

## Header Fields

| # | Source Field | Source Type | Transform | Target Field | Target Type | Required | Notes |
|---|--------------|-------------|-----------|--------------|-------------|----------|-------|
| 1 | field_name | string | Direct | netsuite_field | Text | Yes | |
| 2 | order_date | datetime | Format | trandate | Date | Yes | UTC→PST |
| 3 | ... | ... | ... | ... | ... | ... | ... |

## Line Item Fields

| # | Source Field | Transform | Target Field | Required | Notes |
|---|--------------|-----------|--------------|----------|-------|
| 1 | sku | Lookup | item | Yes | |
| 2 | qty | Direct | quantity | Yes | |
| ... | ... | ... | ... | ... | ... |

## Lookup Tables

### [Lookup Name]

| Source Value | Target Value |
|--------------|--------------|
| value1 | NETSUITE_VALUE_1 |
| value2 | NETSUITE_VALUE_2 |

## Transformations

### [Transform Name]
- **Input**: [format]
- **Output**: [format]
- **Logic**: [description]

## Error Handling

| Scenario | Action |
|----------|--------|
| Missing required field | Reject record |
| Lookup fails | [Log warning / Use default / Reject] |
| Invalid data type | [Transform / Reject] |
```

## Example: Shopify → NetSuite Order Mapping

### Overview
- **Source**: Shopify Order
- **Target**: NetSuite Sales Order
- **Direction**: One-way (Shopify → NetSuite)
- **Sync Type**: Real-time (webhook)
- **Last Updated**: 2024-01-15

### Header Fields

| # | Shopify Field | Type | Transform | NetSuite Field | Type | Req | Notes |
|---|---------------|------|-----------|----------------|------|-----|-------|
| 1 | order_number | string | Direct | otherrefnum | Text | Yes | External reference |
| 2 | created_at | datetime | FormatDate | trandate | Date | Yes | UTC→Account TZ |
| 3 | customer.email | string | CustomerLookup | entity | Select | Yes | Create if not found |
| 4 | total_price | decimal | Direct | - | - | No | Calculated from lines |
| 5 | currency | string | CurrencyLookup | currency | Select | Yes | |
| 6 | shipping_address | object | AddressMap | shipaddress | Address | No | |
| 7 | billing_address | object | AddressMap | billaddress | Address | No | |
| 8 | note | string | Direct | memo | Textarea | No | |
| 9 | tags | array | TagsToField | custbody_tags | Multiselect | No | |
| 10 | financial_status | string | StatusLookup | custbody_payment_status | Select | No | |
| 11 | - | - | Constant | subsidiary | Select | Yes | Default subsidiary |
| 12 | - | - | Constant | location | Select | Yes | Default location |

### Line Item Fields

| # | Shopify Field | Transform | NetSuite Field | Req | Notes |
|---|---------------|-----------|----------------|-----|-------|
| 1 | sku | ItemLookup | item | Yes | Error if not found |
| 2 | quantity | Direct | quantity | Yes | |
| 3 | price | Direct | rate | Yes | Unit price |
| 4 | discount_allocations | DiscountCalc | custcol_discount | No | |
| 5 | tax_lines | TaxCalc | taxcode | No | |
| 6 | fulfillment_service | Direct | custcol_fulfillment | No | |

### Lookup Tables

#### Currency Lookup

| Shopify | NetSuite ID |
|---------|-------------|
| USD | 1 |
| CAD | 2 |
| EUR | 3 |
| GBP | 4 |

#### Status Lookup

| Shopify financial_status | NetSuite custbody_payment_status |
|--------------------------|----------------------------------|
| pending | 1 (Pending) |
| authorized | 2 (Authorized) |
| paid | 3 (Paid) |
| refunded | 4 (Refunded) |
| partially_refunded | 5 (Partial Refund) |

### Transformations

#### FormatDate
- **Input**: ISO 8601 datetime (e.g., "2024-01-15T10:30:00Z")
- **Output**: NetSuite date (MM/DD/YYYY)
- **Logic**: Parse ISO, convert to account timezone, format as MM/DD/YYYY

#### CustomerLookup
- **Input**: Email address
- **Output**: NetSuite customer internal ID
- **Logic**:
  1. Search customers by email
  2. If found, return internal ID
  3. If not found, create customer and return new ID
  4. Store Shopify customer ID in custentity_shopify_id

#### AddressMap
- **Input**: Shopify address object
- **Output**: NetSuite address subrecord
- **Logic**:
  ```
  addr1 = address1
  addr2 = address2
  city = city
  state = province_code (lookup state ID)
  zip = zip
  country = country_code (lookup country ID)
  ```

#### ItemLookup
- **Input**: SKU string
- **Output**: NetSuite item internal ID
- **Logic**:
  1. Search items where itemid = SKU
  2. If found, return internal ID
  3. If not found, throw error (require manual mapping)

#### DiscountCalc
- **Input**: Array of discount allocations
- **Output**: Total discount amount
- **Logic**: Sum all discount_allocations[].amount

### Error Handling

| Scenario | Action | Notification |
|----------|--------|--------------|
| Missing order_number | Reject | Error log |
| Customer lookup fails | Create new customer | Info log |
| Item lookup fails | Reject order | Alert + Error log |
| Invalid currency | Reject | Error log |
| Address parse fails | Use blank address | Warning log |
| Duplicate order (same otherrefnum) | Skip | Info log |

### Sample Data

**Input (Shopify):**
```json
{
  "order_number": "1001",
  "created_at": "2024-01-15T10:30:00Z",
  "customer": {
    "email": "john@example.com"
  },
  "line_items": [
    {
      "sku": "WIDGET-001",
      "quantity": 2,
      "price": "29.99"
    }
  ],
  "total_price": "59.98",
  "currency": "USD"
}
```

**Output (NetSuite):**
```javascript
{
  type: 'salesorder',
  values: {
    otherrefnum: '1001',
    trandate: '1/15/2024',
    entity: 12345,  // Customer ID
    subsidiary: 1,
    location: 1,
    currency: 1
  },
  lines: [
    {
      item: 678,  // Item ID for WIDGET-001
      quantity: 2,
      rate: 29.99
    }
  ]
}
```

## Mapping Checklist

- [ ] All required fields identified
- [ ] Lookup tables complete
- [ ] Transformation logic documented
- [ ] Error scenarios covered
- [ ] Sample data validated
- [ ] Reviewed by integration lead
- [ ] Approved by business owner

## See Also

- `common-transforms.md` - Standard transformation patterns
- `../patterns/rest-inbound.md` - Implementation patterns
- `../error-handling.md` - Error handling strategies
