# Common Transformations

Standard transformation patterns for field mapping.

## Data Type Transformations

### Date/Time

```javascript
// ISO 8601 to NetSuite Date
function isoToNetSuiteDate(isoString) {
    const date = new Date(isoString);
    return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
}

// NetSuite Date to ISO 8601
function netSuiteDateToIso(nsDate) {
    // nsDate is a Date object when loaded from record
    return nsDate.toISOString();
}

// Unix timestamp to NetSuite
function unixToNetSuiteDate(timestamp) {
    const date = new Date(timestamp * 1000);
    return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
}

// Format date for display
const format = require('N/format');
const formattedDate = format.format({
    value: dateObject,
    type: format.Type.DATE
});
```

### Currency/Numbers

```javascript
// String to number
function parseAmount(value) {
    if (typeof value === 'number') return value;
    // Remove currency symbols and commas
    const cleaned = String(value).replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
}

// Round to 2 decimal places
function roundCurrency(value) {
    return Math.round(value * 100) / 100;
}

// Format as currency string
function formatCurrency(value, currencySymbol) {
    return (currencySymbol || '$') + value.toFixed(2);
}

// Convert units (e.g., cents to dollars)
function centsToDollars(cents) {
    return cents / 100;
}
```

### Boolean

```javascript
// String to boolean
function parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    const trueValues = ['true', 'yes', '1', 'y', 't'];
    return trueValues.indexOf(String(value).toLowerCase()) !== -1;
}

// Boolean to NetSuite checkbox
function toNetSuiteCheckbox(value) {
    return parseBoolean(value) ? 'T' : 'F';
}
```

## Lookup Transformations

### Entity Lookup

```javascript
/**
 * Find entity by external ID or create if not found
 */
function findOrCreateCustomer(externalId, data) {
    // Search by external ID
    const results = search.create({
        type: 'customer',
        filters: [['custentity_external_id', 'is', externalId]],
        columns: ['internalid']
    }).run().getRange({ start: 0, end: 1 });

    if (results.length > 0) {
        return results[0].id;
    }

    // Create new customer
    const customer = record.create({ type: 'customer' });
    customer.setValue('companyname', data.name);
    customer.setValue('email', data.email);
    customer.setValue('custentity_external_id', externalId);
    return customer.save();
}
```

### Item Lookup

```javascript
/**
 * Find item by SKU/UPC/External ID
 */
function findItem(identifier, identifierType) {
    const fieldMap = {
        'sku': 'itemid',
        'upc': 'upccode',
        'external_id': 'externalid',
        'mpn': 'mpn'
    };

    const field = fieldMap[identifierType] || 'itemid';

    const results = search.create({
        type: 'item',
        filters: [[field, 'is', identifier]],
        columns: ['internalid', 'itemid', 'displayname']
    }).run().getRange({ start: 0, end: 1 });

    if (results.length === 0) {
        throw new Error('Item not found: ' + identifier);
    }

    return {
        id: results[0].id,
        sku: results[0].getValue('itemid'),
        name: results[0].getValue('displayname')
    };
}
```

### Code/Status Lookup

```javascript
/**
 * Map external status codes to NetSuite values
 */
function mapStatus(externalStatus, mappingTable) {
    const mapping = {
        'pending': 'A',
        'processing': 'B',
        'completed': 'C',
        'cancelled': 'D',
        ...mappingTable
    };

    const nsStatus = mapping[externalStatus.toLowerCase()];

    if (!nsStatus) {
        log.warning({
            title: 'Unknown Status',
            details: 'External status: ' + externalStatus
        });
        return mapping['pending'];  // Default
    }

    return nsStatus;
}
```

## Address Transformations

### Standard Address Mapping

```javascript
/**
 * Map external address to NetSuite address
 */
function mapAddress(externalAddress) {
    return {
        addr1: externalAddress.line1 || externalAddress.address1 || '',
        addr2: externalAddress.line2 || externalAddress.address2 || '',
        city: externalAddress.city || '',
        state: mapState(externalAddress.state || externalAddress.province),
        zip: externalAddress.postal_code || externalAddress.zip || '',
        country: mapCountry(externalAddress.country || externalAddress.country_code),
        attention: externalAddress.name || '',
        phone: externalAddress.phone || ''
    };
}

function mapState(state) {
    // If already a code, validate
    if (state && state.length === 2) {
        return state.toUpperCase();
    }

    // Map full name to code
    const stateMap = {
        'california': 'CA',
        'new york': 'NY',
        'texas': 'TX',
        // ... etc
    };

    return stateMap[(state || '').toLowerCase()] || state;
}

function mapCountry(country) {
    const countryMap = {
        'united states': 'US',
        'usa': 'US',
        'canada': 'CA',
        'united kingdom': 'GB',
        'uk': 'GB',
        // ... etc
    };

    const code = (country || '').length === 2 ?
        country.toUpperCase() :
        countryMap[(country || '').toLowerCase()];

    return code || 'US';  // Default to US
}
```

### Set Address on Record

