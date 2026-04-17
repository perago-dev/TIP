/**
 * @NApiVersion 2.x
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

/***************************************************************************************  
 ** Copyright (c) 1998-2020 Softype, Inc.
 ** Ventus Infotech Private Limited, 3012, NIBR Corporate Park 1 Aerocity,Andheri - Kurla Rd, Safed Pul , Saki Naka,, Mumbai INDIA 400 072.
 ** All Rights Reserved.
 ** This software is the confidential and proprietary information of Softype, Inc. ("Confidential Information").
 **You shall not disclose such Confidential Information and shall use it only in accordance with the terms of the license agreement you entered into with Softype.                    
 **                      
 **@Author      :  Akash Chavan
 **@Dated       :  6th Jan, 2023
 **@Version     :  2.x
 **@Description :  TIP credit memo - course adjustment Integration Script.

 ***************************************************************************************/

define(['N/record', 'N/error', 'N/format', 'N/file', 'N/runtime'],
    function (record, error, format, file, runtime) {
        // Create a NetSuite record from request params
        function post(context) {


            var creditMemoData = context;

            log.debug("debitmemo", creditMemoData.length);

            if (Array.isArray(creditMemoData)) {

                var data = creditMemoData[0];
                if (data.hasOwnProperty('credit_memo')) {
                    log.debug("credit_memo", data.credit_memo);
                }
                else {
                    var errorObj = error.create({
                        code: 'Invalid JSON',
                        message: 'Invalid JSON format payload(Please request data with correct JSON format)'
                    });

                    return errorObj;
                }


            }
            else {
                var data = creditMemoData;
                if (data.hasOwnProperty('credit_memo')) {
                    log.debug("credit_memo", data.credit_memo);
                }
                else {
                    var errorObj = error.create({
                        code: 'Invalid JSON',
                        message: 'Invalid JSON format payload(Please request data with correct JSON format)'
                    });

                    return errorObj;
                }
            }

            if (creditMemoData.length > 2000) {
                var errorObj = error.create({
                    code: 'LIMIT EXCEEDED',
                    message: 'Data limit exceeded more than 2000'
                });

                return errorObj;
            }
            else {

                var newRecord = record.create({
                    type: 'customrecord_tip_creditmemo_integration',
                    isDynamic: true
                });

                var today = new Date();
                var formatteddate = gettingexactdate(today);
                var fileName = 'CREDIT_MEMO' + formatteddate + " " + Math.floor((Math.random() * 10000000) + 1) + '.json';
                var fileObj = file.create({
                    name: fileName,
                    fileType: file.Type.JSON,
                    contents: JSON.stringify(context)
                });

                fileObj.folder = 326;
                var fileId = fileObj.save();

                var recordid = newRecord.save();

                var id = record.attach({
                    record: {
                        type: 'file',
                        id: fileId
                    },
                    to: {
                        type: 'customrecord_tip_creditmemo_integration',
                        id: recordid
                    }
                });


                log.debug("governence limit", runtime.getCurrentScript().getRemainingUsage())

                return (JSON.stringify("Success"));

            }
        }


        function gettingexactdate(todaydate) {

            var actual_date = format.format({
                value: todaydate,
                type: format.Type.DATETIME,
                timezone: format.Timezone.ASIA_MANILA
            });

            var splitarray = actual_date.split(' ');
            
            //log.emergency('splitarray', splitarray);

            var actual_split_date = splitarray[0];
            var actual_split_time = splitarray[1];
            //log.emergency('actual_split_date', actual_split_date);

            var date = actual_split_date.split('/');
            //log.emergency('date', date);

            var currentMonth = date[0];
            //log.emergency('currentMonth',currentMonth);

            if (currentMonth < 10) {

                currentMonth = '0' + Number(currentMonth);

            } else {

                currentMonth = currentMonth;
            }

            var ndDate = date[1];
            if (ndDate < 10) {

                ndDate = '0' + Number(ndDate);

            } else {

                ndDate = ndDate;
            }


            var currentYear = date[2];

            var formatteddate = currentMonth + '_' + ndDate + '_' + currentYear+"_"+actual_split_time;

            return formatteddate;

        }
        return {
            post: post
        };
    }); 