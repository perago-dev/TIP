# SFTP Integration Patterns

Patterns for file-based integrations using SFTP.

## Architecture Overview

```
NetSuite → SFTP Module → SFTP Server
             │
             ├── Connect
             ├── Upload/Download
             ├── File Processing
             └── Disconnect
```

## Basic SFTP Operations

### Connection Setup

```javascript
const sftp = require('N/sftp');
const file = require('N/file');

function createConnection() {
    const connection = sftp.createConnection({
        username: 'sftp_user',
        passwordGuid: 'GUID-FROM-SECRETS',  // Store in File Cabinet
        url: 'sftp.example.com',
        port: 22,
        hostKey: 'ssh-rsa AAAAB3NzaC1...',  // Server's public key
        hostKeyType: 'RSA'
    });

    return connection;
}
```

### Key-Based Authentication

```javascript
function createKeyConnection() {
    const privateKey = file.load({
        id: 'SuiteScripts/keys/private_key.pem'
    }).getContents();

    const connection = sftp.createConnection({
        username: 'sftp_user',
        keyId: privateKey,  // Or use GUID for stored key
        url: 'sftp.example.com',
        port: 22,
        hostKey: getHostKey(),
        hostKeyType: 'RSA'
    });

    return connection;
}
```

## Pattern: File Upload

```javascript
/**
 * Upload file to SFTP server
 */
function uploadFile(localFileId, remotePath) {
    const connection = createConnection();

    try {
        // Load local file
        const localFile = file.load({ id: localFileId });

        // Upload to SFTP
        connection.upload({
            file: localFile,
            directory: remotePath,
            filename: localFile.name,
            replaceExisting: true
        });

        log.audit({
            title: 'File Uploaded',
            details: 'File: ' + localFile.name + ', Path: ' + remotePath
        });

        return {
            success: true,
            filename: localFile.name,
            remotePath: remotePath + '/' + localFile.name
        };

    } finally {
        // Always close connection
    }
}
```

## Pattern: File Download

```javascript
/**
 * Download file from SFTP server
 */
function downloadFile(remotePath, localFolderId) {
    const connection = createConnection();

    try {
        // Download from SFTP
        const downloadedFile = connection.download({
            directory: remotePath.substring(0, remotePath.lastIndexOf('/')),
            filename: remotePath.substring(remotePath.lastIndexOf('/') + 1)
        });

        // Save to File Cabinet
        downloadedFile.folder = localFolderId;
        const fileId = downloadedFile.save();

        log.audit({
            title: 'File Downloaded',
            details: 'Remote: ' + remotePath + ', Local ID: ' + fileId
        });

        return {
            success: true,
            fileId: fileId,
            filename: downloadedFile.name
        };

    } finally {
        // Connection closed automatically
    }
}
```

## Pattern: Export Orders to CSV

```javascript
/**
 * Export orders to CSV and upload to SFTP
 */
function execute(context) {
    // Generate CSV content
    const csvContent = generateOrdersCsv();

    // Create file in File Cabinet
    const csvFile = file.create({
        name: 'orders_' + formatDate(new Date()) + '.csv',
        fileType: file.Type.CSV,
        contents: csvContent,
        folder: getTempFolderId()
    });
    const fileId = csvFile.save();

    // Upload to SFTP
    const connection = createConnection();

    try {
        const loadedFile = file.load({ id: fileId });

        connection.upload({
            file: loadedFile,
            directory: '/incoming/orders',
            filename: loadedFile.name,
            replaceExisting: true
        });

        log.audit({
            title: 'Orders Exported',
            details: loadedFile.name
        });

        // Optionally delete temp file
        file.delete({ id: fileId });

    } catch (e) {
        log.error({ title: 'SFTP Upload Failed', details: e.message });
        throw e;
    }
}

function generateOrdersCsv() {
    const lines = ['Order Number,Customer,Date,Total'];

    search.create({
        type: 'salesorder',
        filters: [
            ['mainline', 'is', 'T'],
            'AND',
            ['trandate', 'within', 'yesterday']
        ],
        columns: ['tranid', 'entity', 'trandate', 'total']
    }).run().each(function(result) {
        lines.push([
            result.getValue('tranid'),
            '"' + result.getText('entity').replace(/"/g, '""') + '"',
            result.getValue('trandate'),
            result.getValue('total')
        ].join(','));
        return true;
    });

    return lines.join('\n');
}
```

## Pattern: Import CSV from SFTP

