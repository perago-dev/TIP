# Security Review Criteria

Security-focused review criteria for SuiteScript code.

## Critical Security Issues

These must be fixed before approval:

### 1. Injection Vulnerabilities

#### Search/Query Injection

```javascript
// VULNERABLE: User input directly in filter
function searchCustomers(userInput) {
    return search.create({
        type: 'customer',
        filters: [['companyname', 'contains', userInput]]  // Dangerous!
    });
}

// SECURE: Validate and sanitize input
function searchCustomers(userInput) {
    // Validate input
    if (!userInput || typeof userInput !== 'string') {
        throw new Error('Invalid search input');
    }

    // Sanitize - remove special characters
    const sanitized = userInput.replace(/[^\w\s-]/g, '');

    // Length limit
    if (sanitized.length > 100) {
        throw new Error('Search term too long');
    }

    return search.create({
        type: 'customer',
        filters: [['companyname', 'contains', sanitized]]
    });
}
```

#### HTML/Script Injection (XSS)

```javascript
// VULNERABLE: User input rendered in HTML
function displayMessage(userMessage) {
    form.addField({
        id: 'custpage_message',
        type: serverWidget.FieldType.INLINEHTML,
        label: 'Message'
    }).defaultValue = '<div>' + userMessage + '</div>';  // XSS risk!
}

// SECURE: Escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function displayMessage(userMessage) {
    form.addField({
        id: 'custpage_message',
        type: serverWidget.FieldType.INLINEHTML,
        label: 'Message'
    }).defaultValue = '<div>' + escapeHtml(userMessage) + '</div>';
}
```

### 2. Authentication & Authorization

#### Missing Permission Checks

```javascript
// VULNERABLE: No permission check
function deleteRecord(recordId) {
    record.delete({ type: 'customrecord_sensitive', id: recordId });
}

// SECURE: Check permissions first
function deleteRecord(recordId) {
    const currentUser = runtime.getCurrentUser();

    // Check role
    if (!hasDeletePermission(currentUser.role)) {
        throw error.create({
            name: 'PERMISSION_DENIED',
            message: 'You do not have permission to delete this record'
        });
    }

    // Check ownership
    const rec = record.load({ type: 'customrecord_sensitive', id: recordId });
    if (rec.getValue('owner') !== currentUser.id && !isAdmin(currentUser.role)) {
        throw error.create({
            name: 'PERMISSION_DENIED',
            message: 'You can only delete your own records'
        });
    }

    record.delete({ type: 'customrecord_sensitive', id: recordId });
}
```

#### Role Elevation

```javascript
// VULNERABLE: Processing as admin regardless of caller
function adminOperation(recordId) {
    // This runs with script owner's permissions, not caller's
    record.submitFields({
        type: 'customrecord_config',
        id: recordId,
        values: { custrecord_setting: 'modified' }
    });
}

// SECURE: Verify caller has appropriate role
function adminOperation(recordId) {
    const currentUser = runtime.getCurrentUser();
    const adminRoles = [3, 1032];  // Administrator, Custom Admin

    if (adminRoles.indexOf(currentUser.role) === -1) {
        throw error.create({
            name: 'PERMISSION_DENIED',
            message: 'This operation requires administrator access'
        });
    }

    // Proceed with operation
}
```

#### Role/Permission Constants Pattern

Define role IDs and form IDs as named constants for maintainability:

```javascript
/**
 * Role and permission constants
 * Use instead of hardcoded role IDs throughout the codebase
 */
const ROLES = {
    ADMINISTRATOR: '3',
    SALES_MANAGER: '1022',
    SALES_REP: '1023',
    FINANCE_MANAGER: '1024',
    INTEGRATION_USER: '1031'
};

const FORMS = {
    STANDARD_PURCHASE_ORDER: '98',
    RESTRICTED_PURCHASE_ORDER: '147',
    STANDARD_SALES_ORDER: '92',
    RESTRICTED_SALES_ORDER: '148'
};

const PERMISSIONS = {
    APPROVE_ORDERS: [ROLES.ADMINISTRATOR, ROLES.SALES_MANAGER],
    VIEW_COSTS: [ROLES.ADMINISTRATOR, ROLES.FINANCE_MANAGER],
    EDIT_RESTRICTED: [ROLES.ADMINISTRATOR]
};

/**
 * Check if current user has permission
 */
function hasPermission(permissionType) {
    const currentRole = String(runtime.getCurrentUser().role);
    return PERMISSIONS[permissionType].includes(currentRole);
}

/**
 * Usage in script
 */
function beforeLoad(context) {
    const currentRole = String(runtime.getCurrentUser().role);

    // Skip for administrators
    if (currentRole === ROLES.ADMINISTRATOR) {
        return;
    }

    // Check specific permission
    if (!hasPermission('APPROVE_ORDERS')) {
        hideApproveButton(context.form);
    }

    // Restrict form access
    const formId = context.newRecord.getValue('customform');
    if (formId === FORMS.RESTRICTED_PURCHASE_ORDER) {
        if (!PERMISSIONS.EDIT_RESTRICTED.includes(currentRole)) {
            throw error.create({
                name: 'ACCESS_DENIED',
                message: 'You do not have access to this form'
            });
        }
    }
}
```

