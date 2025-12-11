/**
@NApiVersion 2.1
@NScriptType MapReduceScript
*/
/***************************************************************************************  
 ** Copyright (c) 1998-2018 Softype, Inc.
 ** Ventus Infotech Private Limited, Raheja Plaza One, Suite A201, LBS Marg, Ghatkopar West, Near R City Mall, Mumbai INDIA 400086.
 ** All Rights Reserved.
 ** This software is the confidential and proprietary information of Softype, Inc. ("Confidential Information").
 **You shall not disclose such Confidential Information and shall use it only in accordance with the terms of the license agreement you entered into with Softype.                    
 **                      
 **@Author      :  Akash Chavan
 **@Dated       :  06 Feb 2023	
 **@Version     :  2.x
 **@Description :  fetch the custom record,Get all Credit memo,debit memo,enrollment withdrawal JSON and create a creditmemo,invoice record
 **@Updates     :  
 ***************************************************************************************/

define(['N/record', 'N/search', 'N/log', 'N/file', 'N/runtime', 'N/url'], function (record, search, log, file, runtime, url) {



    function getInputData(context) {


        try {
            var data = [];
            var getJSONData = searchUnprocessedRequests();

            var jsonfilename = "";

            log.debug("getJSONDataCreditmemo", getJSONData)
            if (getJSONData.length > 0) {
                for (var i = 0; i < getJSONData.length; i++) {
                    var custRecordId = getJSONData[i];
                    data.push(
                        {
                            "custRecordId": custRecordId,
                            "recordtype": 'creditmemo',
                            "customrecordtype": "customrecord_tip_creditmemo_integration"
                        }
                    );
                }
            }

            var getJSONDataEnrolWithdraw = searchUnprocessedEnrollWithdrawalRequests();


            log.debug("getJSONDataEnrolWithdraw", getJSONDataEnrolWithdraw)
            if (getJSONDataEnrolWithdraw.length > 0) {
                for (var i = 0; i < getJSONDataEnrolWithdraw.length; i++) {
                    var custRecordId = getJSONDataEnrolWithdraw[i];
                    data.push(
                        {
                            "custRecordId": custRecordId,
                            "recordtype": 'enrollwithdrawal',
                            "customrecordtype": "customrecord_tip_tutbill_enroll_withdraw"
                        }
                    );
                }
            }

            if (data.length > 0) {
                return data;
            }
        }
        catch (e) {
            createError('Invalid JSON' + ' ' + e, "", "", "", jsonfilename);
        }
    }



    function map(context) {

        log.debug("contextmap", context);
        var jsondata = JSON.parse(context.value);
        log.debug("jsondata", jsondata);
        var custRecordId = jsondata.custRecordId;
        var recordtype = jsondata.recordtype;
        var customrecordtype = jsondata.customrecordtype;
        log.debug("recordtype", recordtype);
        log.debug("custRecordId", custRecordId);
        var lookup = search.lookupFields({
            type: customrecordtype,
            id: custRecordId,
            columns: ['file.name', 'file.internalid']
        });
        log.debug("lookup", lookup);

        var filename = lookup['file.name'];
        var jsonfilename = filename;
        var fileID = lookup['file.internalid'][0].text;
        var fileObj = file.load({
            id: fileID
        });


        var resultData = JSON.parse(fileObj.getContents());

        if (customrecordtype == "customrecord_tip_creditmemo_integration") {
            record.submitFields({
                type: customrecordtype,
                id: custRecordId,
                values: {
                    "custrecord_tip_creditmemo_processed": true
                }
            });
        }
        else if (customrecordtype == "customrecord_tip_tutbill_enroll_withdraw") {
            record.submitFields({
                type: customrecordtype,
                id: custRecordId,
                values: {
                    "custrecord_tutbill_enroll_withdraw": true
                }
            });

        }
        else {
            record.submitFields({
                type: customrecordtype,
                id: custRecordId,
                values: {
                    "custrecord_tip_debitmemo_processed": true
                }
            });

        }

        log.debug("resultData", resultData);

        if (recordtype == "debitmemo") {
            if (Array.isArray(resultData)) {
                // log.debug("resultData", resultData);
                for (var k = 0; k < resultData.length; k++) {
                    var memoData = resultData[k];
                    log.debug("tutionBillData", memoData.debit_memo);
                    context.write({
                        key: jsonfilename + "_" + k + Math.floor((Math.random() * 100000000) + 1) + Math.floor((Math.random() * 100000000) + 1),
                        value: {
                            "custRecordId": custRecordId,
                            "creditmemoData": memoData.debit_memo,
                            "recordtype": recordtype,
                            'filename': jsonfilename,
                            'customrecordtype': customrecordtype
                        }
                    });
                }
            }
            else {
                var memoData = resultData;
                log.debug("tutionBillData", memoData.debit_memo);

                context.write({
                    key: jsonfilename + "_1" + Math.floor((Math.random() * 100000000) + 1) + Math.floor((Math.random() * 100000000) + 1),
                    value: {
                        "custRecordId": custRecordId,
                        "creditmemoData": memoData.debit_memo,
                        "recordtype": recordtype,
                        'filename': jsonfilename,
                        'customrecordtype': customrecordtype
                    }
                });
            }
        }
        else if (recordtype == "creditmemo") {

            if (Array.isArray(resultData)) {
                // log.debug("resultData", resultData);
                for (var k = 0; k < resultData.length; k++) {
                    var memoData = resultData[k];
                    log.debug("tutionBillData", memoData.credit_memo);
                    context.write({
                        key: jsonfilename + "_" + k + Math.floor((Math.random() * 100000000) + 1) + Math.floor((Math.random() * 100000000) + 1),
                        value: {
                            "custRecordId": custRecordId,
                            "creditmemoData": memoData.credit_memo,
                            "recordtype": recordtype,
                            'filename': jsonfilename,
                            'customrecordtype': customrecordtype
                        }
                    });
                }
            }
            else {
                var memoData = resultData;
                log.debug("tutionBillData", memoData.credit_memo);

                context.write({
                    key: jsonfilename + "_1" + Math.floor((Math.random() * 100000000) + 1) + Math.floor((Math.random() * 100000000) + 1),
                    value: {
                        "custRecordId": custRecordId,
                        "creditmemoData": memoData.credit_memo,
                        "recordtype": recordtype,
                        'filename': jsonfilename,
                        'customrecordtype': customrecordtype
                    }
                });
            }

        }
        else {
            if (Array.isArray(resultData)) {
                // log.debug("resultData", resultData);
                for (var k = 0; k < resultData.length; k++) {
                    var memoData = resultData[k];
                    log.debug("tutionBillData", memoData.student_info);
                    context.write({
                        key: jsonfilename + "_" + k + Math.floor((Math.random() * 100000000) + 1) + Math.floor((Math.random() * 100000000) + 1),
                        value: {
                            "custRecordId": custRecordId,
                            "creditmemoData": memoData.student_info,
                            "recordtype": recordtype,
                            'filename': jsonfilename,
                            'customrecordtype': customrecordtype
                        }
                    });
                }
            }
            else {
                var memoData = resultData;
                log.debug("tutionBillData", memoData.student_info);

                context.write({
                    key: jsonfilename + "_1" + Math.floor((Math.random() * 100000000) + 1) + Math.floor((Math.random() * 100000000) + 1),
                    value: {
                        "custRecordId": custRecordId,
                        "creditmemoData": memoData.student_info,
                        "recordtype": recordtype,
                        'filename': jsonfilename,
                        'customrecordtype': customrecordtype
                    }
                });
            }
        }
    }

    function reduce(context) {

        try {
            log.debug("context.key", context.key)
            log.debug("context.Value", context)
            log.debug("context.Value", context.values)

            var jsonlength = context.values;
            log.debug("jsonLength", jsonlength);
            for (var g = 0; g < jsonlength.length; g++) {
                var jsondata = JSON.parse(context.values[g]);

                var data = jsondata.creditmemoData;
                var custRecordId = jsondata.custRecordId;
                var customrecordtype = jsondata.customrecordtype;
                var recordtype = jsondata.recordtype;
                var filename = jsondata.filename;
                log.audit('Data in Map', data);

                if (recordtype == "enrollwithdrawal") {
                    var getRefNo = data.enr_refno;
                }
                else {
                    var getRefNo = data.refno;
                }
                log.debug('Get ID', getRefNo);

                log.debug("recordtype", recordtype);
                var existinggetRefNoSearchResult;
                if (recordtype == "creditmemo" || recordtype == "enrollwithdrawal") {
                    existinggetRefNoSearchResult = searchExistingCreditMemo(getRefNo);
                }
                else {
                    existinggetRefNoSearchResult = searchExistingDebitMemo(getRefNo);
                }
                log.debug('Existing Transaction found==>', JSON.stringify(existinggetRefNoSearchResult));

                if (existinggetRefNoSearchResult.length > 0) {
                    var existingCreditMemoID = existinggetRefNoSearchResult[0].getValue('internalid');
                    createError("Record Already existing", getRefNo, "", "", filename, custRecordId, customrecordtype);
                    log.error('Existing Transaction ID', existingCreditMemoID);
                    // }
                }

                if (existinggetRefNoSearchResult.length == 0) {
                    var createCreditMemoRec = createCreditMemoRecord(data, recordtype, filename, custRecordId, customrecordtype);
                    log.debug('Record Created', createCreditMemoRec);
                }
            }
        } catch (e) {
            log.debug("error reduce", e);
        }
    }

    function searchExistingDebitMemo(getRefID) {

        var searchFilter = [];
        var searchColumns = [];

        searchFilter.push(search.createFilter({
            name: 'mainline',
            operator: search.Operator.IS,
            values: true
        }));

        searchFilter.push(search.createFilter({
            name: 'numbertext',
            operator: search.Operator.IS,
            values: getRefID
        }));

        searchFilter.push(search.createFilter({
            name: 'type',
            operator: search.Operator.ANYOF,
            values: 'CustInvc'
        }));

        searchColumns.push(search.createColumn({
            name: 'internalid'
        }));

        log.audit('Search Result');

        var Results = search.create({
            type: 'invoice',
            filters: searchFilter,
            columns: searchColumns
        }).run().getRange(0, 1000);

        log.audit('Search Result', Results);
        log.audit('Search Length', Results.length);
        return Results;
    }

    function searchUnprocessedDebitMemoRequests() {

        var recordIds = [];
        var startIndex = 0;

        do {
            var searchFilter = [];
            var searchColumns = [];

            searchFilter.push(search.createFilter({
                name: 'isinactive',
                operator: search.Operator.IS,
                values: false
            }));

            searchFilter.push(search.createFilter({
                name: 'custrecord_tip_debitmemo_processed',
                operator: search.Operator.IS,
                values: false
            }));

            searchColumns.push(search.createColumn({
                name: 'internalid'
            }));

            var result = search.create({
                type: 'customrecord_tip_debitmemo_integration',
                filters: searchFilter,
                columns: searchColumns
            }).run().getRange({ start: startIndex, end: startIndex + 1000 });

            log.debug("results", result)
            for (var i = 0; i < result.length; i++) {
                var custom_id = result[i].getValue("internalid");
                recordIds.push(custom_id);
            }
            startIndex += 1000;
        } while (result.length >= 1000);

        return recordIds;

    }

    function searchUnprocessedEnrollWithdrawalRequests() {

        var recordIds = [];
        var startIndex = 0;

        //To search data if more than 1000
        do {
            var searchTutionBillFilter = [];
            var searchTutionBillColumns = [];

            searchTutionBillFilter.push(search.createFilter({
                name: 'isinactive',
                operator: search.Operator.IS,
                values: false
            }));

            searchTutionBillFilter.push(search.createFilter({
                name: 'custrecord_tutbill_enroll_withdraw',
                operator: search.Operator.IS,
                values: false
            }));

            searchTutionBillColumns.push(search.createColumn({
                name: 'internalid'
            }));

            var result = search.create({
                type: 'customrecord_tip_tutbill_enroll_withdraw',
                filters: searchTutionBillFilter,
                columns: searchTutionBillColumns
            }).run().getRange({ start: startIndex, end: startIndex + 1000 });

            log.debug("results", result)
            for (var i = 0; i < result.length; i++) {
                var custom_id = result[i].getValue("internalid");
                recordIds.push(custom_id);
            }
            startIndex += 1000;
        } while (result.length >= 1000);

        return recordIds;

    }


    function searchExistingCreditMemo(getRefID) {

        var searchCreditFilter = [];
        var searchCreditColumns = [];

        searchCreditFilter.push(search.createFilter({
            name: 'mainline',
            operator: search.Operator.IS,
            values: true
        }));

        searchCreditFilter.push(search.createFilter({
            name: 'numbertext',
            operator: search.Operator.IS,
            values: getRefID
        }));

        searchCreditFilter.push(search.createFilter({
            name: 'type',
            operator: search.Operator.ANYOF,
            values: 'CustCred'
        }));

        searchCreditColumns.push(search.createColumn({
            name: 'internalid'
        }));

        log.audit('Search Result');

        var creditResults = search.create({
            type: 'creditmemo',
            filters: searchCreditFilter,
            columns: searchCreditColumns
        }).run().getRange(0, 10);

        log.audit('Search Result after');
        log.audit('Search Result', creditResults);
        log.audit('Search Length', creditResults.length);
        return creditResults;
    }

    function createCreditMemoRecord(jsonData, recordtype, filename, custRecordId, customrecordtype) {

        try {
            var auto_pay = true;
            if (recordtype == "enrollwithdrawal") {
                var refno = jsonData.enr_refno;
            }
            else {
                var refno = jsonData.refno;
            }

            var myEnvType = runtime.envType;
            var campus = jsonData.campus;
            var student_number = jsonData.student_number;
            var program_id = jsonData.program_id;
            var program = jsonData.program;
            var program_long = jsonData.program_long;
            var curr_year = jsonData.curr_year;
            var batchcode = jsonData.batchcode;
            var year_level = jsonData.year_level;
            var year_level_desc = jsonData.year_level_desc;
            var student_type = jsonData.student_type;
            var student_type_desc = jsonData.student_type_desc;
            var sy1 = jsonData.sy1;
            var sem = jsonData.sem;
            var sy_sem = jsonData.sy_sem;

            var refdate;
            var type;
            var reason;
            var created_by;
            var approved_by;
            var cancelled_by;
            var date_cancelled;
            var status;
            var for_refund;


            var netsuite_program = jsonData.netsuite_program;
            var detail = [];
            var application = [];
            var course = [];
            var terms = [];

            var school_year;
            var refund_amount;
            var sch_approval_code;
            var term_description;



            if (jsonData.hasOwnProperty('terms')) {
                terms = jsonData.terms;
            }

            if (jsonData.hasOwnProperty('school_year')) {
                school_year = jsonData.school_year;
            }

            if (jsonData.hasOwnProperty('refund_amount')) {
                refund_amount = jsonData.refund_amount;
            }

            if (jsonData.hasOwnProperty('term_description')) {
                term_description = jsonData.term_description;
            }

            if (jsonData.hasOwnProperty('sch_approval_code')) {
                sch_approval_code = jsonData.sch_approval_code;
            }

            if (jsonData.hasOwnProperty('course')) {
                course = jsonData.course;
            }
            if (jsonData.hasOwnProperty('detail')) {
                detail = jsonData.detail;
            }
            if (jsonData.hasOwnProperty('bill')) {
                detail = jsonData.bill;
            }
            if (jsonData.hasOwnProperty('application')) {
                application = jsonData.application;
            }
            if (jsonData.hasOwnProperty('reason')) {
                reason = jsonData.reason;
            }
            if (jsonData.hasOwnProperty('created_by')) {
                created_by = jsonData.created_by;
            }
            if (jsonData.hasOwnProperty('approved_by')) {
                approved_by = jsonData.approved_by;
            }
            if (jsonData.hasOwnProperty('cancelled_by')) {
                cancelled_by = jsonData.cancelled_by;
            }
            if (jsonData.hasOwnProperty('date_cancelled')) {
                date_cancelled = jsonData.date_cancelled;
            }
            if (jsonData.hasOwnProperty('status')) {
                status = jsonData.status;
            }
            if (jsonData.hasOwnProperty('enr_refdate')) {
                refdate = jsonData.enr_refdate;
            }
            if (jsonData.hasOwnProperty('refdate')) {
                refdate = jsonData.refdate;
            }
            if (jsonData.hasOwnProperty('enr_type')) {
                type = jsonData.enr_type;
            }
            if (jsonData.hasOwnProperty('type')) {
                type = jsonData.type;
            }
            if (jsonData.hasOwnProperty('enr_refdate')) {
                refdate = jsonData.enr_refdate;
            }
            if (jsonData.hasOwnProperty('refdate')) {
                refdate = jsonData.refdate;
            }
            if (jsonData.hasOwnProperty('enr_type')) {
                type = jsonData.enr_type;
            }
            if (jsonData.hasOwnProperty('type')) {
                type = jsonData.type;
            }
            if (jsonData.hasOwnProperty('for_refund')) {
                for_refund = jsonData.for_refund;
            }



            var item_present = true;

            log.debug("detail", detail);
            // var customform = "118";

            var entityId = searchExistingStudents(student_number);

            if (entityId.length <= 0) {
                createError("entity is not available/Invalid", refno, student_number, jsonData, filename, custRecordId, customrecordtype)
            }
            else {
                log.debug("entityId", entityId);
                var intid = entityId[0].getValue("internalid");
                log.debug("entityId", intid)

                if (recordtype == "creditmemo" || recordtype == "enrollwithdrawal") {
                    var newRecord = record.create({
                        type: 'creditmemo',
                        isDynamic: true
                    });

                    log.debug("myEnvType", myEnvType)

                    newRecord.setValue({
                        fieldId: 'customform',
                        value: '124'
                    });

                }
                else {
                    var newRecord = record.create({
                        type: 'invoice',
                        isDynamic: true
                    });


                    newRecord.setValue({
                        fieldId: 'customform',
                        value: '123'
                    });


                }



                if (entityId != '' && entityId != null && entityId != undefined) {
                    newRecord.setValue({
                        fieldId: 'entity',
                        value: intid
                    });
                }

                if (campus != '' && campus != null && campus != undefined) {

                    var objField = newRecord.getField({ fieldId: 'location' });
                    var options = objField.getSelectOptions({
                        filter: campus,
                        operator: 'is'
                    });

                    log.debug("options", options);
                    log.debug("options[0].value", options[0].value);
                    newRecord.setValue({
                        fieldId: 'location',
                        value: options[0].value
                    });
                }

                if (program_id != '' && program_id != null && program_id != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_progid',
                        value: program_id
                    });
                }

                if (netsuite_program != '' && netsuite_program != null && netsuite_program != undefined) {

                    var objField = newRecord.getField({ fieldId: 'department' });
                    var options = objField.getSelectOptions({
                        filter: netsuite_program,
                        operator: 'is'
                    });
                    log.debug("options", options);
                    log.debug("options[0].value", options[0].value);

                    newRecord.setValue({
                        fieldId: 'department',
                        value: options[0].value
                    });
                }

                if (program_long != '' && program_long != null && program_long != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_progdesc',
                        value: program_long
                    });
                }

                if (batchcode != '' && batchcode != null && batchcode != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_batchcode',
                        value: batchcode
                    });
                }

                if (curr_year != '' && curr_year != null && curr_year != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_curryear',
                        value: curr_year
                    });
                }

                if (year_level != '' && year_level != null && year_level != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_yrlevel',
                        value: year_level
                    });
                }

                if (refund_amount != '' && refund_amount != null && refund_amount != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_for_refundamt',
                        value: refund_amount
                    });
                }

                if (sch_approval_code != '' && sch_approval_code != null && sch_approval_code != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_for_schaprcode',
                        value: sch_approval_code
                    });
                }

                if (year_level_desc != '' && year_level_desc != null && year_level_desc != undefined) {
                    var objField = newRecord.getField({ fieldId: 'class' });
                    var options = objField.getSelectOptions({
                        filter: year_level_desc,
                        operator: 'is'
                    });
                    log.debug("options", options);
                    log.debug("options[0].value", options[0].value);

                    newRecord.setValue({
                        fieldId: 'class',
                        value: options[0].value
                    });
                }

                if (student_type != '' && student_type != null && student_type != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_studentype',
                        value: student_type
                    });
                }

                if (student_type_desc != '' && student_type_desc != null && student_type_desc != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_studentypedesc',
                        value: student_type_desc
                    });
                }

                if (recordtype == "debitmemo") {
                    if (term_description != '' && term_description != null && term_description != undefined) {

                        var objField = newRecord.getField({ fieldId: 'terms' });
                        var options = objField.getSelectOptions({
                            filter: term_description,
                            operator: 'is'
                        });

                        log.debug("options terms", options);
                        log.debug("options[0].value terms", options[0].value);
                        newRecord.setValue({
                            fieldId: 'terms',
                            value: options[0].value
                        });
                    }
                }

                if (school_year != '' && school_year != null && school_year != undefined) {

                    var objField = newRecord.getField({ fieldId: "cseg__tip_sycseg" });
                    var options = objField.getSelectOptions({
                        filter: school_year,
                        operator: "is",
                    });
                    log.debug("options school_year", options);
                    log.debug("options[0].value school_year", options[0].value);

                    newRecord.setValue({
                        fieldId: "cseg__tip_sycseg",
                        value: options[0].value,
                    });

                }

                if (sy_sem != '' && sy_sem != null && sy_sem != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_syandsem',
                        value: sy_sem
                    });
                }

                if (refdate != '' && refdate != null && refdate != undefined) {
                    newRecord.setValue({
                        fieldId: 'trandate',
                        value: new Date(refdate)
                    });
                }

                if (refno != '' && refno != null && refno != undefined) {
                    newRecord.setValue({
                        fieldId: 'tranid',
                        value: refno
                    });
                }


                if (for_refund != '' && for_refund != null && for_refund != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_for_refund',
                        value: for_refund
                    });
                }

                if (type != '' && type != null && type != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_type',
                        value: type
                    });
                }

                if (reason != '' && reason != null && reason != undefined) {
                    newRecord.setValue({
                        fieldId: 'memo',
                        value: reason
                    });
                }

                if (created_by != '' && created_by != null && created_by != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_createdby',
                        value: created_by
                    });
                }

                if (approved_by != '' && approved_by != null && approved_by != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_approvedby',
                        value: approved_by
                    });
                }

                if (cancelled_by != '' && cancelled_by != null && cancelled_by != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_cancelledby',
                        value: cancelled_by
                    });
                }

                if (date_cancelled != '' && date_cancelled != null && date_cancelled != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_datecancelled',
                        value: new Date(date_cancelled)
                    });
                }

                if (sem != '' && sem != null && sem != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_softype_sis_acadterm',
                        value: sem
                    });
                }



                log.audit(' detail', detail);
                log.audit(' detail', detail.length);
                if (detail.length > 0) {
                    for (var i = 0; i < detail.length; i++) {
                        if (item_present) {

                            if (recordtype == "enrollwithdrawal") {
                                var balance = detail[i].balance;
                                balance = balance.replace(",", "");

                                balance = balance * -1

                                var acct_code = detail[i].acct_code

                                log.audit('acct_code', acct_code);
                                log.audit(' balance', balance);
                                var searchFilter = [];
                                var searchColumns = [];

                                searchFilter.push(search.createFilter({
                                    name: 'isinactive',
                                    operator: search.Operator.IS,
                                    values: false
                                }));

                                searchFilter.push(search.createFilter({
                                    name: 'itemid',
                                    operator: search.Operator.IS,
                                    values: acct_code
                                }));

                                searchColumns.push(search.createColumn({
                                    name: 'internalid'
                                }));

                                var Results = search.create({
                                    type: search.Type.ITEM,
                                    filters: searchFilter,
                                    columns: searchColumns
                                }).run().getRange(0, 1000);
                                log.audit('Search Result', Results);
                                log.audit('Search Length', Results.length);



                                if (Results.length > 0) {
                                    newRecord.selectNewLine('item');
                                    newRecord.setCurrentSublistValue('item', 'item', Results[0].getValue("internalid"));
                                    newRecord.setCurrentSublistValue('item', 'quantity', 1);
                                    newRecord.setCurrentSublistValue('item', 'amount', balance);
                                    newRecord.setCurrentSublistValue('item', 'grossamt', balance);
                                    newRecord.setCurrentSublistValue('item', 'taxcode', 5);
                                    newRecord.commitLine('item');
                                }
                                else {
                                    item_present = false;
                                    createError(acct_code + " " + "Item is Invalid/Not found in netsuite instance", refno, student_number, jsonData, filename, custRecordId, customrecordtype);
                                }
                            }
                            else {
                                var acct_code = detail[i].acct_code
                                if (recordtype == "creditmemo") {
                                    var balance = detail[i].balance;
                                    balance = balance.replace(",", "");
                                    balance = balance * -1
                                }
                                else {
                                    var balance = detail[i].balance;
                                    balance = balance.replace(",", "");
                                }

                                log.audit('acct_code', acct_code);
                                log.audit(' balance', balance);
                                var searchFilter = [];
                                var searchColumns = [];

                                searchFilter.push(search.createFilter({
                                    name: 'isinactive',
                                    operator: search.Operator.IS,
                                    values: false
                                }));

                                searchFilter.push(search.createFilter({
                                    name: 'itemid',
                                    operator: search.Operator.IS,
                                    values: acct_code
                                }));

                                searchColumns.push(search.createColumn({
                                    name: 'internalid'
                                }));

                                var Results = search.create({
                                    type: search.Type.ITEM,
                                    filters: searchFilter,
                                    columns: searchColumns
                                }).run().getRange(0, 1000);
                                log.audit('Search Result', Results);
                                log.audit('Search Length', Results.length);

                                if (Results.length > 0) {
                                    newRecord.selectNewLine('item');
                                    newRecord.setCurrentSublistValue('item', 'item', Results[0].getValue("internalid"));
                                    newRecord.setCurrentSublistValue('item', 'quantity', 1);
                                    newRecord.setCurrentSublistValue('item', 'amount', balance);
                                    newRecord.setCurrentSublistValue('item', 'grossamt', balance);
                                    newRecord.setCurrentSublistValue('item', 'taxcode', 5);
                                    newRecord.commitLine('item');
                                }
                                else {
                                    item_present = false;
                                    createError(acct_code + " " + "Item is Invalid/Not found in netsuite instance", refno, student_number, jsonData, filename, custRecordId, customrecordtype);
                                }
                            }
                        }

                    }
                }

                log.debug("processed to course");
                if (item_present) {
                    if (course.length > 0) {
                        for (var i = 0; i < course.length; i++) {
                            if (item_present) {

                                if (recordtype == "enrollwithdrawal") {
                                    var acct_code = course[i].sec_code
                                    var balance = course[i].amount;
                                    balance = balance.replace(",", "");

                                    balance = balance * -1

                                    log.audit('acct_code', acct_code);
                                    log.audit('acct_code', acct_code);
                                    log.audit(' balance', balance);
                                    var searchFilter = [];
                                    var searchColumns = [];

                                    searchFilter.push(search.createFilter({
                                        name: 'isinactive',
                                        operator: search.Operator.IS,
                                        values: false
                                    }));

                                    searchFilter.push(search.createFilter({
                                        name: 'itemid',
                                        operator: search.Operator.IS,
                                        values: acct_code
                                    }));

                                    searchColumns.push(search.createColumn({
                                        name: 'internalid'
                                    }));

                                    var Results = search.create({
                                        type: search.Type.ITEM,
                                        filters: searchFilter,
                                        columns: searchColumns
                                    }).run().getRange(0, 1000);
                                    log.audit('Search Result', Results);
                                    log.audit('Search Length', Results.length);

                                    if (Results.length > 0) {

                                        newRecord.selectNewLine('item');
                                        newRecord.setCurrentSublistValue('item', 'item', Results[0].getValue("internalid"));
                                        newRecord.setCurrentSublistValue('item', 'quantity', 1);
                                        newRecord.setCurrentSublistValue('item', 'amount', balance);
                                        newRecord.setCurrentSublistValue('item', 'grossamt', balance);
                                        newRecord.setCurrentSublistValue('item', 'taxcode', 5);
                                        newRecord.commitLine('item');
                                    }
                                    else {
                                        item_present = false;
                                        createError(acct_code + " " + "Item is Invalid/Not Available in netsuite instance", refno, student_number, jsonData, filename, custRecordId, customrecordtype);
                                    }
                                }
                                else {
                                    var acct_code = course[i].sec_code
                                    if (recordtype == "creditmemo") {
                                        var balance = course[i].amount;
                                        balance = balance.replace(",", "");
                                        balance = balance * -1
                                    }
                                    else {
                                        var balance = course[i].amount;
                                        balance = balance.replace(",", "");
                                    }

                                    log.audit('acct_code', acct_code);
                                    log.audit('acct_code', acct_code);
                                    log.audit(' balance', balance);
                                    var searchFilter = [];
                                    var searchColumns = [];

                                    searchFilter.push(search.createFilter({
                                        name: 'isinactive',
                                        operator: search.Operator.IS,
                                        values: false
                                    }));

                                    searchFilter.push(search.createFilter({
                                        name: 'itemid',
                                        operator: search.Operator.IS,
                                        values: acct_code
                                    }));

                                    searchColumns.push(search.createColumn({
                                        name: 'internalid'
                                    }));

                                    var Results = search.create({
                                        type: search.Type.ITEM,
                                        filters: searchFilter,
                                        columns: searchColumns
                                    }).run().getRange(0, 1000);
                                    log.audit('Search Result', Results);
                                    log.audit('Search Length', Results.length);

                                    if (Results.length > 0) {

                                        newRecord.selectNewLine('item');
                                        newRecord.setCurrentSublistValue('item', 'item', Results[0].getValue("internalid"));
                                        newRecord.setCurrentSublistValue('item', 'quantity', 1);
                                        newRecord.setCurrentSublistValue('item', 'amount', balance);
                                        newRecord.setCurrentSublistValue('item', 'grossamt', balance);
                                        newRecord.setCurrentSublistValue('item', 'taxcode', 5);
                                        newRecord.commitLine('item');
                                    }
                                    else {
                                        item_present = false;
                                        createError(acct_code + " " + "Item is Invalid/Not Available in netsuite instance", refno, student_number, jsonData, filename, custRecordId, customrecordtype);
                                    }
                                }
                            }
                        }
                    }
                }


                //commented as per the TIP said they want auto apply feature enabled.
                // log.debug("processed to Application if present");
                // var acc_ref_arr = [];
                // var install_no_arr = [];
                // if (item_present) {
                //     if (application.length > 0) {
                //         for (var i = 0; i < application.length; i++) {
                //             var acct_ref_no = application[i].applied_to_refno
                //             var acct_code = application[i].applied_to_acct_code;
                //             var balance = application[i].applied_amount;
                //             balance = balance.replace(",", "");
                //             log.audit('acct_code', acct_code);
                //             log.audit(' balance', balance);

                //             var searchFilterInv = [];
                //             var searchColumnsInv = [];

                //             searchFilterInv.push(search.createFilter({
                //                 name: 'mainline',
                //                 operator: search.Operator.IS,
                //                 values: true
                //             }));

                //             searchFilterInv.push(search.createFilter({
                //                 name: 'numbertext',
                //                 operator: search.Operator.IS,
                //                 values: acct_ref_no
                //             }));

                //             searchFilterInv.push(search.createFilter({
                //                 name: 'type',
                //                 operator: search.Operator.ANYOF,
                //                 values: 'CustInvc'
                //             }));

                //             searchColumnsInv.push(search.createColumn({
                //                 name: 'internalid'
                //             }));

                //             searchColumnsInv.push(search.createColumn({
                //                 name: 'terms'
                //             }));

                //             log.audit('Search Result');

                //             var ResultsInv = search.create({
                //                 type: 'invoice',
                //                 filters: searchFilterInv,
                //                 columns: searchColumnsInv
                //             }).run().getRange(0, 1000);

                //             log.audit('Search ResultsInv', ResultsInv);
                //             log.audit('Search ResultsInv Length', ResultsInv.length);

                //             if (ResultsInv.length > 0) {

                //                 var searchFilter = [];
                //                 var searchColumns = [];

                //                 searchFilter.push(search.createFilter({
                //                     name: 'isinactive',
                //                     operator: search.Operator.IS,
                //                     values: false
                //                 }));

                //                 searchFilter.push(search.createFilter({
                //                     name: 'custrecord_sis_map_acctcode',
                //                     operator: search.Operator.IS,
                //                     values: acct_code
                //                 }));

                //                 var terms_inv = ResultsInv[0].getValue("terms")
                //                 searchFilter.push(
                //                     search.createFilter({
                //                         name: "custrecord_sis_map_instparent",
                //                         operator: search.Operator.IS,
                //                         values: terms_inv,
                //                     })
                //                 );

                //                 searchColumns.push(search.createColumn({
                //                     name: 'custrecord_sis_map_instno'
                //                 }));

                //                 var Results = search.create({
                //                     type: 'customrecord_sis_installmentmap',
                //                     filters: searchFilter,
                //                     columns: searchColumns
                //                 }).run().getRange(0, 1000);
                //                 log.audit('Search Result', Results);
                //                 log.audit('Search Length', Results.length);




                //                 if (Results.length > 0) {
                //                     var numLines = newRecord.getLineCount({
                //                         sublistId: 'apply'
                //                     });
                //                     log.audit('numLines', numLines);
                //                     if (numLines > 0) {

                //                         for (var k = 0; k < numLines; k++) {
                //                             var refnum = newRecord.getSublistValue({
                //                                 sublistId: 'apply',
                //                                 fieldId: 'refnum',
                //                                 line: k
                //                             });
                //                             var installmentnumber = newRecord.getSublistValue({
                //                                 sublistId: 'apply',
                //                                 fieldId: 'installmentnumber',
                //                                 line: k
                //                             });

                //                             log.audit('installmentnumber', installmentnumber);
                //                             log.audit("Results[0].getValue", Results[0].getValue("custrecord_sis_map_instno"));
                //                             log.audit("Results[0].getValue", acct_ref_no + " " + refnum);

                //                             if (installmentnumber == Results[0].getValue("custrecord_sis_map_instno") && refnum == acct_ref_no) {

                //                                 acc_ref_arr.push(acct_ref_no);
                //                                 install_no_arr.push(installmentnumber);
                //                                 log.audit('installmentnumber', installmentnumber);
                //                                 newRecord.selectLine({
                //                                     sublistId: 'apply',
                //                                     line: k
                //                                 });
                //                                 newRecord.setCurrentSublistValue({
                //                                     sublistId: "apply",
                //                                     fieldId: "apply",
                //                                     value: true
                //                                 });
                //                                 newRecord.setCurrentSublistValue({
                //                                     sublistId: "apply",
                //                                     fieldId: "amount",
                //                                     value: balance
                //                                 });

                //                                 newRecord.commitLine({
                //                                     sublistId: 'apply'
                //                                 });

                //                                 log.audit("In apply");
                //                             }
                //                         }
                //                     }
                //                 }
                //             }
                //         }
                //     }
                // }


                //For debitmemo installment should work as same as for tuitionbill invoices
                if (recordtype == "debitmemo") {
                    var to_create_lumpsum_inv = false;
                    var lumpsum_due_date;
                    if (item_present) {
                        log.debug("terms length", terms.length);
                        if (terms.length > 0) {

                            if (term_description != '' && term_description != null && term_description != undefined) {
                                var objField = newRecord.getField({ fieldId: 'terms' });
                                var options = objField.getSelectOptions({
                                    filter: term_description,
                                    operator: 'is'
                                });
                                log.debug("term_description", options);
                                if (options.length > 0) {

                                    log.debug("options[0].term_description", options[0].value);
                                    newRecord.setValue({
                                        fieldId: 'terms',
                                        value: options[0].value
                                    });

                                    var acct_code = terms[0].acct_code;

                                    var searchFilter = [];
                                    var searchColumns = [];

                                    searchFilter.push(search.createFilter({
                                        name: 'isinactive',
                                        operator: search.Operator.IS,
                                        values: false
                                    }));

                                    searchFilter.push(search.createFilter({
                                        name: 'custrecord_sis_map_acctcode',
                                        operator: search.Operator.IS,
                                        values: acct_code
                                    }));

                                    searchColumns.push(search.createColumn({
                                        name: 'custrecord_sis_map_instno'
                                    }));

                                    var Results = search.create({
                                        type: 'customrecord_sis_installmentmap',
                                        filters: searchFilter,
                                        columns: searchColumns
                                    }).run().getRange(0, 1000);
                                    log.debug('Search Result acct_code', Results);
                                    log.debug('Search Length acct_code', Results.length);

                                    if (Results.length > 0) {
                                        newRecord.setValue({
                                            fieldId: 'overrideinstallments',
                                            value: true
                                        });
                                        for (var i = 0; i < terms.length; i++) {

                                            var amount_due = terms[i].amount_due;
                                            // var amount_paid = terms[i].amount_paid;
                                            var due_date = terms[i].due_date;

                                            if (amount_due) {
                                                amount_due = String(amount_due).replace(",", "");
                                            }
                                            var lineNum = newRecord.selectLine({
                                                sublistId: 'installment',
                                                line: i
                                            });
                                            // newRecord.setCurrentSublistValue('installment', 'seqnum', i);
                                            newRecord.setCurrentSublistValue('installment', 'duedate', new Date(due_date));
                                            // newRecord.setCurrentSublistValue('installment', 'status', "Unpaid");
                                            newRecord.setCurrentSublistValue('installment', 'amount', amount_due);
                                            log.debug('Amount', amount_due);
                                            newRecord.commitLine('installment');
                                        }
                                    }
                                    else {
                                        to_create_lumpsum_inv = true;
                                        lumpsum_due_date = terms[0].due_date;
                                    }
                                }
                                else {
                                    to_create_lumpsum_inv = true;
                                    lumpsum_due_date = terms[0].due_date;
                                }
                            }
                            else {
                                to_create_lumpsum_inv = true;
                                lumpsum_due_date = terms[0].due_date;
                            }

                        }
                    }

                    if (to_create_lumpsum_inv) {
                        if (term_description != "Undergraduate modular" || term_description != "SHS") {
                            newRecord.setValue({
                                fieldId: 'duedate',
                                value: new Date(lumpsum_due_date)
                            });
                        }
                    }
                }


                if (recordtype == "enrollwithdrawal" || recordtype == "creditmemo") {
                    newRecord.setValue({
                        fieldId: 'autoapply',
                        value: true
                    });
                }

                //commented due to TIP has now auto apply feature enabled for creditmemo
                // if (recordtype == "creditmemo") {
                //     var inv_results = searchInvoiceForAutoApply(intid);
                //     if (inv_results.length > 0) {
                //         var numLines = newRecord.getLineCount({
                //             sublistId: 'apply'
                //         });
                //         for (var k = 0; k < inv_results.length; k++) {
                //             var status_installment = inv_results[k].getValue({ name: 'status', join: 'installment' })
                //             if (status_installment != "paid") {
                //                 var installment_no = inv_results[k].getValue({ name: 'installmentnumber', join: 'installment' })
                //                 var refnum_tocheck = inv_results[k].getValue({ name: 'tranid' });
                //                 for (var m = 0; m < numLines; m++) {
                //                     var refnum = newRecord.getSublistValue({
                //                         sublistId: 'apply',
                //                         fieldId: 'refnum',
                //                         line: m
                //                     });

                //                     var inst_no = newRecord.getSublistValue({
                //                         sublistId: 'apply',
                //                         fieldId: 'installmentnumber',
                //                         line: m
                //                     });

                //                     if (installment_no) {
                //                         if (installment_no == inst_no && refnum == refnum_tocheck) {
                //                             if (!install_no_arr.includes(inst_no)) {
                //                                 newRecord.selectLine({
                //                                     sublistId: 'apply',
                //                                     line: m
                //                                 });
                //                                 newRecord.setCurrentSublistValue({
                //                                     sublistId: "apply",
                //                                     fieldId: "apply",
                //                                     value: true
                //                                 });

                //                                 newRecord.commitLine({
                //                                     sublistId: 'apply'
                //                                 });
                //                             }
                //                         }
                //                     }
                //                     else {
                //                         if (refnum == refnum_tocheck) {
                //                             newRecord.selectLine({
                //                                 sublistId: 'apply',
                //                                 line: m
                //                             });
                //                             newRecord.setCurrentSublistValue({
                //                                 sublistId: "apply",
                //                                 fieldId: "apply",
                //                                 value: true
                //                             });

                //                             newRecord.commitLine({
                //                                 sublistId: 'apply'
                //                             });
                //                         }
                //                     }

                //                 }
                //             }
                //         }
                //     }
                // }

                log.audit("Done item", newRecord);
                if (item_present) {
                    var recordid = newRecord.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                    if (recordid) {
                        log.audit('Details', "New Record Created Successfully==>" + recordid);
                        if (recordtype == "debitmemo") {

                            try {
                                var invoiceRecord = record.transform({
                                    fromType: record.Type.INVOICE,
                                    fromId: recordid,
                                    toType: 'customerpayment',
                                    isDynamic: true
                                });

                                var customerid = invoiceRecord.getValue("customer");

                                var numLines = invoiceRecord.getLineCount({
                                    sublistId: 'credit'
                                });

                                log.debug("Number Lines", numLines);
                                var ApplyAmount = 0;

                                if (numLines > 0) {
                                    for (var k = 0; k < numLines; k++) {

                                        var credit_amt = invoiceRecord.getSublistValue({
                                            sublistId: 'credit',
                                            fieldId: 'due',
                                            line: k
                                        });

                                        invoiceRecord.selectLine({
                                            sublistId: 'credit',
                                            line: k
                                        });

                                        ApplyAmount += credit_amt;

                                        invoiceRecord.setCurrentSublistValue({
                                            sublistId: "credit",
                                            fieldId: "apply",
                                            value: true
                                        });

                                        invoiceRecord.commitLine({
                                            sublistId: 'credit'
                                        });
                                    }

                                    log.debug("ApplyAmt", ApplyAmount);


                                    //check the apply credits and compare the amount 
                                    //Only apply those invoices with count of total credits of accept payments from invoice

                                    var inv_results = searchInvoiceForAutoApply(customerid);
                                    if (inv_results.length > 0) {
                                        var numLines = invoiceRecord.getLineCount({
                                            sublistId: 'apply'
                                        });
                                        var breakfromloop = true;
                                        for (var k = 0; k < inv_results.length; k++) {
                                            if (breakfromloop) {
                                                var status_installment = inv_results[k].getValue({ name: 'status', join: 'installment' })
                                                if (status_installment != "paid") {
                                                    var installment_no = inv_results[k].getValue({ name: 'installmentnumber', join: 'installment' })
                                                    var refnum_tocheck = inv_results[k].getValue({ name: 'tranid' });
                                                    for (var m = 0; m < numLines; m++) {
                                                        var refnum = invoiceRecord.getSublistValue({
                                                            sublistId: 'apply',
                                                            fieldId: 'refnum',
                                                            line: m
                                                        });

                                                        var inst_no = invoiceRecord.getSublistValue({
                                                            sublistId: 'apply',
                                                            fieldId: 'installmentnumber',
                                                            line: m
                                                        });

                                                        if (installment_no) {
                                                            if (installment_no == inst_no && refnum == refnum_tocheck) {


                                                                var amt_due = invoiceRecord.getSublistValue({
                                                                    sublistId: 'apply',
                                                                    fieldId: 'due',
                                                                    line: m
                                                                });
                                                                log.debug("amt_due", amt_due)
                                                                log.debug("ApplyAmount", ApplyAmount)
                                                                if (ApplyAmount > amt_due) {
                                                                    ApplyAmount = ApplyAmount - amt_due;
                                                                    log.debug("Inside installment Apply ApplyAmount", ApplyAmount)
                                                                    invoiceRecord.selectLine({
                                                                        sublistId: 'apply',
                                                                        line: m
                                                                    });
                                                                    invoiceRecord.setCurrentSublistValue({
                                                                        sublistId: "apply",
                                                                        fieldId: "apply",
                                                                        value: true
                                                                    });

                                                                    invoiceRecord.setCurrentSublistValue({
                                                                        sublistId: "apply",
                                                                        fieldId: "amount",
                                                                        value: amt_due
                                                                    });

                                                                    invoiceRecord.commitLine({
                                                                        sublistId: 'apply'
                                                                    });
                                                                }
                                                                else {

                                                                    log.debug("Inside installment else Apply ApplyAmount", ApplyAmount)
                                                                    invoiceRecord.selectLine({
                                                                        sublistId: 'apply',
                                                                        line: m
                                                                    });
                                                                    invoiceRecord.setCurrentSublistValue({
                                                                        sublistId: "apply",
                                                                        fieldId: "apply",
                                                                        value: true
                                                                    });

                                                                    invoiceRecord.setCurrentSublistValue({
                                                                        sublistId: "apply",
                                                                        fieldId: "amount",
                                                                        value: ApplyAmount
                                                                    });

                                                                    invoiceRecord.commitLine({
                                                                        sublistId: 'apply'
                                                                    });

                                                                    breakfromloop = false;
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                        else {
                                                            if (refnum == refnum_tocheck) {

                                                                var amt_due = invoiceRecord.getSublistValue({
                                                                    sublistId: 'apply',
                                                                    fieldId: 'due',
                                                                    line: m
                                                                });

                                                                log.debug("amt_due", amt_due)
                                                                log.debug("ApplyAmount", ApplyAmount)
                                                                if (ApplyAmount > amt_due) {
                                                                    ApplyAmount = ApplyAmount - amt_due;
                                                                    log.debug("Inside inv ref Apply ApplyAmount", ApplyAmount)
                                                                    invoiceRecord.selectLine({
                                                                        sublistId: 'apply',
                                                                        line: m
                                                                    });
                                                                    invoiceRecord.setCurrentSublistValue({
                                                                        sublistId: "apply",
                                                                        fieldId: "apply",
                                                                        value: true
                                                                    });

                                                                    invoiceRecord.setCurrentSublistValue({
                                                                        sublistId: "apply",
                                                                        fieldId: "amount",
                                                                        value: amt_due
                                                                    });

                                                                    invoiceRecord.commitLine({
                                                                        sublistId: 'apply'
                                                                    });
                                                                }
                                                                else {
                                                                    log.debug("Inside inv ref else Apply ApplyAmount", ApplyAmount)
                                                                    invoiceRecord.selectLine({
                                                                        sublistId: 'apply',
                                                                        line: m
                                                                    });
                                                                    invoiceRecord.setCurrentSublistValue({
                                                                        sublistId: "apply",
                                                                        fieldId: "apply",
                                                                        value: true
                                                                    });

                                                                    invoiceRecord.setCurrentSublistValue({
                                                                        sublistId: "apply",
                                                                        fieldId: "amount",
                                                                        value: ApplyAmount
                                                                    });

                                                                    invoiceRecord.commitLine({
                                                                        sublistId: 'apply'
                                                                    });

                                                                    breakfromloop = false;
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        var paymentMemoRecord = invoiceRecord.save({
                                            ignoreMandatoryFields: true
                                        });
                                        log.debug("Payment Applied Successfully", paymentMemoRecord);

                                        return recordid
                                    }
                                }
                            }
                            catch (e) {
                                createError("Created Invoice but applying payment having an error", enr_refno, student_number, jsonData, filename, custRecordId, customrecordtype);
                            }
                        }
                        log.audit("recordid", recordid);
                        log.audit('Details', "New TutionBill scholar Created Successfully==>", recordid);
                        return recordid;

                    }
                }

            }
        }
        catch (e) {
            log.debug("error", e);
            createError(e, refno, student_number, jsonData, filename, custRecordId, customrecordtype);
        }
    }


    function createError(error, refno, student_number, jsonData, filename, custRecordId, customrecordtype) {
        var errorCatcherObj = record.create({
            type: 'customrecord_tip_integration_error_catch',
            isDynamic: true,
        });

        if (error.hasOwnProperty('message')) {
            var errmsg = error.message;
        }
        if (errmsg != '' && errmsg != null && errmsg != undefined) {
            if (errmsg.indexOf("Cannot read property 'value' of undefined") > -1) {
                errorCatcherObj.setValue({
                    fieldId: 'custrecord_tip_integration_error_msg',
                    value: "Invalid Campus/NetsuiteProgram/year level/SY1/terms description (Value Not available in Netsuite Instance)"
                });
            }
            else {
                errorCatcherObj.setValue({
                    fieldId: 'custrecord_tip_integration_error_msg',
                    value: errmsg
                });
            }
        }

        errorCatcherObj.setValue({
            fieldId: 'custrecord_tip_integration_errorfull',
            value: error
        });

        errorCatcherObj.setValue({
            fieldId: 'custrecord_tip_integration_trans_id',
            value: refno
        });

        if (custRecordId != '' && custRecordId != null && custRecordId != undefined) {
            var outputUrl = url.resolveRecord({
                recordType: customrecordtype,
                recordId: custRecordId
            });
            errorCatcherObj.setValue({
                fieldId: 'custrecord_tip_custrecordid_error',
                value: outputUrl
            });
        }


        if (jsonData != '' && jsonData != null && jsonData != undefined) {
            errorCatcherObj.setValue({
                fieldId: 'custrecord_tip_integration_json_data',
                value: jsonData
            });
        }

        if (filename != '' && filename != null && filename != undefined) {
            errorCatcherObj.setValue({
                fieldId: 'custrecord_tip_integration_errorfilename',
                value: filename
            });
        }
        errorCatcherObj.save();
        return;
    }



    function searchInvoiceForAutoApply(getStudentID) {

        var searchStudFilter = [];
        var searchStudColumns = [];

        searchStudFilter.push(search.createFilter({
            name: 'type',
            operator: search.Operator.ANYOF,
            values: 'CustInvc'
        }));

        searchStudFilter.push(search.createFilter({
            name: 'status',
            operator: search.Operator.ANYOF,
            values: 'CustInvc:A'
        }));

        searchStudFilter.push(search.createFilter({
            name: 'mainline',
            operator: search.Operator.IS,
            values: true
        }));

        searchStudFilter.push(search.createFilter({
            name: 'mainname',
            operator: search.Operator.ANYOF,
            values: getStudentID
        }));

        searchStudColumns.push(search.createColumn({ name: 'status', join: 'installment' }));
        searchStudColumns.push(search.createColumn({ name: 'installmentnumber', join: 'installment', sort: search.Sort.ASC }));
        searchStudColumns.push(search.createColumn({ name: 'datecreated', sort: search.Sort.ASC }));
        searchStudColumns.push(search.createColumn({ name: 'tranid' }));

        var studentResults = search.create({
            type: 'invoice',
            filters: searchStudFilter,
            columns: searchStudColumns
        }).run().getRange(0, 1000);
        log.audit('invoice Search Result', studentResults);
        log.audit('invoice Search Length', studentResults.length);

        return studentResults;

    }


    function searchExistingStudents(getStudentID) {

        var searchStudFilter = [];
        var searchStudColumns = [];

        searchStudFilter.push(search.createFilter({
            name: 'isinactive',
            operator: search.Operator.IS,
            values: false
        }));

        searchStudFilter.push(search.createFilter({
            name: 'entityid',
            operator: search.Operator.IS,
            values: getStudentID
        }));

        searchStudColumns.push(search.createColumn({
            name: 'internalid'
        }));

        var studentResults = search.create({
            type: 'customer',
            filters: searchStudFilter,
            columns: searchStudColumns
        }).run().getRange(0, 1000);
        log.audit('Student Search Result', studentResults);
        log.audit('Student Search Length', studentResults.length);

        return studentResults;

    }




    function searchUnprocessedRequests() {

        var recordIds = [];
        var startIndex = 0;

        //To search data if more than 1000
        do {
            var searchFilter = [];
            var searchColumns = [];

            searchFilter.push(search.createFilter({
                name: 'isinactive',
                operator: search.Operator.IS,
                values: false
            }));

            searchFilter.push(search.createFilter({
                name: 'custrecord_tip_creditmemo_processed',
                operator: search.Operator.IS,
                values: false
            }));

            searchColumns.push(search.createColumn({
                name: 'internalid'
            }));

            var result = search.create({
                type: 'customrecord_tip_creditmemo_integration',
                filters: searchFilter,
                columns: searchColumns
            }).run().getRange({ start: startIndex, end: startIndex + 1000 });

            // searchResults = search.load({
            //     id: searchId,
            //     start: startIndex,
            //     end: startIndex + 1000
            // });
            // var result = searchResults.run().getRange({ start: startIndex, end: startIndex + 1000 });
            log.debug("results", result)
            for (var i = 0; i < result.length; i++) {
                var custom_id = result[i].getValue("internalid");
                recordIds.push(custom_id);
            }
            startIndex += 1000;
        } while (result.length >= 1000);

        return recordIds;

    }



    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce
    };

});

