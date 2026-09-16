# SuiteQL Standards

`N/query` with SuiteQL is preferred over `N/search` for complex multi-join aggregations — it is faster and more predictable at scale.

## When to Use SuiteQL vs. N/search

| Use N/search | Use SuiteQL |
|-------------|-------------|
| Simple single-record-type lookups | Multi-table joins |
| Saved search references | Aggregations (SUM, COUNT, GROUP BY) |
| Standard field filters | Complex WHERE conditions |
| Small result sets | Large result sets needing pagination |
| Admin-maintainable searches | Developer-owned queries |

## Core Rules

### Always paginate — 5,000-row default limit

SuiteQL has a 5,000-row default result limit. Always use `OFFSET` / `FETCH NEXT` for large datasets:

```javascript
define(['N/query'], function(query) {

    function runPagedQuery(sql, pageSize) {
        pageSize = pageSize || 1000;
        const results = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const pagedSql = sql + ' OFFSET ' + offset + ' ROWS FETCH NEXT ' + pageSize + ' ROWS ONLY';
            const page = query.runSuiteQL({ query: pagedSql }).asMappedResults();

            results.push.apply(results, page);
            hasMore = page.length === pageSize;
            offset += pageSize;
        }

        return results;
    }

    return { runPagedQuery: runPagedQuery };
});
```

### Always alias columns

Positional column access breaks when query structure changes. Always alias:

```javascript
// BAD — breaks if you add a column
const rows = query.runSuiteQL({
    query: 'SELECT t.id, t.tranid, t.entity FROM transaction t WHERE t.type = ?',
    params: ['SalesOrd']
}).asMappedResults();
const entityId = rows[0][1];  // Positional — fragile

// GOOD — explicit aliases
const rows = query.runSuiteQL({
    query: `SELECT t.id AS transactionId,
                   t.tranid AS tranNumber,
                   t.entity AS entityId
            FROM transaction t
            WHERE t.type = ?`,
    params: ['SalesOrd']
}).asMappedResults();
const entityId = rows[0].entityId;  // Named — safe
```

### Always use parameterized queries

Never concatenate variables directly into a SuiteQL query string — use `?` placeholders to prevent injection vulnerabilities:

```javascript
// BAD — SQL injection risk
const subsidiaryId = context.request.getParameter({ name: 'subsidiary' });
query.runSuiteQL({
    query: `SELECT id FROM subsidiary WHERE id = ${subsidiaryId}`
});

// GOOD — parameterized
query.runSuiteQL({
    query: 'SELECT id FROM subsidiary WHERE id = ?',
    params: [subsidiaryId]
});
```

### Never use SELECT *

Always specify columns explicitly for performance and forward compatibility:

```javascript
// BAD
query.runSuiteQL({ query: 'SELECT * FROM transaction WHERE type = ?', params: ['SalesOrd'] });

// GOOD
query.runSuiteQL({
    query: `SELECT t.id AS id,
                   t.tranid AS tranNumber,
                   t.trandate AS tranDate,
                   t.entity AS customerId
            FROM transaction t
            WHERE t.type = ?`,
    params: ['SalesOrd']
});
```

### Handle NULLs explicitly

SuiteQL returns `NULL` where `N/search` would return an empty string. Use `NVL()` or `COALESCE()` for nullable fields:

```javascript
query.runSuiteQL({
    query: `SELECT t.id AS id,
                   NVL(t.custbody_po_number, '') AS poNumber,
                   COALESCE(t.memo, 'No memo') AS memo
            FROM transaction t
            WHERE t.type = ?`,
    params: ['SalesOrd']
});
```

## Testing Before Embedding

Always test SuiteQL queries in the **SuiteQL Workbench** before embedding in scripts — syntax errors only surface at runtime otherwise.

Navigate to: **Customization > Scripting > SuiteQL**

## Common Patterns

### Aggregation

```javascript
query.runSuiteQL({
    query: `SELECT t.entity AS customerId,
                   SUM(t.foreigntotal) AS totalRevenue,
                   COUNT(t.id) AS orderCount
            FROM transaction t
            WHERE t.type = ?
              AND t.trandate >= ?
              AND t.trandate <= ?
            GROUP BY t.entity
            ORDER BY totalRevenue DESC`,
    params: ['SalesOrd', startDate, endDate]
});
```

### Multi-table join

```javascript
query.runSuiteQL({
    query: `SELECT t.id AS transactionId,
                   t.tranid AS tranNumber,
                   e.companyname AS customerName,
                   tl.item AS itemId,
                   i.displayname AS itemName,
                   tl.quantity AS qty,
                   tl.rate AS unitPrice
            FROM transaction t
            JOIN entity e ON e.id = t.entity
            JOIN transactionLine tl ON tl.transaction = t.id
            JOIN item i ON i.id = tl.item
            WHERE t.type = ?
              AND tl.mainline = ?`,
    params: ['SalesOrd', 'F']
});
```

### Use formula fields for unsupported conditions

```javascript
// For conditions not natively supported by N/search API
search.create({
    type: 'transaction',
    filters: [
        ['formulanumeric: CASE WHEN {custbody_field} > 100 THEN 1 ELSE 0 END', 'equalto', '1']
    ]
});
```

## See Also

- `patterns/rest-inbound.md` - RESTlet patterns
- `../suitescript/snippets/search-patterns.md` - N/search patterns
- `../suitescript/snippets/governance.md` - Governance costs for N/query