**Best Practices for Role Constants:**
- Store in a shared module that all scripts can import
- Document the source of each role ID (Setup > Users/Roles > Roles)
- Update constants when roles are added/removed
- Use string type for role IDs (NetSuite returns them as strings)

### 3. Credential Handling

#### Hardcoded Secrets

```javascript
// VULNERABLE: Credentials in code
const API_KEY = 'sk_live_abc123xyz';  // Never do this!

// SECURE: Use script parameters
const API_KEY = runtime.getCurrentScript()
    .getParameter({ name: 'custscript_api_key' });

// OR use secure string custom record
function getApiKey() {
    const config = record.load({
        type: 'customrecord_api_config',
        id: 1
    });
    return config.getValue('custrecord_api_key');  // Stored securely
}
```

#### Credential Logging

```javascript
// VULNERABLE: Logging sensitive data
log.debug({
    title: 'API Call',
    details: JSON.stringify({
        url: apiUrl,
        headers: headers,  // May contain API key!
        body: body
    })
});

// SECURE: Redact sensitive fields
function sanitizeForLogging(obj) {
    const sensitiveFields = ['password', 'apikey', 'api_key', 'secret', 'token'];
    const sanitized = JSON.parse(JSON.stringify(obj));

    function redact(obj) {
        Object.keys(obj).forEach(key => {
            if (sensitiveFields.includes(key.toLowerCase())) {
                obj[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                redact(obj[key]);
            }
        });
    }

    redact(sanitized);
    return sanitized;
}
```

### 4. Data Exposure

#### Excessive Data Return

```javascript
// VULNERABLE: Returning all fields
function getCustomer(id) {
    return record.load({ type: 'customer', id: id });  // Includes all fields!
}

// SECURE: Return only needed fields
function getCustomer(id) {
    return search.lookupFields({
        type: 'customer',
        id: id,
        columns: ['companyname', 'email', 'phone']  // Only public fields
    });
}
```

#### Error Message Disclosure

```javascript
// VULNERABLE: Exposing internal details
function processRequest(data) {
    try {
        // Processing
    } catch (e) {
        throw new Error('Database error: ' + e.message);  // Exposes internals!
    }
}

// SECURE: Generic user message, detailed logging
function processRequest(data) {
    try {
        // Processing
    } catch (e) {
        log.error({
            title: 'Processing Error',
            details: JSON.stringify({
                error: e.message,
                stack: e.stack,
                data: sanitizeForLogging(data)
            })
        });

        throw error.create({
            name: 'PROCESSING_ERROR',
            message: 'Unable to process request. Please contact support.'
        });
    }
}
```

## Security Review Checklist

### Input Validation

- [ ] All external input validated
- [ ] Type checking performed
- [ ] Length limits enforced
- [ ] Special characters handled
- [ ] No eval() or similar

### Authentication

- [ ] Caller identity verified
- [ ] Session validation (for web services)
- [ ] Token expiration checked

### Authorization

- [ ] Role-based access enforced
- [ ] Record-level permissions checked
- [ ] Principle of least privilege

### Data Protection

- [ ] Sensitive data encrypted
- [ ] No credentials in code
- [ ] Credentials not logged
- [ ] PII handling compliant
- [ ] Data minimization applied

### Audit & Logging

- [ ] Security events logged
- [ ] Failed attempts recorded
- [ ] No sensitive data in logs
- [ ] Log retention appropriate

## OWASP Top 10 Relevance

| OWASP Risk | NetSuite Relevance |
|------------|-------------------|
| A01 Broken Access Control | Check permissions, role validation |
| A02 Cryptographic Failures | Use NetSuite encryption, secure storage |
| A03 Injection | Validate search filters, escape HTML |
| A07 Auth Failures | Verify TBA tokens, check sessions |
| A09 Security Logging | Log security events, monitor failures |

## See Also

- `checklist.md` - Full review checklist
- `performance.md` - Performance review
- `../suitescript/gotchas.md` - Common security pitfalls
