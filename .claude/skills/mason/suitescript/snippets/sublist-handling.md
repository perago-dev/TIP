# Sublist Handling Patterns

Working with line items on transaction and entity records.

## Static vs Dynamic Mode

| Mode | Use For | Note |
|------|---------|------|
| **Static** | Scheduled scripts, User Events | Set values directly by line |
| **Dynamic** | Client Scripts, Suitelets | Must select/commit lines |

## Static Mode (Default)

### Reading Lines

```javascript
const rec = record.load({
    type: 'salesorder',
    id: orderId,
    isDynamic: false  // Static mode
});

// Get line count
const lineCount = rec.getLineCount({ sublistId: 'item' });

// Iterate through lines
for (let i = 0; i < lineCount; i++) {
    const itemId = rec.getSublistValue({
        sublistId: 'item',
        fieldId: 'item',
        line: i
    });

    const quantity = rec.getSublistValue({
        sublistId: 'item',
        fieldId: 'quantity',
        line: i
    });

    const rate = rec.getSublistValue({
        sublistId: 'item',
        fieldId: 'rate',
        line: i
    });

    const amount = rec.getSublistValue({
        sublistId: 'item',
        fieldId: 'amount',
        line: i
    });

    log.debug({
        title: 'Line ' + i,
        details: 'Item: ' + itemId + ', Qty: ' + quantity + ', Rate: ' + rate
    });
}
```

### Setting Line Values

```javascript
// Set value on existing line
rec.setSublistValue({
    sublistId: 'item',
    fieldId: 'quantity',
    line: 0,
    value: 10
});

// Set text value (for select fields)
rec.setSublistText({
    sublistId: 'item',
    fieldId: 'taxcode',
    line: 0,
    text: 'CA-Sales Tax'
});
```

### Adding Lines

```javascript
// Insert new line at specific position
rec.insertLine({
    sublistId: 'item',
    line: 0  // Insert at beginning
});

// Set values on new line
rec.setSublistValue({
    sublistId: 'item',
    fieldId: 'item',
    line: 0,
    value: itemId
});

rec.setSublistValue({
    sublistId: 'item',
    fieldId: 'quantity',
    line: 0,
    value: 5
});

rec.setSublistValue({
    sublistId: 'item',
    fieldId: 'rate',
    line: 0,
    value: 100
});
```

### Removing Lines

```javascript
// Remove from end first to preserve indices
for (let i = lineCount - 1; i >= 0; i--) {
    const shouldRemove = rec.getSublistValue({
        sublistId: 'item',
        fieldId: 'quantity',
        line: i
    }) === 0;

    if (shouldRemove) {
        rec.removeLine({
            sublistId: 'item',
            line: i
        });
    }
}
```

## Dynamic Mode

### Adding Lines

```javascript
const rec = record.load({
    type: 'salesorder',
    id: orderId,
    isDynamic: true
});

// Select new line
rec.selectNewLine({ sublistId: 'item' });

// Set values on current line
rec.setCurrentSublistValue({
    sublistId: 'item',
    fieldId: 'item',
    value: itemId,
    ignoreFieldChange: false  // Allow field sourcing
});

rec.setCurrentSublistValue({
    sublistId: 'item',
    fieldId: 'quantity',
    value: 10
});

rec.setCurrentSublistValue({
    sublistId: 'item',
    fieldId: 'rate',
    value: 100
});

// Commit the line
rec.commitLine({ sublistId: 'item' });
```

### Editing Existing Lines

```javascript
// Select line to edit
rec.selectLine({
    sublistId: 'item',
    line: 0
});

// Modify values
rec.setCurrentSublistValue({
    sublistId: 'item',
    fieldId: 'quantity',
    value: 20
});

// Commit changes
rec.commitLine({ sublistId: 'item' });
```

### Canceling Line Changes

```javascript
// Start editing
rec.selectLine({
    sublistId: 'item',
    line: 0
});

rec.setCurrentSublistValue({
    sublistId: 'item',
    fieldId: 'quantity',
    value: 999
});

// Oops, cancel changes
rec.cancelLine({ sublistId: 'item' });
```

## Common Sublists by Record Type

### Transaction Records
| Sublist ID | Description |
|------------|-------------|
| `item` | Line items |
| `expense` | Expense lines |
| `partners` | Partner information |
| `salesteam` | Sales team |
| `links` | Related transactions |
| `shipgroup` | Shipping groups |
| `approvals` | Approval tracking |

### Customer/Vendor
| Sublist ID | Description |
|------------|-------------|
| `addressbook` | Addresses |
| `contactroles` | Contact roles |
| `currency` | Currency settings |
| `subscriptions` | Marketing subscriptions |

### Employee
| Sublist ID | Description |
|------------|-------------|
| `roles` | Assigned roles |
| `competencies` | Skills/competencies |

## Pattern: Copy Lines Between Records