```javascript
/**
 * Download and process CSV from SFTP
 */
function execute(context) {
    const connection = createConnection();
    const processedFolder = '/processed';
    const incomingFolder = '/incoming';

    try {
        // List files in incoming directory
        const files = connection.list({
            directory: incomingFolder,
            sort: sftp.Sort.DATE_DESC
        });

        files.forEach(function(fileInfo) {
            if (!fileInfo.name.endsWith('.csv')) return;
            if (fileInfo.directory) return;

            log.audit({ title: 'Processing File', details: fileInfo.name });

            // Download file
            const downloadedFile = connection.download({
                directory: incomingFolder,
                filename: fileInfo.name
            });

            // Process CSV
            const results = processCsvFile(downloadedFile);

            // Move to processed folder
            connection.move({
                from: incomingFolder + '/' + fileInfo.name,
                to: processedFolder + '/' + fileInfo.name
            });

            log.audit({
                title: 'File Processed',
                details: fileInfo.name + ': ' + JSON.stringify(results)
            });
        });

    } catch (e) {
        log.error({ title: 'SFTP Import Failed', details: e.message });
        throw e;
    }
}

function processCsvFile(csvFile) {
    const contents = csvFile.getContents();
    const lines = contents.split('\n');
    const headers = lines[0].split(',');

    const results = { success: 0, failed: 0, errors: [] };

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
            const values = parseCSVLine(lines[i]);
            const rowData = {};
            headers.forEach(function(header, index) {
                rowData[header.trim()] = values[index];
            });

            processRow(rowData);
            results.success++;

        } catch (e) {
            results.failed++;
            results.errors.push({ line: i, error: e.message });
        }
    }

    return results;
}
```

## Pattern: EDI File Processing

```javascript
/**
 * Process EDI 850 (Purchase Order) files
 */
function processEdi850(connection) {
    const ediFolder = '/edi/850';

    const files = connection.list({
        directory: ediFolder
    });

    files.forEach(function(fileInfo) {
        if (fileInfo.directory) return;

        const ediFile = connection.download({
            directory: ediFolder,
            filename: fileInfo.name
        });

        const contents = ediFile.getContents();
        const segments = contents.split('~');

        // Parse EDI segments
        const order = parseEdi850(segments);

        // Create Sales Order
        const soId = createSalesOrderFromEdi(order);

        // Generate 855 (Acknowledgment)
        const ack = generateEdi855(order, soId);

        // Upload acknowledgment
        const ackFile = file.create({
            name: 'ACK_' + fileInfo.name,
            fileType: file.Type.PLAINTEXT,
            contents: ack
        });

        connection.upload({
            file: ackFile,
            directory: '/edi/855',
            filename: ackFile.name
        });

        // Archive original
        connection.move({
            from: ediFolder + '/' + fileInfo.name,
            to: '/edi/archive/850/' + fileInfo.name
        });
    });
}
```

## Pattern: Scheduled File Sync

```javascript
/**
 * Bidirectional file sync
 */
function execute(context) {
    const scriptObj = runtime.getCurrentScript();
    const connection = createConnection();

    try {
        // Export: NetSuite → SFTP
        if (scriptObj.getParameter({ name: 'custscript_export_enabled' })) {
            exportToSftp(connection);
        }

        // Import: SFTP → NetSuite
        if (scriptObj.getParameter({ name: 'custscript_import_enabled' })) {
            importFromSftp(connection);
        }

    } catch (e) {
        log.error({ title: 'Sync Failed', details: e.message });
        sendAlertEmail(e.message);
        throw e;
    }
}

function exportToSftp(connection) {
    const files = getFilesToExport();

    files.forEach(function(localFile) {
        connection.upload({
            file: localFile,
            directory: '/outbound',
            filename: localFile.name
        });

        markAsExported(localFile.id);
    });
}

function importFromSftp(connection) {
    const files = connection.list({
        directory: '/inbound'
    });

    files.forEach(function(fileInfo) {
        if (fileInfo.directory) return;

        const downloadedFile = connection.download({
            directory: '/inbound',
            filename: fileInfo.name
        });

        processImportedFile(downloadedFile);

        // Move to processed
        connection.move({
            from: '/inbound/' + fileInfo.name,
            to: '/inbound/processed/' + fileInfo.name
        });
    });
}
```

## SFTP Methods Reference

| Method | Description |
|--------|-------------|
| `createConnection()` | Establish SFTP connection |
| `upload(options)` | Upload file to server |
| `download(options)` | Download file from server |
| `list(options)` | List directory contents |
| `move(options)` | Move/rename file on server |
| `makeDirectory(options)` | Create directory |
| `removeDirectory(options)` | Remove directory |
| `removeFile(options)` | Delete file |

## Error Handling

```javascript
function safeSftpOperation(operation) {
    try {
        return operation();
    } catch (e) {
        // Parse SFTP-specific errors
        if (e.name === 'SFTP_CONNECT_ERROR') {
            log.error({ title: 'Connection Failed', details: e.message });
            // Alert ops team
        } else if (e.name === 'SFTP_PERMISSION_DENIED') {
            log.error({ title: 'Permission Denied', details: e.message });
            // Check credentials
        } else if (e.name === 'SFTP_FILE_NOT_FOUND') {
            log.warning({ title: 'File Not Found', details: e.message });
            // May be normal - file already processed
        } else {
            log.error({ title: 'SFTP Error', details: e.message });
        }
        throw e;
    }
}
```

## Best Practices

1. **Store credentials securely** - Use password GUID, not plain text
2. **Always close connections** - Use try/finally pattern
3. **Validate host key** - Prevent MITM attacks
4. **Move files after processing** - Don't reprocess
5. **Log all operations** - Audit trail
6. **Handle encoding** - Be explicit about character encoding
7. **Test with real server** - Mock may miss issues

## See Also

- `../error-handling.md` - Error handling patterns
- `../suitescript/patterns/scheduled.md` - Scheduled script patterns
- `../field-mapping/template.md` - Field mapping for imports
