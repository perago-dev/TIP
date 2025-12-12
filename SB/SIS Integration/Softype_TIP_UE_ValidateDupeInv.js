/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

/***************************************************************************************
 ** Copyright (c) 1998-2025 Softype, Inc.
 ** Ventus Infotech Pvt. Ltd. | 619/620, Rajhans Helix 3 | Above Old Shreyas Cinema | LBS Marg, Ghatkopar West | GhatKopar | Mumbai | India 400 086
 ** All Rights Reserved.
 ** This software is the confidential and proprietary information of Softype, Inc. ("Confidential Information").
 ** You shall not disclose such Confidential Information and shall use it only in accordance with the terms of the license agreement you entered into with Softype.
 **
 ** @Author      :  Atharva Panchal
 ** @Dated       :  11 December, 2025
 ** @Version     :  2.x
 ** @Description :  Validate if an invoice with the same enrollment reference (tranid) already exists and create error catcher record.
 ***************************************************************************************/

define(['N/search', 'N/error', 'N/log', 'N/record', 'N/url'], (search, error, log, record, url) => {

    const beforeSubmit = (context) => {
        const newRecord = context.newRecord;

        // ✅ Run only in CREATE mode
        if (context.type !== context.UserEventType.CREATE) {
            log.debug('Mode Skipped', 'Not in create mode. Validation skipped.');
            return;
        }

        const transactionId = newRecord.getValue({ fieldId: 'tranid' });
        const studentNumber = newRecord.getText({ fieldId: 'entity' }); // Get customer name/number
        const customerId = newRecord.getValue({ fieldId: 'entity' });
        
        log.debug('Transaction ID', transactionId);

        if (!transactionId) {
            const errorMsg = 'Transaction ID is missing. Please provide a valid reference number.';
            log.debug('MISSING_TRANID', errorMsg);
            
            // Create error catcher record for missing tranid
            createErrorCatcher(errorMsg, transactionId, studentNumber, null, null, null, 'invoice');
        }

        // 🔍 Search for an existing invoice with the same tranid
        const invoiceSearch = search.create({
            type: search.Type.INVOICE,
            filters: [
                ['tranid', 'is', transactionId],
                'AND',
                ['mainline', 'is', 'T']
            ],
            columns: ['internalid', 'tranid', 'entity']
        }).run().getRange(0, 1);

        log.debug('Invoice Search Result', invoiceSearch);

        if (invoiceSearch.length > 0) {
            const existingInvoiceId = invoiceSearch[0].getValue('internalid');
            const errorMsg = `An invoice with the reference number "${transactionId}" already exists (ID: ${existingInvoiceId}). Duplicate creation is not allowed.`;
            
            log.debug('DUPLICATE_INVOICE', errorMsg);
            
            // Create error catcher record for duplicate invoice
            try {
                // Get all invoice field values to store in error catcher
                const invoiceData = {
                    tranid: transactionId,
                    customer: studentNumber,
                    customer_id: customerId,
                    existing_invoice_id: existingInvoiceId
                };
                
                createErrorCatcher(
                    errorMsg, 
                    transactionId, 
                    studentNumber, 
                    invoiceData, 
                    null, 
                    null, 
                    'invoice'
                );
            } catch (e) {
                log.error('Error Catcher Creation Failed', e);
            }
            
            // Throw error to prevent invoice creation
            throw error.create({
                name: 'DUPLICATE_INVOICE',
                message: errorMsg
            });
        }

        log.debug('Validation Passed', 'No duplicate invoice found. Invoice creation allowed.');
    };

    /**
     * Create error catcher record
     * @param {string|object} errorMsg - Error message or error object
     * @param {string} refno - Reference number (tranid)
     * @param {string} studentNumber - Student number/name
     * @param {object} jsonData - JSON data to store
     * @param {string} filename - Filename if applicable
     * @param {string} custRecordId - Custom record ID if applicable
     * @param {string} customrecordtype - Custom record type
     */
    function createErrorCatcher(errorMsg, refno, studentNumber, jsonData, filename, custRecordId, customrecordtype) {
        try {
            const errorCatcherObj = record.create({
                type: 'customrecord_tip_integration_error_catch',
                isDynamic: true,
            });

            let errmsg = '';
            
            // Handle error object vs string
            if (typeof errorMsg === 'object' && errorMsg.hasOwnProperty('message')) {
                errmsg = errorMsg.message;
            } else if (typeof errorMsg === 'string') {
                errmsg = errorMsg;
            }

            // Set error message
            if (errmsg) {
                // Check for specific error patterns
                if (errmsg.indexOf("Cannot read property 'value' of undefined") > -1) {
                    errorCatcherObj.setValue({
                        fieldId: 'custrecord_tip_integration_error_msg',
                        value: "Invalid Campus/NetsuiteProgram/year level/SY1/terms description (Value Not available in Netsuite Instance)"
                    });
                } else {
                    errorCatcherObj.setValue({
                        fieldId: 'custrecord_tip_integration_error_msg',
                        value: errmsg.substring(0, 4000) // Limit to field size
                    });
                }
            }

            // Set full error details
            errorCatcherObj.setValue({
                fieldId: 'custrecord_tip_integration_errorfull',
                value: typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg
            });

            // Set transaction ID
            if (refno) {
                errorCatcherObj.setValue({
                    fieldId: 'custrecord_tip_integration_trans_id',
                    value: refno
                });
            }

            // Set custom record URL if available
            if (custRecordId && customrecordtype) {
                try {
                    const outputUrl = url.resolveRecord({
                        recordType: customrecordtype,
                        recordId: custRecordId
                    });
                    errorCatcherObj.setValue({
                        fieldId: 'custrecord_tip_custrecordid_error',
                        value: outputUrl
                    });
                } catch (urlError) {
                    log.error('URL Resolution Failed', urlError);
                }
            }

            // Set JSON data
            if (jsonData) {
                try {
                    const jsonString = typeof jsonData === 'object' ? JSON.stringify(jsonData) : jsonData;
                    errorCatcherObj.setValue({
                        fieldId: 'custrecord_tip_integration_json_data',
                        value: jsonString.substring(0, 4000) // Limit to field size
                    });
                } catch (jsonError) {
                    log.error('JSON Stringify Failed', jsonError);
                }
            }

            // Set filename
            if (filename) {
                errorCatcherObj.setValue({
                    fieldId: 'custrecord_tip_integration_errorfilename',
                    value: filename
                });
            }

            const errorRecordId = errorCatcherObj.save();
            log.audit('Error Catcher Record Created', `Record ID: ${errorRecordId} for tranid: ${refno}`);
            
            return errorRecordId;

        } catch (e) {
            log.error('createErrorCatcher Failed', {
                error: e.toString(),
                refno: refno,
                studentNumber: studentNumber
            });
            // Don't throw - we don't want error catcher creation to prevent the main error from being logged
        }
    }

    return { beforeSubmit };
});