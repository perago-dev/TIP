# Rollback Procedures

How to undo a data migration if things go wrong.

## Rollback Planning

**Before any migration:**
1. Document what will be imported
2. Create backup/snapshot
3. Define rollback criteria
4. Test rollback procedure in sandbox
5. Assign rollback decision authority

## Rollback Strategies

### Strategy 1: Delete Imported Records

**Best for:**
- New records only (no updates)
- Clear External ID pattern
- < 10,000 records

```javascript
/**
 * Delete records imported on specific date
 */
function deleteImportedRecords(recordType, importDate) {
    const search = require('N/search');
    const record = require('N/record');

    const toDelete = [];

    search.create({
        type: recordType,
        filters: [
            ['datecreated', 'on', importDate],
            'AND',
            ['externalid', 'startswith', 'IMPORT_']  // Your pattern
        ]
    }).run().each(function(result) {
        toDelete.push(result.id);
        return true;
    });

    log.audit({
        title: 'Rollback - Records to Delete',
        details: recordType + ': ' + toDelete.length
    });

    // Delete in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const batch = toDelete.slice(i, i + BATCH_SIZE);
        batch.forEach(function(id) {
            try {
                record.delete({ type: recordType, id: id });
            } catch (e) {
                log.error({
                    title: 'Delete Failed',
                    details: recordType + ' ID ' + id + ': ' + e.message
                });
            }
        });
    }

    return toDelete.length;
}
```

### Strategy 2: Restore from Backup

**Best for:**
- Updates to existing records
- Complex rollbacks
- Critical data

```javascript
/**
 * Restore records from backup
 */
function restoreFromBackup(recordType, backupFile) {
    const file = require('N/file');
    const record = require('N/record');

    // Load backup file
    const backup = file.load({ id: backupFile });
    const contents = backup.getContents();
    const records = JSON.parse(contents);

    const results = { restored: 0, failed: 0 };

    records.forEach(function(backupData) {
        try {
            const rec = record.load({
                type: recordType,
                id: backupData.id
            });

            // Restore each field
            Object.keys(backupData.values).forEach(function(field) {
                rec.setValue(field, backupData.values[field]);
            });

            rec.save();
            results.restored++;

        } catch (e) {
            results.failed++;
            log.error({
                title: 'Restore Failed',
                details: 'ID ' + backupData.id + ': ' + e.message
            });
        }
    });

    return results;
}
```

### Strategy 3: Reversal Transactions

**Best for:**
- Financial transactions
- Audit trail required
- Accounting impact

```javascript
/**
 * Create reversal entries for imported transactions
 */
function createReversals(transactionIds, reversalDate, memo) {
    const results = { reversed: 0, failed: 0 };

    transactionIds.forEach(function(tranId) {
        try {
            // Load original transaction
            const original = record.load({
                type: 'journalentry',  // Adjust for transaction type
                id: tranId
            });

            // Create reversal
            const reversal = record.create({
                type: 'journalentry',
                isDynamic: true
            });

            reversal.setValue('trandate', reversalDate);
            reversal.setValue('memo', memo + ' - Reversal of #' + original.getValue('tranid'));

            // Reverse each line (swap debit/credit)
            const lineCount = original.getLineCount({ sublistId: 'line' });
            for (let i = 0; i < lineCount; i++) {
                reversal.selectNewLine({ sublistId: 'line' });

                reversal.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'account',
                    value: original.getSublistValue({
                        sublistId: 'line',
                        fieldId: 'account',
                        line: i
                    })
                });

                // Swap debit and credit
                const debit = original.getSublistValue({
                    sublistId: 'line',
                    fieldId: 'debit',
                    line: i
                });
                const credit = original.getSublistValue({
                    sublistId: 'line',
                    fieldId: 'credit',
                    line: i
                });

                reversal.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'debit',
                    value: credit
                });
                reversal.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'credit',
                    value: debit
                });

                reversal.commitLine({ sublistId: 'line' });
            }

            reversal.save();
            results.reversed++;

        } catch (e) {
            results.failed++;
            log.error({
                title: 'Reversal Failed',
                details: 'Tran ID ' + tranId + ': ' + e.message
            });
        }
    });

    return results;
}
```

## Pre-Migration Backup

### Create Record Backup