```javascript
/**
 * Set address subrecord on transaction
 */
function setShippingAddress(rec, address) {
    const addressSubrecord = rec.getSubrecord({ fieldId: 'shippingaddress' });

    addressSubrecord.setValue('addr1', address.addr1);
    addressSubrecord.setValue('addr2', address.addr2);
    addressSubrecord.setValue('city', address.city);
    addressSubrecord.setValue('state', address.state);
    addressSubrecord.setValue('zip', address.zip);
    addressSubrecord.setValue('country', address.country);
    addressSubrecord.setValue('attention', address.attention);
    addressSubrecord.setValue('addrphone', address.phone);
}

/**
 * Add address to customer address book
 */
function addCustomerAddress(customerRec, address, isDefault) {
    customerRec.selectNewLine({ sublistId: 'addressbook' });

    customerRec.setCurrentSublistValue({
        sublistId: 'addressbook',
        fieldId: 'defaultshipping',
        value: isDefault
    });

    const addressSubrecord = customerRec.getCurrentSublistSubrecord({
        sublistId: 'addressbook',
        fieldId: 'addressbookaddress'
    });

    addressSubrecord.setValue('addr1', address.addr1);
    addressSubrecord.setValue('addr2', address.addr2);
    addressSubrecord.setValue('city', address.city);
    addressSubrecord.setValue('state', address.state);
    addressSubrecord.setValue('zip', address.zip);
    addressSubrecord.setValue('country', address.country);

    customerRec.commitLine({ sublistId: 'addressbook' });
}
```

## String Transformations

### Text Cleaning

```javascript
/**
 * Clean and normalize text
 */
function cleanText(value) {
    if (!value) return '';

    return String(value)
        .trim()
        .replace(/\s+/g, ' ')        // Normalize whitespace
        .replace(/[^\x20-\x7E]/g, '');  // Remove non-printable characters
}

/**
 * Truncate to max length
 */
function truncate(value, maxLength) {
    if (!value) return '';
    const text = String(value);
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}

/**
 * Convert to title case
 */
function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}
```

### Phone Number

```javascript
/**
 * Normalize phone number
 */
function normalizePhone(phone) {
    if (!phone) return '';

    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length === 10) {
        return '(' + digits.substring(0, 3) + ') ' +
               digits.substring(3, 6) + '-' +
               digits.substring(6);
    }

    // Return cleaned digits for international
    return digits;
}
```

### Email

```javascript
/**
 * Validate and clean email
 */
function cleanEmail(email) {
    if (!email) return '';

    const cleaned = String(email).trim().toLowerCase();

    // Basic validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleaned)) {
        throw new Error('Invalid email: ' + email);
    }

    return cleaned;
}
```

## Array/Object Transformations

### Flatten Nested Object

```javascript
/**
 * Flatten nested object for mapping
 */
function flatten(obj, prefix) {
    prefix = prefix || '';
    const result = {};

    Object.keys(obj).forEach(function(key) {
        const newKey = prefix ? prefix + '.' + key : key;

        if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            Object.assign(result, flatten(obj[key], newKey));
        } else {
            result[newKey] = obj[key];
        }
    });

    return result;
}

// Usage
const flattened = flatten({
    customer: {
        name: 'John',
        address: { city: 'NYC' }
    }
});
// Result: { 'customer.name': 'John', 'customer.address.city': 'NYC' }
```

### Array to Multi-Select

```javascript
/**
 * Convert array of values to NetSuite multi-select
 */
function arrayToMultiSelect(values, lookupFn) {
    if (!Array.isArray(values)) return [];

    return values
        .map(function(value) {
            return lookupFn ? lookupFn(value) : value;
        })
        .filter(function(value) {
            return value !== null && value !== undefined;
        });
}
```

## Default Value Handling

```javascript
/**
 * Get value with default
 */
function getValue(obj, path, defaultValue) {
    const keys = path.split('.');
    let result = obj;

    for (let i = 0; i < keys.length; i++) {
        if (result === null || result === undefined) {
            return defaultValue;
        }
        result = result[keys[i]];
    }

    return result !== null && result !== undefined ? result : defaultValue;
}

// Usage
const city = getValue(order, 'shipping_address.city', 'Unknown');
```

## Validation Helpers

```javascript
/**
 * Validate required fields
 */
function validateRequired(data, requiredFields) {
    const missing = [];

    requiredFields.forEach(function(field) {
        const value = getValue(data, field, null);
        if (value === null || value === '') {
            missing.push(field);
        }
    });

    if (missing.length > 0) {
        throw new Error('Missing required fields: ' + missing.join(', '));
    }
}

/**
 * Validate data types
 */
function validateTypes(data, typeDefinitions) {
    const errors = [];

    Object.keys(typeDefinitions).forEach(function(field) {
        const value = getValue(data, field, null);
        if (value === null) return;  // Skip if not present

        const expectedType = typeDefinitions[field];
        const actualType = typeof value;

        if (expectedType === 'number' && actualType !== 'number') {
            errors.push(field + ' must be a number');
        } else if (expectedType === 'array' && !Array.isArray(value)) {
            errors.push(field + ' must be an array');
        } else if (expectedType !== 'array' && actualType !== expectedType) {
            errors.push(field + ' must be of type ' + expectedType);
        }
    });

    if (errors.length > 0) {
        throw new Error('Validation errors: ' + errors.join('; '));
    }
}
```

## See Also

- `template.md` - Field mapping template
- `../patterns/rest-inbound.md` - Implementation patterns
- `../error-handling.md` - Error handling
