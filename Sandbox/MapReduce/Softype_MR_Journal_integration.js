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
 **@Description :  Load the Custom record and check the unprocessed Payment,create Payment
 **@Updates     :  
 ***************************************************************************************/



//Things to do- update of invoice,netsuite_program field set,Tax code is pending to create a line item,Error catcher for this,Course to store in field is missing.
define(['N/record', 'N/search', 'N/log', 'N/file', 'N/runtime', 'N/url','N/transaction'], function (record, search, log, file, runtime, url,transaction) {

    function getInputData(context) {

        try {
            var data = [];
            var jsonfilename = "";


            var getJSONDataJournal = searchUnprocessedJournalRequests();

            log.debug("getJSONDataJournal", getJSONDataJournal)
            if (getJSONDataJournal.length > 0) {
                for (var i = 0; i < getJSONDataJournal.length; i++) {
                    var custRecordId = getJSONDataJournal[i];
                    data.push(
                        {
                            "custRecordId": custRecordId,
                            "customrecordtype": "customrecord_tip_journal_voucher",
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
        var customrecordtype = jsondata.customrecordtype;
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

        record.submitFields({
            type: customrecordtype,
            id: custRecordId,
            values: {
                "custrecord_jv_processed": true
            }
        });

        log.debug("resultData", resultData);
        if (Array.isArray(resultData)) {
            for (var k = 0; k < resultData.length; k++) {
                var paymentData = resultData[k];
                log.debug("paymentData", paymentData.payment_info);
                context.write({
                    key: jsonfilename + "_" + Math.floor((Math.random() * 1000000000000000) + 1) + Math.floor((Math.random() * 1000000000000000) + 1),
                    value: {
                        "custRecordId": custRecordId,
                        "paymentData": paymentData.payment_info,
                        'filename': filename,
                        'fileID': fileID
                    }
                });
            }
        }
        else {
            var paymentData = resultData;
            log.debug("paymentData", paymentData.payment_info);

            context.write({
                key: jsonfilename + "_" + Math.floor((Math.random() * 1000000000000000) + 1) + "_1",
                value: {
                    "custRecordId": custRecordId,
                    "paymentData": paymentData.payment_info,
                    'filename': jsonfilename,
                    'fileID': fileID
                }
            });
        }

    }

    function reduce(context) {

        log.debug("context.key", context.key)
        log.debug("context.Value", context)
        log.debug("context.Value", context.values)

        var jsonlength = context.values;
        log.debug("jsonlength", jsonlength.length)
        for (var g = 0; g < jsonlength.length; g++) {
            var jsondata = JSON.parse(context.values[g]);

            var data = jsondata.paymentData;

            var filename = jsondata.filename;
            var custRecordId = jsondata.custRecordId;
            var fileID = jsondata.fileID;
            log.debug('Data in Map', data);
            var txn_no = data.txn_no;

            var amountpaid;
            var paytype_desc;
            var paytype = data.paytype;
            if (paytype[0].hasOwnProperty('amount_paid')) {
                amountpaid = paytype[0].amount_paid;
                amountpaid = amountpaid.replace(",", "");
            }
            if (paytype[0].hasOwnProperty('paytype_desc')) {
                paytype_desc = paytype[0].paytype_desc;
            }

            log.debug('Get Payment ID', txn_no);
            // var student_number ="";


            var existinggetRefNoSearchResult = searchExistingJV(txn_no);


            log.debug('Existing JV found==>', JSON.stringify(existinggetRefNoSearchResult));

            log.debug("paytype", paytype_desc.toLowerCase());

            if ((paytype_desc.toLowerCase() == 'credit cards') || (paytype_desc.toLowerCase() == 'credit cards (mas.card & visa)')) {

                if (existinggetRefNoSearchResult.length > 0) {
                    createError("Record Already existing", txn_no, "", "", filename, custRecordId);
                }
                else {
                    var createCreditMemoRec = createPaymentRecord(data, filename, custRecordId, fileID);
                    if (createCreditMemoRec != '' && createCreditMemoRec != null && createCreditMemoRec != undefined) {

                        log.debug('JV Created', createCreditMemoRec);
                    }
                }

            }
            else {
                if (existinggetRefNoSearchResult.length > 0) {
                    var existingPaymentID = existinggetRefNoSearchResult[0].getValue('internalid');
                    createError("Record Already existing", txn_no, "", "", filename, custRecordId);
                    log.debug('Existing JV ID', existingPaymentID);

                    var savedSearchLookupField = search.lookupFields({
                        type: 'journalentry',
                        id: existingPaymentID,
                        columns: ['custbody_softype_sis_jvpaymethod']
                    }).custbody_softype_sis_jvpaymethod[0].value

                    log.debug('custbody_softype_sis_jvpaymethod', savedSearchLookupField);
                    if (savedSearchLookupField != '11' && savedSearchLookupField != '12') {
                        var existingPayment = searchExistingCustomerPayment(txn_no);
                        if (existingPayment.length > 0) {
                            log.debug('existingPayment found', existingPaymentID);
                            var existingPaymentID = existingPayment[0].getValue('internalid');
                            var customerPayment = record.load({
                                type: 'customerpayment',
                                id: existingPaymentID
                            });

                            log.debug('existingPayment found', existingPaymentID);

                            customerPayment.setValue({
                                fieldId: "payment",
                                value: amountpaid
                            });

                            customerPayment.setValue({
                                fieldId: "autoapply",
                                value: false
                            });

                            log.debug('existingPayment customerPayment', customerPayment);
                            for (var j = 0; j < customerPayment.getLineCount({ sublistId: 'apply' }); j++) {

                                var refnum = customerPayment.getSublistValue({
                                    sublistId: 'apply',
                                    fieldId: 'refnum',
                                    line: j
                                });

                                var apply_bool = customerPayment.getSublistValue({
                                    sublistId: 'apply',
                                    fieldId: 'apply',
                                    line: j
                                });
                                log.debug('existingPayment refnum', refnum);
                                log.debug('txn_no', txn_no);
                                if (refnum == txn_no && (apply_bool == "F" || apply_bool == false)) {

                                    log.debug('Applied');
                                    customerPayment.setSublistValue({
                                        sublistId: 'apply',
                                        fieldId: 'apply',
                                        line: j,
                                        value: true
                                    });

                                    log.debug('Applied');
                                }

                            }

                            var recordpayment_updated = customerPayment.save({
                                enableSourcing: true,
                                ignoreMandatoryFields: true
                            });
                            log.debug("recordpayment_updated", recordpayment_updated)

                        }

                    }
                }

                if (existinggetRefNoSearchResult.length == 0) {

                    var existingPayment = searchExistingCustomerPayment(txn_no);
                    if (existingPayment.length > 0) {

                        var createJVRec = createPaymentRecord(data, filename, custRecordId, fileID);
                        if (createJVRec != '' && createJVRec != null && createJVRec != undefined) {

                            log.debug('JV Created', createJVRec);


                            var existingPaymentID = existingPayment[0].getValue('internalid');
                            var customerPayment = record.load({
                                type: 'customerpayment',
                                id: existingPaymentID
                            });

                            customerPayment.setValue({
                                fieldId: "payment",
                                value: amountpaid
                            });

                            customerPayment.setValue({
                                fieldId: "autoapply",
                                value: false
                            });

                            log.debug('existingPayment customerPayment', customerPayment);
                            for (var j = 0; j < customerPayment.getLineCount({ sublistId: 'apply' }); j++) {

                                var refnum = customerPayment.getSublistValue({
                                    sublistId: 'apply',
                                    fieldId: 'refnum',
                                    line: j
                                });

                                var apply_bool = customerPayment.getSublistValue({
                                    sublistId: 'apply',
                                    fieldId: 'apply',
                                    line: j
                                });
                                log.debug('existingPayment refnum', refnum);
                                log.debug('txn_no', txn_no);
                                if (refnum == txn_no && (apply_bool == "F" || apply_bool == false)) {

                                    log.debug('Applied');
                                    customerPayment.setSublistValue({
                                        sublistId: 'apply',
                                        fieldId: 'apply',
                                        line: j,
                                        value: true
                                    });

                                    log.debug('Applied');
                                }

                            }

                            var recordpayment_updated = customerPayment.save({
                                enableSourcing: true,
                                ignoreMandatoryFields: true
                            });
                            log.debug("recordpayment_updated", recordpayment_updated);
                        }

                    }
                    else {
                        createError("No Payment exists for JV to attach.Please first create a Payment", txn_no, "", data, filename, custRecordId);
                    }
                }
                log.debug("governence limit", runtime.getCurrentScript().getRemainingUsage())
            }
        }


    }


    function searchUnprocessedJournalRequests() {

        var recordIds = [];
        var startIndex = 0;

        //To search data if more than 1000
        do {
            var searchPaymentFilter = [];
            var searchPaymentColumns = [];

            searchPaymentFilter.push(search.createFilter({
                name: 'isinactive',
                operator: search.Operator.IS,
                values: false
            }));

            searchPaymentFilter.push(search.createFilter({
                name: 'custrecord_jv_processed',
                operator: search.Operator.IS,
                values: false
            }));

            searchPaymentColumns.push(search.createColumn({
                name: 'internalid'
            }));

            var result = search.create({
                type: 'customrecord_tip_journal_voucher',
                filters: searchPaymentFilter,
                columns: searchPaymentColumns
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


    function searchExistingJV(getRefID) {

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
            values: 'Journal'
        }));

        searchColumns.push(search.createColumn({
            name: 'internalid'
        }));

        log.debug('Search Result');

        var Results = search.create({
            type: 'journalentry',
            filters: searchFilter,
            columns: searchColumns
        }).run().getRange(0, 1000);

        log.debug('Search Result', Results);
        log.debug('Search Length', Results.length);
        return Results;
    }



    function searchExistingVoidedCustomerPayment(getRefID) {

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
            values: 'CustPymt'
        }));

        searchFilter.push(search.createFilter({
            name: 'voided',
            operator: search.Operator.IS,
            values: true
        }));

        searchColumns.push(search.createColumn({
            name: 'internalid'
        }));

        log.debug('Search Result');

        var Results = search.create({
            type: 'customerpayment',
            filters: searchFilter,
            columns: searchColumns
        }).run().getRange(0, 1000);

        log.debug('Search Result', Results);
        log.debug('Search Length', Results.length);
        return Results;
    }


    function searchExistingCustomerPayment(getRefID) {

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
            values: 'CustPymt'
        }));

        searchColumns.push(search.createColumn({
            name: 'internalid'
        }));

        log.debug('Search Result');

        var Results = search.create({
            type: 'customerpayment',
            filters: searchFilter,
            columns: searchColumns
        }).run().getRange(0, 1000);

        log.debug('Search Result', Results);
        log.debug('Search Length', Results.length);
        return Results;
    }


    function createPaymentRecord(jsonData, fileName, custRecordId, fileID) {

        try {

            var myEnvType = runtime.envType;
            var accAvailable = true;
            var enr_refno = jsonData.txn_no;
            var campus = jsonData.campus;
            var student_number = jsonData.student_number;
            var date = jsonData.date;
            var time = jsonData.time;
            var p_orno = jsonData.p_orno;
            var teller_id = jsonData.teller_id;

            var cancelled_date = jsonData.cancelled_date;
            var cancelled_by = jsonData.cancelled_by;
            var cancelled_reason = jsonData.cancelled_reason;
            var online_offsite_payment = jsonData.online_offsite_payment;
            var particular = jsonData.particular;
            var paytype = jsonData.paytype;
            //   var cancelled = jsonData.cancelled;

            var student_type;
            var student_type_desc;

            var program_id;
            var program;
            var program_long;
            var curr_year;
            var batchcode;
            var year_level;
            var year_level_desc;
            var sy1;
            var sem;
            var school_year;
            var sy_sem;
            var jv_bank;
            var type;
            var name;

            var netsuite_program = jsonData.netsuite_program;

            if (jsonData.hasOwnProperty('name')) {
                name = jsonData.name;
            }

            if (jsonData.hasOwnProperty('type')) {
                type = jsonData.type;
            }
            if (jsonData.hasOwnProperty('student_type')) {
                student_type = jsonData.student_type;
            }
            if (jsonData.hasOwnProperty('student_type_desc')) {
                student_type_desc = jsonData.student_type_desc;
            }
            if (jsonData.hasOwnProperty('program_id')) {
                program_id = jsonData.program_id;
            }
            if (jsonData.hasOwnProperty('program')) {
                program = jsonData.program;
            }
            if (jsonData.hasOwnProperty('program_long')) {
                program_long = jsonData.program_long;
            }
            if (jsonData.hasOwnProperty('curr_year')) {
                curr_year = jsonData.curr_year;
            }
            if (jsonData.hasOwnProperty('batchcode')) {
                batchcode = jsonData.batchcode;
            }
            if (jsonData.hasOwnProperty('year_level')) {
                year_level = jsonData.year_level;
            }
            if (jsonData.hasOwnProperty('year_level_desc')) {
                year_level_desc = jsonData.year_level_desc;
            }
            if (jsonData.hasOwnProperty('netsuite_program')) {
                netsuite_program = jsonData.netsuite_program;
            }
            if (jsonData.hasOwnProperty('jv_bank')) {
                jv_bank = jsonData.jv_bank;
            }

            if (jsonData.hasOwnProperty('project_id')) {
                project_id = jsonData.project_id;
            }

            var item_present = true;
            var entityId = searchExistingStudents(student_number);
            log.debug("entityId", entityId);

            if (entityId.length <= 0) {
                createError("Entity is Invalid/Not Available in netsuite instance", enr_refno, student_number, jsonData, fileName, custRecordId);
            }

            log.debug("entityId", entityId)
            if (entityId.length > 0)
                var intid = entityId[0].getValue("internalid");
            log.debug("entityId", intid)


            var newRecord = record.create({
                type: 'journalentry',
                isDynamic: true
            });

            newRecord.setValue({
                fieldId: 'customform',
                value: '129'
            });


            newRecord.setValue({
                fieldId: 'subsidiary',
                value: '2'
            });



            if (program_id != '' && program_id != null && program_id != undefined) {
                newRecord.setValue({
                    fieldId: 'custbody_softype_sis_progid',
                    value: program_id
                });
            }


            if (program_long != '' && program_long != null && program_long != undefined) {
                newRecord.setValue({
                    fieldId: 'custbody_softype_sis_progdesc',
                    value: program_long
                });
            }

            if (date != '' && date != null && date != undefined) {
                newRecord.setValue({
                    fieldId: 'trandate',
                    value: new Date(date)
                });
            }

            if (time != '' && time != null && time != undefined) {
                newRecord.setValue({
                    fieldId: 'custbodysoftype_sis_transtime',
                    value: time
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

            if (teller_id != '' && teller_id != null && teller_id != undefined) {
                newRecord.setValue({
                    fieldId: 'custbody_softype_sis_tellerid',
                    value: teller_id
                });
            }

            if (year_level != '' && year_level != null && year_level != undefined) {
                newRecord.setValue({
                    fieldId: 'custbody_softype_sis_yrlevel',
                    value: year_level
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



            if (type != '' && type != null && type != undefined) {
                newRecord.setValue({
                    fieldId: 'custbody_softype_sis_type',
                    value: type
                });
            }


            if (enr_refno != '' && enr_refno != null && enr_refno != undefined) {
                newRecord.setValue({
                    fieldId: 'tranid',
                    value: enr_refno
                });
            }

            if (p_orno != '' && p_orno != null && p_orno != undefined) {
                newRecord.setValue({
                    fieldId: 'custbody_softype_sis_orno',
                    value: p_orno
                });
            }

            if (cancelled_by != '' && cancelled_by != null && cancelled_by != undefined) {
                newRecord.setValue({
                    fieldId: 'custbody_softype_sis_cancelledby',
                    value: cancelled_by
                });
            }

            if (cancelled_date != '' && cancelled_date != null && cancelled_date != undefined) {
                newRecord.setValue({
                    fieldId: 'custbody_softype_sis_datecancelled',
                    value: new Date(cancelled_date)
                });
            }

            if (cancelled_reason != '' && cancelled_reason != null && cancelled_reason != undefined) {
                newRecord.setValue({
                    fieldId: 'custbody_softype_sis_cancelledreason',
                    value: cancelled_reason
                });
            }

            if (online_offsite_payment != '' && online_offsite_payment != null && online_offsite_payment != undefined) {
                newRecord.setValue({
                    fieldId: 'custbody_softype_sis_paymentsite',
                    value: online_offsite_payment
                });
            }



            if (particular.length > 0) {
                for (var i = 0; i < particular.length; i++) {

                    if (item_present) {

                        if (i == 0) {
                            sy1 = particular[i].sy1;
                            sem = particular[i].sem;
                            sy_sem = particular[i].sy_sem;
                            school_year = particular[i].school_year;
                            log.debug('sy1', sy1);
                            log.debug('sem', sem);
                            log.debug('sy_sem', sy_sem);

                        }
                    }
                }
            }


            if (sem != '' && sem != null && sem != undefined) {
                newRecord.setValue({
                    fieldId: 'custbody_softype_sis_acadterm',
                    value: sem
                });
            }

            if (sy_sem != '' && sy_sem != null && sy_sem != undefined) {
                newRecord.setValue({
                    fieldId: 'custbody_softype_sis_syandsem',
                    value: sy_sem
                });
            }


            if (paytype.length > 0) {

                var acc_notfound = "";

                var location_line;
                var department;
                var schoolyr;
                var class_id;


                var proc_id;
                var check_no;
                var check_date;
                var approval_no;
                if (paytype[0].hasOwnProperty('proc_id')) {
                    proc_id = paytype[0].proc_id;;
                }

                if (paytype[0].hasOwnProperty('check_no')) {
                    check_no = paytype[0].check_no;;
                }

                if (paytype[0].hasOwnProperty('check_date')) {
                    check_date = paytype[0].check_date;;
                }

                if (paytype[0].hasOwnProperty('approval_no')) {
                    approval_no = paytype[0].approval_no;;
                }


                if (proc_id != '' && proc_id != null && proc_id != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_st_sis_for_schaprcode',
                        value: proc_id
                    });
                }
                if (check_no != '' && check_no != null && check_no != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_st_sis_for_checkno',
                        value: check_no
                    });
                }
                if (check_date != '' && check_date != null && check_date != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_st_sis_for_checkdate',
                        value: new Date(check_date)
                    });
                }
                if (approval_no != '' && approval_no != null && approval_no != undefined) {
                    newRecord.setValue({
                        fieldId: 'custbody_st_sis_for_ccapprovalcode',
                        value: approval_no
                    });
                }


                //This need to check if the json property is coming from the header or not
                var paytype_desc = paytype[0].paytype_desc;

                var objField = newRecord.getField({ fieldId: 'custbody_softype_sis_jvpaymethod' });
                var options = objField.getSelectOptions({
                    filter: paytype_desc,
                    operator: 'is'
                });
                log.debug("options paymentoption", options);
                log.debug("options[0].value paymentoption", options[0].value);

                newRecord.setValue({
                    fieldId: 'custbody_softype_sis_jvpaymethod',
                    value: options[0].value
                });

                if (campus != '' && campus != null && campus != undefined) {
                    var location_result = locationSearch(campus);
                    if (location_result.length > 0) {
                        location_line = location_result[0].getValue("internalid");
                    }
                    else {
                        createError("Campus/Location not Found", enr_refno, student_number, jsonData, fileName, custRecordId);
                    }

                }

                if (netsuite_program != '' && netsuite_program != null && netsuite_program != undefined) {
                    var department_results = departmentSearch(netsuite_program);
                    if (department_results.length > 0) {
                        department = department_results[0].getValue("internalid");
                    }
                    else {
                        createError("Netsuite program/Department not Found", enr_refno, student_number, jsonData, fileName, custRecordId);
                    }
                }

                if (school_year != '' && school_year != null && school_year != undefined) {
                    var schoolyr_results = SchoolYearSearch(school_year);
                    if (schoolyr_results.length > 0) {
                        schoolyr = schoolyr_results[0].getValue("internalid");
                    }
                    else {
                        createError("School Year not Found", enr_refno, student_number, jsonData, fileName, custRecordId);
                    }
                }

                if (year_level_desc != '' && year_level_desc != null && year_level_desc != undefined) {
                    var class_results = ClassSearch(year_level_desc);
                    if (class_results.length > 0) {
                        class_id = class_results[0].getValue("internalid");
                    }
                    else {
                        createError("Year Level/Class not Found", enr_refno, student_number, jsonData, fileName, custRecordId);
                    }
                }

                var jv_bank;
                var jv_bank_amount;
                if (paytype[0].hasOwnProperty('jv_bank')) {
                    jv_bank = paytype[0].jv_bank;;
                }
                if (paytype[0].hasOwnProperty('jv_bank_amount')) {
                    jv_bank_amount = paytype[0].jv_bank_amount
                    if (jv_bank_amount != '' && jv_bank_amount != null && jv_bank_amount != undefined) {
                        jv_bank_amount = Number((jv_bank_amount).replace(",", ""));
                    }
                }

                if (jv_bank != '' && jv_bank != null && jv_bank != undefined) {
                    var results = accountSearch(jv_bank);
                    if (accAvailable) {
                        if (results.length > 0) {
                            newRecord.selectNewLine('line');
                            newRecord.setCurrentSublistValue('line', 'account', results[0].getValue("internalid"));
                            newRecord.setCurrentSublistValue('line', 'location', location_line);
                            newRecord.setCurrentSublistValue('line', 'department', department);
                            newRecord.setCurrentSublistValue('line', 'entity', intid);
                            newRecord.setCurrentSublistValue('line', 'class', class_id);

                            newRecord.setCurrentSublistValue('line', 'cseg__tip_sycseg', schoolyr);

                            if (Math.sign(jv_bank_amount) >= 0) {
                                log.debug("in debit", jv_bank_amount);
                                newRecord.setCurrentSublistValue('line', 'debit', jv_bank_amount);
                            }
                            else {
                                log.debug("in credit", jv_bank_amount);
                                newRecord.setCurrentSublistValue('line', 'credit', Math.abs(jv_bank_amount));
                            }

                            newRecord.commitLine('line');
                        }
                        else {
                            acc_notfound = jv_bank;
                            accAvailable = false;
                        }
                    }
                }



                if (accAvailable) {
                    var jv_expense;
                    var jv_expense_amount;
                    if (paytype[0].hasOwnProperty('jv_expense')) {
                        jv_expense = paytype[0].jv_expense;
                    }


                    if (paytype[0].hasOwnProperty('jv_expense_amount')) {
                        jv_expense_amount = paytype[0].jv_expense_amount;
                        if (jv_expense_amount != '' && jv_expense_amount != null && jv_expense_amount != undefined) {
                            jv_expense_amount = Number((jv_expense_amount).replace(",", ""));
                        }
                    }

                    if (jv_expense != '' && jv_expense != null && jv_expense != undefined) {
                        var results = accountSearch(jv_expense);
                        if (results.length > 0) {
                            newRecord.selectNewLine('line');
                            newRecord.setCurrentSublistValue('line', 'account', results[0].getValue("internalid"));
                            newRecord.setCurrentSublistValue('line', 'location', location_line);
                            newRecord.setCurrentSublistValue('line', 'department', department);
                            newRecord.setCurrentSublistValue('line', 'entity', intid);
                            newRecord.setCurrentSublistValue('line', 'class', class_id);

                            newRecord.setCurrentSublistValue('line', 'cseg__tip_sycseg', schoolyr);

                            if (Math.sign(jv_expense_amount) >= 0) {
                                log.debug("in debit", jv_expense_amount);
                                newRecord.setCurrentSublistValue('line', 'debit', jv_expense_amount);
                            }
                            else {
                                log.debug("in credit", jv_expense_amount);
                                newRecord.setCurrentSublistValue('line', 'credit', Math.abs(jv_expense_amount));
                            }

                            newRecord.commitLine('line');
                        }
                        else {
                            acc_notfound += (" " + jv_expense)
                            accAvailable = false;
                        }
                    }
                }



                if (accAvailable) {
                    var jv_otherincome;
                    var jv_otherincome_amount;
                    if (paytype[0].hasOwnProperty('jv_otherincome')) {
                        jv_otherincome = paytype[0].jv_otherincome;
                    }
                    if (paytype[0].hasOwnProperty('jv_otherincome_amount')) {
                        jv_otherincome_amount = paytype[0].jv_otherincome_amount;
                        if (jv_otherincome_amount != '' && jv_otherincome_amount != null && jv_otherincome_amount != undefined) {
                            jv_otherincome_amount = Number((jv_otherincome_amount).replace(",", ""));
                        }
                    }


                    if (jv_otherincome != '' && jv_otherincome != null && jv_otherincome != undefined) {
                        var results = accountSearch(jv_otherincome);
                        if (results.length > 0) {
                            newRecord.selectNewLine('line');
                            newRecord.setCurrentSublistValue('line', 'account', results[0].getValue("internalid"));
                            newRecord.setCurrentSublistValue('line', 'location', location_line);
                            newRecord.setCurrentSublistValue('line', 'department', department);
                            newRecord.setCurrentSublistValue('line', 'entity', intid);
                            newRecord.setCurrentSublistValue('line', 'class', class_id);

                            newRecord.setCurrentSublistValue('line', 'cseg__tip_sycseg', schoolyr);

                            if (Math.sign(jv_otherincome_amount) >= 0) {
                                log.debug("in debit", jv_otherincome_amount);
                                newRecord.setCurrentSublistValue('line', 'debit', jv_otherincome_amount);
                            }
                            else {
                                log.debug("in credit", jv_otherincome_amount);
                                newRecord.setCurrentSublistValue('line', 'credit', Math.abs(jv_otherincome_amount));
                            }
                            newRecord.commitLine('line');
                        }
                        else {
                            acc_notfound += (" " + jv_otherincome)
                            accAvailable = false;
                        }
                    }
                }




                if (accAvailable) {
                    var jv_acctrecvable;
                    var jv_acctrecvable_amount_proc_fee;
                    if (paytype[0].hasOwnProperty('jv_acctrecvable')) {
                        jv_acctrecvable = paytype[0].jv_acctrecvable;
                    }
                    if (paytype[0].hasOwnProperty('jv_acctrecvable_amount_proc_fee')) {

                        jv_acctrecvable_amount_proc_fee = paytype[0].jv_acctrecvable_amount_proc_fee;
                        if (jv_acctrecvable_amount_proc_fee != '' && jv_acctrecvable_amount_proc_fee != null && jv_acctrecvable_amount_proc_fee != undefined) {
                            jv_acctrecvable_amount_proc_fee = Number((jv_acctrecvable_amount_proc_fee).replace(",", ""));
                        }
                    }

                    if (jv_acctrecvable != '' && jv_acctrecvable != null && jv_acctrecvable != undefined) {
                        var results = accountSearch(jv_acctrecvable);

                        if (results.length > 0) {
                            newRecord.selectNewLine('line');
                            newRecord.setCurrentSublistValue('line', 'account', results[0].getValue("internalid"));
                            newRecord.setCurrentSublistValue('line', 'location', location_line);
                            newRecord.setCurrentSublistValue('line', 'department', department);
                            newRecord.setCurrentSublistValue('line', 'entity', intid);
                            newRecord.setCurrentSublistValue('line', 'class', class_id);

                            newRecord.setCurrentSublistValue('line', 'cseg__tip_sycseg', schoolyr);

                            if (Math.sign(jv_acctrecvable_amount_proc_fee) >= 0) {
                                log.debug("in debit", jv_acctrecvable_amount_proc_fee);
                                newRecord.setCurrentSublistValue('line', 'debit', jv_acctrecvable_amount_proc_fee);
                            }
                            else {
                                log.debug("in credit", jv_acctrecvable_amount_proc_fee);
                                newRecord.setCurrentSublistValue('line', 'credit', Math.abs(jv_acctrecvable_amount_proc_fee));
                            }
                            newRecord.commitLine('line');
                        }
                        else {
                            acc_notfound += (" " + jv_acctrecvable)
                            accAvailable = false;
                        }
                    }
                }



                if (accAvailable) {
                    var jv_cred_w_tax;
                    var jv_cred_w_tax_amount;
                    if (paytype[0].hasOwnProperty('jv_cred_w_tax')) {
                        jv_cred_w_tax = paytype[0].jv_cred_w_tax;
                    }
                    if (paytype[0].hasOwnProperty('jv_cred_w_tax_amount')) {

                        jv_cred_w_tax_amount = paytype[0].jv_cred_w_tax_amount;
                        if (jv_cred_w_tax_amount != '' && jv_cred_w_tax_amount != null && jv_cred_w_tax_amount != undefined) {
                            jv_cred_w_tax_amount = Number((jv_cred_w_tax_amount).replace(",", ""));
                        }
                    }

                    if (jv_cred_w_tax != '' && jv_cred_w_tax != null && jv_cred_w_tax != undefined) {
                        var results = accountSearch(jv_cred_w_tax);
                        if (results.length > 0) {
                            newRecord.selectNewLine('line');
                            newRecord.setCurrentSublistValue('line', 'account', results[0].getValue("internalid"));
                            newRecord.setCurrentSublistValue('line', 'location', location_line);
                            newRecord.setCurrentSublistValue('line', 'department', department);
                            newRecord.setCurrentSublistValue('line', 'entity', intid);
                            newRecord.setCurrentSublistValue('line', 'class', class_id);

                            newRecord.setCurrentSublistValue('line', 'cseg__tip_sycseg', schoolyr);

                            if (Math.sign(jv_cred_w_tax_amount) >= 0) {
                                log.debug("in debit", jv_cred_w_tax_amount);
                                newRecord.setCurrentSublistValue('line', 'debit', jv_cred_w_tax_amount);
                            }
                            else {
                                log.debug("in credit", jv_cred_w_tax_amount);
                                newRecord.setCurrentSublistValue('line', 'credit', Math.abs(jv_cred_w_tax_amount));
                            }
                            newRecord.commitLine('line');
                        }
                        else {
                            acc_notfound += (" " + jv_cred_w_tax)
                            accAvailable = false;
                        }
                    }
                }
            }
            if (accAvailable) {

                newRecord.setValue({
                    fieldId: 'approvalstatus',
                    value: 2
                });

                // Set reference to JSON file
                if (fileID != '' && fileID != null && fileID != undefined) {
                    newRecord.setValue({
                        fieldId: "custbody_st_json_file",
                        value: fileID,
                    });
                }

                var recordid = newRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });
                log.debug("recordid", recordid);
                log.debug('Details', "New Journal Created Successfully==>", recordid);
                if (recordid != '' && recordid != null && recordid != undefined) {
                    var existingVoidedPayment = searchExistingVoidedCustomerPayment(enr_refno);

                    if (existingVoidedPayment.length > 0) {
                        var voidJVId = transaction.void({
                            type: 'journalentry',
                            id: recordid
                        });
                        log.audit("voided journalentry", voidJVId);
                    }
                    else {
                        return recordid;
                    }
                }

            }
            else {
                createError(acc_notfound + " " + "Account is invalid/not found", enr_refno, student_number, jsonData, fileName, custRecordId);
            }

        }
        catch (e) {
            log.debug("error", e);
            createError(e, enr_refno, student_number, jsonData, fileName, custRecordId);
            return;
        }
    }



    function ClassSearch(loc) {
        var searchFilter = [];
        var searchColumns = [];

        searchFilter.push(search.createFilter({
            name: 'isinactive',
            operator: search.Operator.IS,
            values: false
        }));

        searchFilter.push(search.createFilter({
            name: 'name',
            operator: search.Operator.IS,
            values: loc
        }));

        searchColumns.push(search.createColumn({
            name: 'internalid'
        }));

        var Results = search.create({
            type: 'classification',
            filters: searchFilter,
            columns: searchColumns
        }).run().getRange(0, 1000);
        log.debug('Search Result department', Results);
        log.debug('Search Length department', Results.length);

        return Results;
    }



    function SchoolYearSearch(loc) {
        var searchFilter = [];
        var searchColumns = [];

        searchFilter.push(search.createFilter({
            name: 'isinactive',
            operator: search.Operator.IS,
            values: false
        }));

        searchFilter.push(search.createFilter({
            name: 'name',
            operator: search.Operator.CONTAINS,
            values: loc
        }));

        searchColumns.push(search.createColumn({
            name: 'internalid'
        }));

        var Results = search.create({
            type: 'customrecord_cseg__tip_sycseg',
            filters: searchFilter,
            columns: searchColumns
        }).run().getRange(0, 1000);
        log.debug('Search Result department', Results);
        log.debug('Search Length department', Results.length);

        return Results;
    }


    function departmentSearch(loc) {
        var searchFilter = [];
        var searchColumns = [];

        searchFilter.push(search.createFilter({
            name: 'isinactive',
            operator: search.Operator.IS,
            values: false
        }));

        searchFilter.push(search.createFilter({
            name: 'name',
            operator: search.Operator.IS,
            values: loc
        }));

        searchColumns.push(search.createColumn({
            name: 'internalid'
        }));

        var Results = search.create({
            type: 'department',
            filters: searchFilter,
            columns: searchColumns
        }).run().getRange(0, 1000);
        log.debug('Search Result department', Results);
        log.debug('Search Length department', Results.length);

        return Results;
    }


    function locationSearch(loc) {
        var searchFilter = [];
        var searchColumns = [];

        searchFilter.push(search.createFilter({
            name: 'isinactive',
            operator: search.Operator.IS,
            values: false
        }));

        searchFilter.push(search.createFilter({
            name: 'name',
            operator: search.Operator.IS,
            values: loc
        }));

        searchColumns.push(search.createColumn({
            name: 'internalid'
        }));

        var Results = search.create({
            type: 'location',
            filters: searchFilter,
            columns: searchColumns
        }).run().getRange(0, 1000);
        log.debug('Search Result location', Results);
        log.debug('Search Length location', Results.length);

        return Results;
    }


    function accountSearch(acc) {
        var searchFilter = [];
        var searchColumns = [];

        searchFilter.push(search.createFilter({
            name: 'isinactive',
            operator: search.Operator.IS,
            values: false
        }));

        searchFilter.push(search.createFilter({
            name: 'number',
            operator: search.Operator.IS,
            values: acc
        }));

        searchColumns.push(search.createColumn({
            name: 'internalid'
        }));

        var Results = search.create({
            type: 'account',
            filters: searchFilter,
            columns: searchColumns
        }).run().getRange(0, 1000);
        log.debug('Search Result', Results);
        log.debug('Search Length', Results.length);

        return Results;
    }

    function createError(error, enr_refno, student_number, jsonData, filename, custRecordId) {
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
            value: JSON.stringify(error)
        });

        if (enr_refno != '' && enr_refno != null && enr_refno != undefined) {
            errorCatcherObj.setValue({
                fieldId: 'custrecord_tip_integration_trans_id',
                value: enr_refno
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

        if (custRecordId != '' && custRecordId != null && custRecordId != undefined) {
            var outputUrl = url.resolveRecord({
                recordType: 'customrecord_tip_journal_voucher',
                recordId: custRecordId
            });
            errorCatcherObj.setValue({
                fieldId: 'custrecord_tip_custrecordid_error',
                value: outputUrl
            });
        }
        errorCatcherObj.save();
        return;
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

        searchStudColumns.push(search.createColumn({
            name: 'category'
        }));

        var studentResults = search.create({
            type: 'customer',
            filters: searchStudFilter,
            columns: searchStudColumns
        }).run().getRange(0, 1000);
        log.debug('Student Search Result', studentResults);
        log.debug('Student Search Length', studentResults.length);

        return studentResults;

    }



    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce
    };

});
