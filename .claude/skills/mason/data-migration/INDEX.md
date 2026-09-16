# Data Migration Methodology

Standard approach for migrating data into NetSuite.

## Migration Phases

```
1. PLANNING
   ├── Scope definition
   ├── Data inventory
   ├── Dependency mapping
   └── Timeline/resources

2. PREPARATION
   ├── Extract source data
   ├── Cleanse and transform
   ├── Create CSV templates
   └── Validate data quality

3. TESTING (Sandbox)
   ├── Load test data
   ├── Verify mappings
   ├── Test business processes
   └── Fix issues, repeat

4. EXECUTION (Production)
   ├── Pre-migration backup
   ├── Load data in order
   ├── Validate each batch
   └── Document results

5. VALIDATION
   ├── Record counts
   ├── Sample verification
   ├── User acceptance
   └── Sign-off
```

## Data Load Order

**Critical**: Load data in dependency order to maintain referential integrity.

### Standard Order

| Order | Record Type | Dependencies |
|-------|-------------|--------------|
| 1 | **Subsidiaries** | None |
| 2 | **Locations** | Subsidiaries |
| 3 | **Departments/Classes** | Subsidiaries |
| 4 | **Currencies** | None |
| 5 | **Custom Lists** | None |
| 6 | **Vendors** | Subsidiaries, Currencies |
| 7 | **Customers** | Subsidiaries, Currencies |
| 8 | **Employees** | Subsidiaries, Departments |
| 9 | **Items** | Vendors, Locations |
| 10 | **Price Levels** | Items |
| 11 | **Inventory Adjustments** | Items, Locations |
| 12 | **Opening Balances** | Accounts, Customers, Vendors |
| 13 | **Historical Transactions** | All master data |

### Per-Entity Dependencies

```
Customers
├── Requires: Subsidiaries, Currencies, Sales Reps (Employees)
├── Optional: Terms, Price Levels, Tax Items
└── Load Before: Sales Orders, Invoices, Payments

Items
├── Requires: Subsidiaries, Units of Measure
├── Optional: Vendors, Locations, Tax Schedules
└── Load Before: Purchase Orders, Sales Orders, Inventory

Transactions
├── Requires: Customers/Vendors, Items, Locations
├── Optional: Classes, Departments, Projects
└── Load In: Chronological order (oldest first)
```

## CSV Import Methods

### CSV Import (Setup > Import/Export)

**Best for:**
- Initial data loads
- < 100,000 records
- Standard record types
- Simple mappings

**Limitations:**
- No complex transformations
- Limited error handling
- Manual process

### SuiteScript CSV Import

**Best for:**
- Complex transformations
- Custom validation
- Large datasets
- Automated/scheduled imports

### SOAP/REST API

**Best for:**
- Real-time imports
- Integration scenarios
- Complex record creation
- Programmatic control

## Import Checklist

### Pre-Import
- [ ] Backup existing data (if any)
- [ ] Verify sandbox matches production config
- [ ] Test with sample data (100-500 records)
- [ ] Document expected record counts
- [ ] Notify stakeholders of migration window

### During Import
- [ ] Monitor for errors
- [ ] Validate batch completion
- [ ] Check record counts
- [ ] Test sample transactions

### Post-Import
- [ ] Verify total record counts
- [ ] Run reconciliation reports
- [ ] Test key business processes
- [ ] Get user sign-off
- [ ] Document any issues/resolutions

## Error Handling

### Common Import Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid reference" | Foreign key not found | Load dependencies first |
| "Required field missing" | Mandatory field empty | Add default or fix source |
| "Duplicate external ID" | Record already exists | Update instead of create |
| "Permission denied" | Role lacks access | Use admin role |
| "Record locked" | Being edited | Wait or force unlock |

### Error Recovery

1. **Note the error row** - CSV import shows line numbers
2. **Export failed records** - Create separate CSV
3. **Fix issues** - In source data or mapping
4. **Re-import failed** - Only the failed records

## Best Practices

1. **Always test in sandbox first** - Production is not for testing
2. **Load in small batches** - Easier to diagnose issues
3. **Validate after each batch** - Don't wait until the end
4. **Keep source data** - For reference and re-import
5. **Document everything** - Mappings, issues, resolutions
6. **Plan for rollback** - Know how to undo if needed

## See Also

- `csv-templates/` - Templates for common record types
- `validation.md` - Data validation patterns
- `rollback.md` - Rollback procedures