```javascript
/**
 * Backup records before migration
 */
function createBackup(recordType, filters, backupFolderId) {
    const search = require('N/search');
    const file = require('N/file');
    const record = require('N/record');

    const backup = [];
    const fieldsToBackup = getFieldsForRecordType(recordType);

    search.create({
        type: recordType,
        filters: filters,
        columns: ['internalid']
    }).run().each(function(result) {
        const rec = record.load({ type: recordType, id: result.id });

        const recordData = {
            id: result.id,
            values: {}
        };

        fieldsToBackup.forEach(function(field) {
            recordData.values[field] = rec.getValue(field);
        });

        backup.push(recordData);
        return true;
    });

    // Save backup file
    const backupFile = file.create({
        name: 'backup_' + recordType + '_' + new Date().toISOString().split('T')[0] + '.json',
        fileType: file.Type.JSON,
        contents: JSON.stringify(backup, null, 2),
        folder: backupFolderId
    });

    const fileId = backupFile.save();

    log.audit({
        title: 'Backup Created',
        details: recordType + ': ' + backup.length + ' records, File ID: ' + fileId
    });

    return fileId;
}
```

### Database Snapshot (Enterprise Only)

For NetSuite SuiteCloud Plus customers:
- Request database snapshot before migration
- Contact NetSuite support for full database restore if needed

## Rollback Decision Matrix

| Scenario | Action | Authority |
|----------|--------|-----------|
| < 100 errors, fixable | Fix and continue | Tech Lead |
| > 100 errors, pattern clear | Pause, fix source, restart | Tech Lead |
| Data corruption detected | Full rollback | Project Manager |
| Business process broken | Full rollback | Business Owner |
| Minor issues, deadline pressure | Accept and fix later | Business Owner |

## Rollback Checklist

### Before Rollback

- [ ] Document the issue
- [ ] Get rollback authorization
- [ ] Notify stakeholders
- [ ] Verify backup exists
- [ ] Test rollback in sandbox (if time permits)

### During Rollback

- [ ] Stop any running imports
- [ ] Lock records if possible
- [ ] Execute rollback script
- [ ] Monitor for errors
- [ ] Document progress

### After Rollback

- [ ] Verify record counts
- [ ] Test business processes
- [ ] Notify stakeholders
- [ ] Document lessons learned
- [ ] Plan re-migration

## Partial Rollback

### Delete Specific Records

```javascript
/**
 * Delete records by External ID list
 */
function deleteByExternalIds(recordType, externalIds) {
    const results = { deleted: 0, notFound: 0, failed: 0 };

    externalIds.forEach(function(extId) {
        try {
            const searchResults = search.create({
                type: recordType,
                filters: [['externalid', 'is', extId]]
            }).run().getRange({ start: 0, end: 1 });

            if (searchResults.length === 0) {
                results.notFound++;
                return;
            }

            record.delete({
                type: recordType,
                id: searchResults[0].id
            });

            results.deleted++;

        } catch (e) {
            results.failed++;
            log.error({
                title: 'Delete Failed',
                details: extId + ': ' + e.message
            });
        }
    });

    return results;
}
```

### Revert Field Updates

```javascript
/**
 * Revert specific field to previous value
 */
function revertFieldUpdates(recordType, updates) {
    // updates: [{ id: 123, field: 'status', previousValue: 'A' }]

    const results = { reverted: 0, failed: 0 };

    updates.forEach(function(update) {
        try {
            record.submitFields({
                type: recordType,
                id: update.id,
                values: { [update.field]: update.previousValue }
            });
            results.reverted++;
        } catch (e) {
            results.failed++;
            log.error({
                title: 'Revert Failed',
                details: 'ID ' + update.id + ': ' + e.message
            });
        }
    });

    return results;
}
```

## Best Practices

1. **Always backup before migration** - No exceptions
2. **Use External IDs** - Makes selective deletion possible
3. **Test rollback in sandbox** - Before production migration
4. **Document rollback criteria** - When to trigger
5. **Assign decision authority** - Who can authorize rollback
6. **Set time limits** - Don't spend hours troubleshooting in production
7. **Communicate early** - Notify stakeholders of issues

## See Also

- `INDEX.md` - Migration methodology
- `validation.md` - Prevent issues before they happen
- `../suitescript/snippets/record-operations.md` - Record delete patterns