```javascript
function copyLines(sourceRec, targetRec, sublistId) {
    const lineCount = sourceRec.getLineCount({ sublistId: sublistId });

    for (let i = 0; i < lineCount; i++) {
        // Get source values
        const item = sourceRec.getSublistValue({
            sublistId: sublistId,
            fieldId: 'item',
            line: i
        });
        const quantity = sourceRec.getSublistValue({
            sublistId: sublistId,
            fieldId: 'quantity',
            line: i
        });
        const rate = sourceRec.getSublistValue({
            sublistId: sublistId,
            fieldId: 'rate',
            line: i
        });

        // Set on target (static mode)
        targetRec.insertLine({
            sublistId: sublistId,
            line: i
        });

        targetRec.setSublistValue({
            sublistId: sublistId,
            fieldId: 'item',
            line: i,
            value: item
        });
        targetRec.setSublistValue({
            sublistId: sublistId,
            fieldId: 'quantity',
            line: i,
            value: quantity
        });
        targetRec.setSublistValue({
            sublistId: sublistId,
            fieldId: 'rate',
            line: i,
            value: rate
        });
    }
}
```

## Pattern: Calculate Line Totals

```javascript
function calculateOrderTotals(rec) {
    const lineCount = rec.getLineCount({ sublistId: 'item' });
    let subtotal = 0;
    let totalQuantity = 0;

    for (let i = 0; i < lineCount; i++) {
        const amount = parseFloat(rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'amount',
            line: i
        })) || 0;

        const quantity = parseFloat(rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            line: i
        })) || 0;

        subtotal += amount;
        totalQuantity += quantity;
    }

    return {
        subtotal: subtotal,
        totalQuantity: totalQuantity,
        lineCount: lineCount
    };
}
```

## Pattern: Filter Lines

```javascript
function getFilteredLines(rec, filterFn) {
    const lines = [];
    const lineCount = rec.getLineCount({ sublistId: 'item' });

    for (let i = 0; i < lineCount; i++) {
        const lineData = {
            line: i,
            item: rec.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            }),
            quantity: rec.getSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                line: i
            }),
            amount: rec.getSublistValue({
                sublistId: 'item',
                fieldId: 'amount',
                line: i
            })
        };

        if (filterFn(lineData)) {
            lines.push(lineData);
        }
    }

    return lines;
}

// Usage: Get lines with quantity > 10
const highQuantityLines = getFilteredLines(rec, function(line) {
    return line.quantity > 10;
});
```

## Pattern: Update All Lines

```javascript
function updateAllLines(rec, sublistId, fieldId, value) {
    const lineCount = rec.getLineCount({ sublistId: sublistId });

    for (let i = 0; i < lineCount; i++) {
        rec.setSublistValue({
            sublistId: sublistId,
            fieldId: fieldId,
            line: i,
            value: value
        });
    }
}

// Usage: Mark all lines closed
updateAllLines(rec, 'item', 'isclosed', true);
```

## Pattern: Find Line by Item

```javascript
function findLineByItem(rec, itemId) {
    const lineCount = rec.getLineCount({ sublistId: 'item' });

    for (let i = 0; i < lineCount; i++) {
        const lineItem = rec.getSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            line: i
        });

        if (lineItem == itemId) {
            return i;
        }
    }

    return -1;  // Not found
}

// Or using findSublistLineWithValue
const lineNum = rec.findSublistLineWithValue({
    sublistId: 'item',
    fieldId: 'item',
    value: itemId
});
```

## Sublist in Client Scripts

```javascript
function fieldChanged(context) {
    const rec = context.currentRecord;
    const sublistId = context.sublistId;
    const fieldId = context.fieldId;
    const line = context.line;

    // Only handle item sublist changes
    if (sublistId !== 'item') return;

    // Handle specific field change
    if (fieldId === 'quantity') {
        const quantity = rec.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity'
        });

        const rate = rec.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'rate'
        });

        // Calculate and set amount
        const amount = quantity * rate;
        rec.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_calc_amount',
            value: amount
        });
    }
}
```

## Best Practices

1. **Use static mode in server scripts** - More predictable
2. **Remove lines from end first** - Preserve indices
3. **Check for empty sublists** - lineCount might be 0
4. **Commit lines in dynamic mode** - Don't forget!
5. **Handle field sourcing** - ignoreFieldChange: false to trigger
6. **Use findSublistLineWithValue** - More efficient than loop

## Common Mistakes

```javascript
// WRONG: Removing lines forwards shifts indices
for (let i = 0; i < lineCount; i++) {
    if (shouldRemove(rec, i)) {
        rec.removeLine({ sublistId: 'item', line: i });
        // Next iteration will skip a line!
    }
}

// RIGHT: Remove from end
for (let i = lineCount - 1; i >= 0; i--) {
    if (shouldRemove(rec, i)) {
        rec.removeLine({ sublistId: 'item', line: i });
    }
}
```

## See Also

- `record-operations.md` - Record loading/saving
- `../patterns/user-event.md` - Sublist handling in events
- `../patterns/client-script.md` - Sublist in client scripts
