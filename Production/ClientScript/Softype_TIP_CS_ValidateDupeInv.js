/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */

/***************************************************************************************
 ** Copyright (c) 1998-2025 Softype, Inc.
 ** Ventus Infotech Pvt. Ltd. | 619/620, Rajhans Helix 3 | Above Old Shreyas Cinema | LBS Marg, Ghatkopar West | GhatKopar | Mumbai | India 400 086
 ** All Rights Reserved.
 ** This software is the confidential and proprietary information of Softype, Inc. ("Confidential Information").
 **You shall not disclose such Confidential Information and shall use it only in accordance with the terms of the license agreement you entered into with Softype.
 **
 **@Author      :  Atharva Panchal
 **@Dated       :  11 December, 2025
 **@Version     :  2.x
 **@Description :  Validate if the invoice with same enrollment ref already exists, if yes script won't proceed
 ***************************************************************************************/

define(['N/search'], (search) => {
    
    const saveRecord = (scriptContext) => {
        const currentRec = scriptContext.currentRecord;
        const recordId = currentRec.id;

        // Run only in create mode
        if (recordId) {
            console.log('Record already exists, skipping duplicate validation.');
            return true;
        }

        const transactionId = currentRec.getValue({ fieldId: 'tranid' });
        console.log('Transaction ID:', transactionId);

        if (!transactionId) {
            alert('Transaction ID is missing.');
            return false;
        }

        const invoiceSearch = search.create({
            type: search.Type.INVOICE,
            filters: [['tranid', 'is', transactionId]],
        }).run().getRange(0, 1);

        console.log('Invoice Search Result:', invoiceSearch);

        if (invoiceSearch.length > 0) {
            alert(`An invoice with the reference ${transactionId} already exists.`);
            return false; 
        }

        return true; 
    };

    return { saveRecord };
});
