# Item CSV Templates

Templates for importing item records.

## Item Types

| Type | Script Name | Use For |
|------|-------------|---------|
| Inventory Item | inventoryitem | Physical goods tracked in inventory |
| Non-Inventory Item | noninventoryitem | Purchased/sold but not tracked |
| Service Item | serviceitem | Services |
| Other Charge Item | otherchargeitem | Fees, shipping, handling |
| Kit Item | kititem | Bundle of items |
| Assembly Item | assemblyitem | Manufactured from components |

## Inventory Item Template

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| External ID | Text | Unique identifier | ITEM-001 |
| Item Name/Number | Text | SKU | WIDGET-BLU-SM |
| Display Name | Text | Friendly name | Blue Widget (Small) |
| Subsidiary | Reference | Subsidiary | Parent Company |

### Recommended Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| Description | Text | Full description | Blue widget, small size |
| Base Unit | List | Stock unit | Each |
| Purchase Description | Text | For POs | Blue widget |
| Cost | Currency | Standard cost | 10.00 |
| Preferred Vendor | Reference | Primary vendor | Acme Supplies |
| Base Price | Currency | Default sell price | 25.00 |
| Tax Schedule | Reference | Tax handling | Taxable |
| Income Account | Reference | Sales account | 4000 Sales |
| COGS Account | Reference | Cost account | 5000 COGS |
| Asset Account | Reference | Inventory account | 1200 Inventory |

### CSV Template

```csv
External ID,Item Name/Number,Display Name,Subsidiary,Description,Base Unit,Cost,Base Price,Preferred Vendor,Tax Schedule,Income Account,COGS Account,Asset Account,Reorder Point,Preferred Stock Level
ITEM-001,WIDGET-BLU-SM,Blue Widget (Small),Parent Company,Blue widget small size,Each,10.00,25.00,Acme Supplies,Taxable,4000 Sales,5000 COGS,1200 Inventory,100,500
ITEM-002,WIDGET-BLU-MD,Blue Widget (Medium),Parent Company,Blue widget medium size,Each,12.00,30.00,Acme Supplies,Taxable,4000 Sales,5000 COGS,1200 Inventory,75,400
ITEM-003,WIDGET-BLU-LG,Blue Widget (Large),Parent Company,Blue widget large size,Each,15.00,35.00,Acme Supplies,Taxable,4000 Sales,5000 COGS,1200 Inventory,50,300
```

## Service Item Template

```csv
External ID,Item Name/Number,Display Name,Subsidiary,Description,Base Unit,Base Price,Income Account,Expense Account
SVC-001,CONSULT-HR,Consulting (Hourly),Parent Company,Professional consulting services,Hour,150.00,4100 Service Revenue,5100 Cost of Services
SVC-002,INSTALL-BASIC,Basic Installation,Parent Company,Basic installation service,Each,250.00,4100 Service Revenue,5100 Cost of Services
```

## Non-Inventory Item Template

```csv
External ID,Item Name/Number,Display Name,Subsidiary,Description,Purchase Description,Base Price,Cost,Income Account,Expense Account
NON-001,SHIPPING-STD,Standard Shipping,Parent Company,Standard ground shipping,Outbound shipping charges,9.99,5.00,4200 Shipping Revenue,5200 Shipping Expense
NON-002,HANDLING,Handling Fee,Parent Company,Order handling fee,Processing fee,2.50,0.50,4200 Other Revenue,5200 Operating Expense
```

## Multi-Location Inventory

For items across multiple locations, use separate inventory adjustment after items:

```csv
External ID,Item Name/Number,Location,Quantity On Hand,Bin Number
ITEM-001,WIDGET-BLU-SM,Main Warehouse,1000,A-01-01
ITEM-001,WIDGET-BLU-SM,West Coast DC,500,B-02-05
ITEM-002,WIDGET-BLU-MD,Main Warehouse,800,A-01-02
```

## Pricing

### Single Price Level

Include in main item CSV:
```csv
Base Price
25.00
```

### Multiple Price Levels

Separate import after items:
```csv
Item External ID,Price Level,Unit Price,Currency
ITEM-001,Retail,25.00,USD
ITEM-001,Wholesale,20.00,USD
ITEM-001,Distributor,15.00,USD
```

## Vendor Pricing

Separate import for vendor-specific pricing:
```csv
Item External ID,Vendor External ID,Vendor Code,Purchase Price,Currency
ITEM-001,VEND-001,ACM-WID-SM,10.00,USD
ITEM-001,VEND-002,BWS-001,10.50,USD
```

## Field Mapping

| CSV Column | NetSuite Field | Notes |
|------------|----------------|-------|
| External ID | externalid | For updates |
| Item Name/Number | itemid | SKU/Part number |
| Display Name | displayname | Shown on forms |
| Description | salesdescription | Sales description |
| Purchase Description | purchasedescription | PO description |
| Base Unit | stockunit | Unit of measure |
| Cost | cost | Standard/average cost |
| Base Price | baseprice | Default price |
| Income Account | incomeaccount | Revenue account |
| COGS Account | cogsaccount | Cost of goods sold |
| Asset Account | assetaccount | Inventory asset |
| Expense Account | expenseaccount | For non-inv items |

## Validation Rules

```javascript
function validateItem(row) {
    const errors = [];

    // Required
    if (!row['Item Name/Number']) {
        errors.push('Item Name/Number is required');
    }

    // SKU format (example: alphanumeric with dashes)
    if (row['Item Name/Number'] && !/^[A-Z0-9-]+$/i.test(row['Item Name/Number'])) {
        errors.push('Invalid SKU format');
    }

    // Numeric fields
    if (row['Cost'] && isNaN(parseFloat(row['Cost']))) {
        errors.push('Cost must be numeric');
    }

    if (row['Base Price'] && isNaN(parseFloat(row['Base Price']))) {
        errors.push('Base Price must be numeric');
    }

    // Cost vs Price sanity check
    const cost = parseFloat(row['Cost']) || 0;
    const price = parseFloat(row['Base Price']) || 0;
    if (cost > 0 && price > 0 && cost > price) {
        errors.push('Warning: Cost exceeds selling price');
    }

    return errors;
}
```

## Post-Import Steps

1. **Verify item counts by type**
2. **Check account assignments**
3. **Verify vendor relationships**
4. **Test pricing levels**
5. **Load initial inventory** (inventory adjustment)
6. **Verify inventory quantities**

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Missing accounts | Account not in chart | Create accounts first |
| Vendor not found | Vendor external ID mismatch | Verify vendor IDs |
| Duplicate SKU | Item already exists | Use External ID for updates |
| Unit mismatch | Unit not in NetSuite | Create units of measure first |

## See Also

- `../INDEX.md` - Migration methodology
- `customers.md` - Customer import
- `transactions.md` - Transaction import
