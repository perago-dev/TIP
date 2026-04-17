# TIP - NetSuite Integration Scripts

This repository contains NetSuite SuiteScript 2.x integration scripts for the TIP (Tuition Integration Platform) system.

## Repository Structure

```
TIP/
├── Production/          # Production environment scripts
│   ├── ClientScript/    # Client-side validation scripts
│   ├── MapReduce/       # Batch processing scripts
│   ├── UserEvent/       # Server-side event handlers
│   ├── Restlet/         # RESTful API endpoints
│   └── Other/          # Miscellaneous scripts
│
└── Sandbox/            # Sandbox/testing environment scripts
    ├── ClientScript/    # Client-side validation scripts
    ├── MapReduce/       # Batch processing scripts
    ├── UserEvent/       # Server-side event handlers
    ├── Restlet/         # RESTful API endpoints
    └── Other/          # Miscellaneous scripts
```

## Script Types

### MapReduce Scripts (MR)
MapReduce scripts handle large-scale batch processing operations.

**Location:** `Production/MapReduce/` or `Sandbox/MapReduce/`

**Scripts:**
- `Softype_MR_creditmemo_debitmemo_enrollwithdrawal.js`
  - Processes credit memos, debit memos, and enrollment withdrawals
  - Reads JSON files from custom records
  - Creates NetSuite transaction records (credit memos/invoices)
  - Implements duplicate prevention
  - Handles error logging

- `Softype_MR_Tutbill_Terms_Fullscholar_ChangeinEnroll.js`
  - Processes tuition bills, terms, full scholarships, and enrollment changes

### Client Scripts (CS)
Client scripts run in the user's browser and provide real-time validation.

**Location:** `Production/ClientScript/` or `Sandbox/ClientScript/`

**Scripts:**
- `Softype_TIP_CS_ValidateDupeInv.js`
  - Validates duplicate invoices before save
  - Checks if invoice with same transaction ID already exists
  - Prevents creation of duplicate records

### User Event Scripts (UE)
User Event scripts execute on the server before or after record operations.

**Location:** `Production/UserEvent/` or `Sandbox/UserEvent/`

**Scripts:**
- `Softype_TIP_UE_ValidateDupeInv.js`
  - Server-side duplicate validation for invoices

### Restlet Scripts (RL)
Restlet scripts provide RESTful API endpoints for external integrations.

**Location:** `Production/Restlet/` or `Sandbox/Restlet/`

**Scripts:**
- `softype_rl_creditmemo_integration.js`
  - RESTful API endpoint for credit memo integration

### Other Scripts
Scripts that don't fit into standard categories.

**Location:** `Production/Other/` or `Sandbox/Other/`

**Scripts:**
- `Softype_payment_nonstud_reservation_.js`
  - Handles payments for non-student reservations

## Key Features

### Duplicate Prevention
- Credit memos and invoices are checked for duplicate `tranid` values
- Validation occurs both client-side and server-side
- Custom error records are created for tracking failures

### JSON File Processing
- Integration scripts read JSON files attached to custom records
- Processes student information, billing details, and course information
- Transforms JSON data into NetSuite transaction records

### Custom Record Types
- `customrecord_tip_creditmemo_integration` - Credit memo requests
- `customrecord_tip_debitmemo_integration` - Debit memo requests
- `customrecord_tip_tutbill_enroll_withdraw` - Enrollment withdrawal requests
- `customrecord_tip_integration_error_catch` - Error logging

### Auto-Apply Feature
- Credit memos automatically apply to open invoices
- Debit memo invoices automatically apply customer payments
- Installment-based payment allocation

## Development Guidelines

### Adding New Scripts

1. **Determine the script type:**
   - MapReduce for batch processing
   - Client Script for browser validation
   - User Event for server-side triggers
   - Restlet for API endpoints

2. **Choose the environment:**
   - Develop and test in `Sandbox/` first
   - Promote to `Production/` after testing

3. **Naming Convention:**
   - Format: `Softype_[TYPE]_[Description].js`
   - Examples:
     - `Softype_MR_ProcessPayments.js`
     - `Softype_CS_ValidateStudent.js`
     - `Softype_UE_UpdateRecord.js`
     - `Softype_RL_StudentAPI.js`

4. **Place in correct folder:**
   ```
   Sandbox/[ScriptType]/Softype_[TYPE]_[Description].js
   ```

### Testing Process

1. Deploy script to Sandbox environment
2. Test with sample data
3. Verify error handling
4. Check duplicate prevention
5. Review logs in NetSuite
6. Once validated, copy to Production folder

### Version Control

- Always commit changes with descriptive messages
- Use branch naming: `TIP-[TICKET]-[description]`
- Test in Sandbox before merging to main branch
- Tag production releases

## Error Handling

All integration scripts create error records when issues occur:

- **Record Type:** `customrecord_tip_integration_error_catch`
- **Fields:**
  - Error message
  - Transaction ID (refno)
  - JSON data
  - Filename
  - Custom record reference

## Common Operations

### Deploying to NetSuite

1. Navigate to Customization > Scripting > Scripts > New
2. Upload the script file from appropriate folder
3. Configure script deployment settings
4. Set appropriate roles and permissions
5. Deploy to correct environment

### Monitoring Integration

1. Check custom error records for failures
2. Review NetSuite script execution logs
3. Monitor custom record processing status
4. Verify transaction creation

## Contact & Support

**Developer:** Softype, Inc. / Ventus Infotech Pvt. Ltd.

**Copyright:** © 1998-2025 Softype, Inc.

For issues or questions, please create a ticket in your project management system.

## Recent Updates

- **April 2026:** Added duplicate prevention for credit memos
- **December 2025:** Added duplicate prevention for invoices
- Implemented custom record references for JSON file tracking
- Enhanced error handling and logging

---

**Note:** This repository contains proprietary and confidential information. Do not disclose or share outside authorized personnel.
