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
define([
	"N/record",
	"N/search",
	"N/log",
	"N/file",
	"N/runtime",
	"N/url",
	"N/transaction",
], function (record, search, log, file, runtime, url, transaction) {
	function getInputData(context) {
		try {
			var data = [];
			var jsonfilename = "";

			var getJSONData = searchUnprocessedRequests();
			log.debug("getJSONData", getJSONData);
			if (getJSONData.length > 0) {
				for (var i = 0; i < getJSONData.length; i++) {
					var custRecordId = getJSONData[i];
					data.push({
						custRecordId: custRecordId,
						paymentReservation: "T",
						customrecordtype: "customrecord_tip_payment_reservation",
						recordtype: "customerpayment",
					});
				}
			}

			var getJSONDataNonstud = searchUnprocessedNonStudentRequests();

			log.debug("getJSONDataNonstud", getJSONDataNonstud);
			if (getJSONDataNonstud.length > 0) {
				for (var i = 0; i < getJSONDataNonstud.length; i++) {
					var custRecordId = getJSONDataNonstud[i];
					data.push({
						custRecordId: custRecordId,
						paymentReservation: "F",
						customrecordtype: "customrecord_tip_payment_nonstud_data",
						recordtype: "Cashsales",
					});
				}
			}

			var getJSONDataPayment = searchUnprocessedPaymentRequests();

			log.debug("getJSONDataPayment", getJSONDataPayment);
			if (getJSONDataPayment.length > 0) {
				for (var i = 0; i < getJSONDataPayment.length; i++) {
					var custRecordId = getJSONDataPayment[i];
					data.push({
						custRecordId: custRecordId,
						paymentReservation: "F",
						customrecordtype: "customrecord_tip_payment_data",
						recordtype: "customerpayment",
					});
				}
			}

			if (data.length > 0) {
				return data;
			}
		} catch (e) {
			createError("Invalid JSON" + " " + e, "", "", "", jsonfilename);
		}
	}

	function map(context) {
		log.debug("contextmap", context);
		var jsondata = JSON.parse(context.value);
		log.debug("jsondata", jsondata);
		var custRecordId = jsondata.custRecordId;
		var recordtype = jsondata.recordtype;
		var customrecordtype = jsondata.customrecordtype;
		var paymentReservation = jsondata.paymentReservation;
		log.debug("recordtype", recordtype);
		log.debug("custRecordId", custRecordId);
		var lookup = search.lookupFields({
			type: customrecordtype,
			id: custRecordId,
			columns: ["file.name", "file.internalid"],
		});
		log.debug("lookup", lookup);

		var filename = lookup["file.name"];
		var jsonfilename = filename;
		var fileID = lookup["file.internalid"][0].text;
		var fileObj = file.load({
			id: fileID,
		});

		var resultData = JSON.parse(fileObj.getContents());

		if (customrecordtype == "customrecord_tip_payment_reservation") {
			record.submitFields({
				type: customrecordtype,
				id: custRecordId,
				values: {
					custrecord_tip_payment_reserv_process: true,
				},
			});
		} else if (customrecordtype == "customrecord_tip_payment_nonstud_data") {
			record.submitFields({
				type: customrecordtype,
				id: custRecordId,
				values: {
					custrecord_tip_payment_nonstud_process: true,
				},
			});
		} else {
			record.submitFields({
				type: customrecordtype,
				id: custRecordId,
				values: {
					custrecord_tip_payment_data_processed: true,
				},
			});
		}

		log.debug("resultData", resultData);
		if (Array.isArray(resultData)) {
			// log.debug("resultData", resultData);
			for (var k = 0; k < resultData.length; k++) {
				var paymentData = resultData[k];
				log.debug("paymentData", paymentData.payment_info);
				context.write({
					key:
						jsonfilename +
						"_" +
						Math.floor(Math.random() * 1000000000000000 + 1) +
						Math.floor(Math.random() * 1000000000000000 + 1),
					value: {
						custRecordId: custRecordId,
						paymentData: paymentData.payment_info,
						paymentReservation: paymentReservation,
						filename: jsonfilename,
						recordtype: recordtype,
						customrecordtype: customrecordtype,
					},
				});
			}
		} else {
			var paymentData = resultData;
			log.debug("paymentData", paymentData.payment_info);

			context.write({
				key:
					jsonfilename +
					"_" +
					Math.floor(Math.random() * 1000000000000000 + 1) +
					"_1",
				value: {
					custRecordId: custRecordId,
					paymentData: paymentData.payment_info,
					paymentReservation: paymentReservation,
					filename: jsonfilename,
					recordtype: recordtype,
					customrecordtype: customrecordtype,
				},
			});
		}
	}

	function reduce(context) {
		try {
			log.debug("context.key", context.key);
			log.debug("context.Value", context);
			log.debug("context.Value", context.values);

			var jsonlength = context.values;
			log.debug("jsonlength", jsonlength.length);
			for (var g = 0; g < jsonlength.length; g++) {
				var jsondata = JSON.parse(context.values[g]);
				var recordtype = jsondata.recordtype;
				var data = jsondata.paymentData;
				var custRecordId = jsondata.custRecordId;
				var customrecordtype = jsondata.customrecordtype;
				var paymentReservation = jsondata.paymentReservation;
				var filename = jsondata.filename;
				log.debug("Data in Map", data);
				var txn_no = data.txn_no;
				log.debug("Get Payment ID", txn_no);
				// var student_number ="";

				if (recordtype == "Cashsales") {
					var existinggetRefNoSearchResult = searchExistingPayment(txn_no);
				} else if (recordtype == "journal") {
					var existinggetRefNoSearchResult = searchExistingJV(txn_no);
				} else {
					var existinggetRefNoSearchResult =
						searchExistingCustomerPayment(txn_no);
				}
				log.debug(
					"Existing Payment found==>",
					JSON.stringify(existinggetRefNoSearchResult)
				);

				if (existinggetRefNoSearchResult.length > 0) {
					var existingPaymentID =
						existinggetRefNoSearchResult[0].getValue("internalid");
					createError(
						"Record Already exists",
						txn_no,
						"",
						"",
						filename,
						custRecordId,
						customrecordtype
					);
					log.debug("Existing Payment ID", existingPaymentID);
				}

				if (existinggetRefNoSearchResult.length == 0) {
					var createCreditMemoRec = createPaymentRecord(
						data,
						recordtype,
						paymentReservation,
						filename,
						custRecordId,
						customrecordtype
					);
					if (createCreditMemoRec)
						log.debug("Payment Created", createCreditMemoRec);
				}
				log.debug(
					"governence limit",
					runtime.getCurrentScript().getRemainingUsage()
				);
			}
		} catch (e) {
			log.error("error reduce", e);
		}
	}


	function getExistingJV(getRefID) {
		var searchFilter = [];
		var searchColumns = [];

		searchFilter.push(
			search.createFilter({
				name: "mainline",
				operator: search.Operator.IS,
				values: true,
			})
		);

		searchFilter.push(
			search.createFilter({
				name: "numbertext",
				operator: search.Operator.IS,
				values: getRefID,
			})
		);

		searchFilter.push(
			search.createFilter({
				name: "type",
				operator: search.Operator.ANYOF,
				values: "Journal",
			})
		);

		searchColumns.push(
			search.createColumn({
				name: "internalid",
			})
		);

		log.debug("Search Result");

		var Results = search
			.create({
				type: "journalentry",
				filters: searchFilter,
				columns: searchColumns,
			})
			.run()
			.getRange(0, 1000);

		log.debug("Search Result", Results);
		log.debug("Search Length", Results.length);
		return Results;
	}

	function searchExistingJV(getRefID) {
		var searchFilter = [];
		var searchColumns = [];

		searchFilter.push(
			search.createFilter({
				name: "mainline",
				operator: search.Operator.IS,
				values: true,
			})
		);

		searchFilter.push(
			search.createFilter({
				name: "numbertext",
				operator: search.Operator.IS,
				values: getRefID,
			})
		);

		searchFilter.push(
			search.createFilter({
				name: "type",
				operator: search.Operator.ANYOF,
				values: "Journal",
			})
		);

		searchColumns.push(
			search.createColumn({
				name: "internalid",
			})
		);

		log.debug("Search Result");

		var Results = search
			.create({
				type: "journalentry",
				filters: searchFilter,
				columns: searchColumns,
			})
			.run()
			.getRange(0, 1000);

		log.debug("Search Result", Results);
		log.debug("Search Length", Results.length);
		return Results;
	}

	function searchUnprocessedPaymentRequests() {
		var recordIds = [];
		var startIndex = 0;

		//To search data if more than 1000
		do {
			var searchPaymentFilter = [];
			var searchPaymentColumns = [];

			searchPaymentFilter.push(
				search.createFilter({
					name: "isinactive",
					operator: search.Operator.IS,
					values: false,
				})
			);

			searchPaymentFilter.push(
				search.createFilter({
					name: "custrecord_tip_payment_data_processed",
					operator: search.Operator.IS,
					values: false,
				})
			);

			searchPaymentColumns.push(
				search.createColumn({
					name: "internalid",
				})
			);

			var result = search
				.create({
					type: "customrecord_tip_payment_data",
					filters: searchPaymentFilter,
					columns: searchPaymentColumns,
				})
				.run()
				.getRange({ start: startIndex, end: startIndex + 1000 });

			log.debug("results", result);
			for (var i = 0; i < result.length; i++) {
				var custom_id = result[i].getValue("internalid");
				recordIds.push(custom_id);
			}
			startIndex += 1000;
		} while (result.length >= 1000);

		return recordIds;
	}

	function searchUnprocessedNonStudentRequests() {
		var recordIds = [];
		var startIndex = 0;

		//To search data if more than 1000
		do {
			var searchPaymentFilter = [];
			var searchPaymentColumns = [];

			searchPaymentFilter.push(
				search.createFilter({
					name: "isinactive",
					operator: search.Operator.IS,
					values: false,
				})
			);

			searchPaymentFilter.push(
				search.createFilter({
					name: "custrecord_tip_payment_nonstud_process",
					operator: search.Operator.IS,
					values: false,
				})
			);

			searchPaymentColumns.push(
				search.createColumn({
					name: "internalid",
				})
			);

			var result = search
				.create({
					type: "customrecord_tip_payment_nonstud_data",
					filters: searchPaymentFilter,
					columns: searchPaymentColumns,
				})
				.run()
				.getRange({ start: startIndex, end: startIndex + 1000 });

			log.debug("results", result);
			for (var i = 0; i < result.length; i++) {
				var custom_id = result[i].getValue("internalid");
				recordIds.push(custom_id);
			}
			startIndex += 1000;
		} while (result.length >= 1000);

		return recordIds;
	}

	function searchExistingCustomerPayment(getRefID) {
		var searchFilter = [];
		var searchColumns = [];

		searchFilter.push(
			search.createFilter({
				name: "mainline",
				operator: search.Operator.IS,
				values: true,
			})
		);

		searchFilter.push(
			search.createFilter({
				name: "numbertext",
				operator: search.Operator.IS,
				values: getRefID,
			})
		);

		searchFilter.push(
			search.createFilter({
				name: "type",
				operator: search.Operator.ANYOF,
				values: "CustPymt",
			})
		);

		searchColumns.push(
			search.createColumn({
				name: "internalid",
			})
		);

		log.debug("Search Result");

		var Results = search
			.create({
				type: "customerpayment",
				filters: searchFilter,
				columns: searchColumns,
			})
			.run()
			.getRange(0, 1000);

		log.debug("Search Result", Results);
		log.debug("Search Length", Results.length);
		return Results;
	}

	function searchExistingPayment(getRefID) {
		var searchFilter = [];
		var searchColumns = [];

		searchFilter.push(
			search.createFilter({
				name: "mainline",
				operator: search.Operator.IS,
				values: true,
			})
		);

		searchFilter.push(
			search.createFilter({
				name: "numbertext",
				operator: search.Operator.IS,
				values: getRefID,
			})
		);

		searchFilter.push(
			search.createFilter({
				name: "type",
				operator: search.Operator.ANYOF,
				values: "CashSale",
			})
		);

		searchColumns.push(
			search.createColumn({
				name: "internalid",
			})
		);

		log.debug("Search Result");

		var Results = search
			.create({
				type: "cashsale",
				filters: searchFilter,
				columns: searchColumns,
			})
			.run()
			.getRange(0, 1000);

		log.debug("Search Result", Results);
		log.debug("Search Length", Results.length);
		return Results;
	}

	function searchProject(getProject) {
		var searchFilter = [];
		var searchColumns = [];

		log.debug("Project", getProject);

		searchFilter.push(
			search.createFilter({
				name: "name",
				operator: search.Operator.IS,
				values: getProject,
			})
		);

		searchColumns.push(
			search.createColumn({
				name: "internalid",
			})
		);

		log.debug("Search Result Project");

		var Results = search
			.create({
				type: "customrecord_tip_project",
				filters: searchFilter,
				columns: searchColumns,
			})
			.run()
			.getRange(0, 1000);

		log.debug("Search Result Project", Results);
		log.debug("Search Length project", Results.length);
		return Results;
	}

	function createPaymentRecord(
		jsonData,
		recordtype,
		paymentReservation,
		fileName,
		custRecordId,
		customrecordtype
	) {
		try {
			var myEnvType = runtime.envType;
			var accAvailable = true;
			var auto_pay = true;
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
			var project_id;

			var projectID;
			var name;
			var particulars;
			var cancelled;

			var is_nonstudent = false;

			var netsuite_program = jsonData.netsuite_program;

			if (jsonData.hasOwnProperty("name")) {
				name = jsonData.name;
			}

			if (jsonData.hasOwnProperty("type")) {
				type = jsonData.type;
			}
			if (jsonData.hasOwnProperty("student_type")) {
				student_type = jsonData.student_type;
			}
			if (jsonData.hasOwnProperty("student_type_desc")) {
				student_type_desc = jsonData.student_type_desc;
			}
			if (jsonData.hasOwnProperty("program_id")) {
				program_id = jsonData.program_id;
			}
			if (jsonData.hasOwnProperty("program")) {
				program = jsonData.program;
			}
			if (jsonData.hasOwnProperty("program_long")) {
				program_long = jsonData.program_long;
			}
			if (jsonData.hasOwnProperty("curr_year")) {
				curr_year = jsonData.curr_year;
			}
			if (jsonData.hasOwnProperty("batchcode")) {
				batchcode = jsonData.batchcode;
			}
			if (jsonData.hasOwnProperty("year_level")) {
				year_level = jsonData.year_level;
			}
			if (jsonData.hasOwnProperty("year_level_desc")) {
				year_level_desc = jsonData.year_level_desc;
			}
			if (jsonData.hasOwnProperty("netsuite_program")) {
				netsuite_program = jsonData.netsuite_program;
			}
			if (jsonData.hasOwnProperty("jv_bank")) {
				jv_bank = jsonData.jv_bank;
			}

			if (jsonData.hasOwnProperty("project_id")) {
				project_id = jsonData.project_id;
			}

			if (jsonData.hasOwnProperty("cancelled")) {
				cancelled = jsonData.cancelled
			}

			var item_present = true;
			var entityId = searchExistingStudents(student_number);
			log.debug("entityId", entityId);

			if (entityId.length <= 0) {
				createError(
					"Entity is Invalid/Not Available in netsuite instance",
					enr_refno,
					student_number,
					jsonData,
					fileName,
					custRecordId,
					customrecordtype
				);
			}

			log.debug("entityId", entityId);
			if (entityId.length > 0) var intid = entityId[0].getValue("internalid");
			log.debug("entityId", intid);

			if (recordtype == "Cashsales") {
				var newRecord = record.create({
					type: "cashsale",
					isDynamic: true,
				});

				newRecord.setValue({
					fieldId: "customform",
					value: "126",
				});
			} else if (recordtype == "journal") {
				var newRecord = record.create({
					type: "journalentry",
					isDynamic: true,
				});

				newRecord.setValue({
					fieldId: "customform",
					value: "109",
				});

				newRecord.setValue({
					fieldId: "subsidiary",
					value: "2",
				});

				// Set reference to custom record
				if (custRecordId != '' && custRecordId != null && custRecordId != undefined) {
					newRecord.setValue({
						fieldId: "custbody8",
						value: custRecordId,
					});
				}
			} else {
				var newRecord = record.create({
					type: "customerpayment",
					isDynamic: true,
				});

				newRecord.setValue({
					fieldId: "customform",
					value: "125",
				});

				// Set reference to custom record
				if (custRecordId != '' && custRecordId != null && custRecordId != undefined) {
					newRecord.setValue({
						fieldId: "custbody9",
						value: custRecordId,
					});
				}
			}

			if (recordtype == "Cashsales") {
				if (entityId != "" && entityId != null && entityId != undefined) {
					newRecord.setValue({
						fieldId: "entity",
						value: intid,
					});
				}
			} else if (recordtype != "journal") {
				if (entityId != "" && entityId != null && entityId != undefined) {
					newRecord.setValue({
						fieldId: "customer",
						value: intid,
					});
				}
			}

			if (program_id != "" && program_id != null && program_id != undefined) {
				newRecord.setValue({
					fieldId: "custbody_softype_sis_progid",
					value: program_id,
				});
			}

			if (recordtype != "journal") {
				if (campus != "" && campus != null && campus != undefined) {
					var objField = newRecord.getField({ fieldId: "location" });
					log.debug("location", objField);
					var options = objField.getSelectOptions({
						filter: campus,
						operator: "is",
					});

					log.debug("campus", campus);
					log.debug("options", options);
					log.debug("options[0].value", options[0].value);
					newRecord.setValue({
						fieldId: "location",
						value: options[0].value,
					});
				}
			}

			if (recordtype != "journal") {
				if (
					netsuite_program != "" &&
					netsuite_program != null &&
					netsuite_program != undefined
				) {
					log.debug("department");
					var objField = newRecord.getField({ fieldId: "department" });
					var options = objField.getSelectOptions({
						filter: netsuite_program,
						operator: "is",
					});
					log.debug("options", options);
					log.debug("options[0].value", options[0].value);

					newRecord.setValue({
						fieldId: "department",
						value: options[0].value,
					});
				}
			}

			if (
				program_long != "" &&
				program_long != null &&
				program_long != undefined
			) {
				newRecord.setValue({
					fieldId: "custbody_softype_sis_progdesc",
					value: program_long,
				});
			}

			if (date != "" && date != null && date != undefined) {
				newRecord.setValue({
					fieldId: "trandate",
					value: new Date(date),
				});
			}

			if (time != "" && time != null && time != undefined) {
				newRecord.setValue({
					fieldId: "custbodysoftype_sis_transtime",
					value: time,
				});
			}

			if (
				program_long != "" &&
				program_long != null &&
				program_long != undefined
			) {
				newRecord.setValue({
					fieldId: "custbody_softype_sis_progdesc",
					value: program_long,
				});
			}

			if (batchcode != "" && batchcode != null && batchcode != undefined) {
				newRecord.setValue({
					fieldId: "custbody_softype_sis_batchcode",
					value: batchcode,
				});
			}

			if (curr_year != "" && curr_year != null && curr_year != undefined) {
				newRecord.setValue({
					fieldId: "custbody_softype_sis_curryear",
					value: curr_year,
				});
			}

			if (teller_id != "" && teller_id != null && teller_id != undefined) {
				newRecord.setValue({
					fieldId: "custbody_softype_sis_tellerid",
					value: teller_id,
				});
			}

			if (year_level != "" && year_level != null && year_level != undefined) {
				newRecord.setValue({
					fieldId: "custbody_softype_sis_yrlevel",
					value: year_level,
				});
			}

			if (recordtype != "journal") {
				if (
					year_level_desc != "" &&
					year_level_desc != null &&
					year_level_desc != undefined
				) {
					log.debug("year_level_desc", year_level_desc);
					var objField = newRecord.getField({ fieldId: "class" });
					var options = objField.getSelectOptions({
						filter: year_level_desc,
						operator: "is",
					});
					log.debug("options", options);
					log.debug("options[0].value", options[0].value);

					newRecord.setValue({
						fieldId: "class",
						value: options[0].value,
					});
				}
			}

			if (recordtype == "Cashsales") {
				if (name != "" && name != null && name != undefined) {
					newRecord.setValue({
						fieldId: "custbody_sis_integr_cashsale_wname",
						value: name,
					});
				}
			}

			if (recordtype == "Cashsales") {
				if (
					student_type != "" &&
					student_type != null &&
					student_type != undefined
				) {
					newRecord.setValue({
						fieldId: "custbody_softype_sis_studentype",
						value: student_type,
					});
					is_nonstudent = false;
				} else {
					is_nonstudent = true;
				}
			} else {
				if (
					student_type != "" &&
					student_type != null &&
					student_type != undefined
				) {
					newRecord.setValue({
						fieldId: "custbody_softype_sis_studentype",
						value: student_type,
					});
				}
			}

			if (
				student_type_desc != "" &&
				student_type_desc != null &&
				student_type_desc != undefined
			) {
				newRecord.setValue({
					fieldId: "custbody_softype_sis_studentypedesc",
					value: student_type_desc,
				});
			}

			if (type != "" && type != null && type != undefined) {
				newRecord.setValue({
					fieldId: "custbody_softype_sis_type",
					value: type,
				});
			}

			if (enr_refno != "" && enr_refno != null && enr_refno != undefined) {
				newRecord.setValue({
					fieldId: "tranid",
					value: enr_refno,
				});
			}

			if (p_orno != "" && p_orno != null && p_orno != undefined) {
				newRecord.setValue({
					fieldId: "custbody_softype_sis_orno",
					value: p_orno,
				});
			}

			if (
				cancelled_by != "" &&
				cancelled_by != null &&
				cancelled_by != undefined
			) {
				newRecord.setValue({
					fieldId: "custbody_softype_sis_cancelledby",
					value: cancelled_by,
				});
			}

			if (
				cancelled_date != "" &&
				cancelled_date != null &&
				cancelled_date != undefined
			) {
				newRecord.setValue({
					fieldId: "custbody_softype_sis_datecancelled",
					value: new Date(cancelled_date),
				});
			}

			if (
				cancelled_reason != "" &&
				cancelled_reason != null &&
				cancelled_reason != undefined
			) {
				newRecord.setValue({
					fieldId: "custbody_softype_sis_cancelledreason",
					value: cancelled_reason,
				});
			}

			if (
				online_offsite_payment != "" &&
				online_offsite_payment != null &&
				online_offsite_payment != undefined
			) {
				newRecord.setValue({
					fieldId: "custbody_softype_sis_paymentsite",
					value: online_offsite_payment,
				});
			}

			if (project_id != "" && project_id != null && project_id != undefined) {
				var project_results = searchProject(project_id);
				if (project_results.length > 0) {
					projectID = project_results[0].getValue("internalid");
				}
			}

			if (recordtype == "Cashsales") {
				if (particular.length > 0) {
					for (var i = 0; i < particular.length; i++) {
						if (item_present) {
							if (i == 0) {
								sy1 = particular[i].sy1;
								sem = particular[i].sem;
								sy_sem = particular[i].sy_sem;
								log.debug("sy1", sy1);
								log.debug("sem", sem);
								log.debug("sy_sem", sy_sem);
							}
							var acct_code = particular[i].acct_code;
							var balance = particular[i].amount;

							balance = balance.replace(",", "");

							log.debug("acct_code", acct_code);
							log.debug("acct_code", acct_code);
							log.debug(" balance", balance);
							var searchFilter = [];
							var searchColumns = [];

							searchFilter.push(
								search.createFilter({
									name: "isinactive",
									operator: search.Operator.IS,
									values: false,
								})
							);

							searchFilter.push(
								search.createFilter({
									name: "itemid",
									operator: search.Operator.IS,
									values: acct_code,
								})
							);

							searchColumns.push(
								search.createColumn({
									name: "internalid",
								})
							);

							var Results = search
								.create({
									type: search.Type.ITEM,
									filters: searchFilter,
									columns: searchColumns,
								})
								.run()
								.getRange(0, 1000);
							log.debug("Search Result", Results);
							log.debug("Search Length", Results.length);

							if (Results.length > 0) {
								newRecord.selectNewLine("item");
								newRecord.setCurrentSublistValue(
									"item",
									"item",
									Results[0].getValue("internalid")
								);
								newRecord.setCurrentSublistValue("item", "quantity", 1);
								newRecord.setCurrentSublistValue("item", "amount", balance);
								newRecord.setCurrentSublistValue("item", "grossamt", balance);
								newRecord.setCurrentSublistValue("item", "taxcode", 5);

								if (
									project_id != "" &&
									project_id != null &&
									project_id != undefined
								) {
									if (is_nonstudent) {
										newRecord.setCurrentSublistValue(
											"item",
											"custcol_tip_projects",
											projectID
										);
									}
								}
								newRecord.commitLine("item");
								log.debug("Done");
							} else {
								item_present = false;
								createError(
									acct_code +
									" " +
									"item is Invalid/Not Available in netsuite instance",
									enr_refno,
									student_number,
									jsonData,
									fileName,
									custRecordId,
									customrecordtype
								);
							}
						}
					}
				}
			}

			var amt_cash = 0;
			if (particular.length > 0) {
				for (var l = 0; l < particular.length; l++) {
					if (particular[l].hasOwnProperty("amount")) {
						var amt = particular[l].amount;
						log.debug("Particular amt original", amt);
						amt = amt.replace(",", "");
						log.debug("Particular amt", amt);
						amt_cash += Number(amt);
					}
					var concat_particular;
					if (l == 0) {
						if (particular[l].hasOwnProperty("particulars")) {
							particulars = particular[l].particulars;
						}
					} else {
						if (particular[l].hasOwnProperty("particulars")) {
							concat_particular = particular[l].particulars;
						}
						particulars += "," + concat_particular;
					}
				}

				if (
					particulars != "" &&
					particulars != null &&
					particulars != undefined
				) {
					newRecord.setValue({
						fieldId: "memo",
						value: particulars,
					});
				}
			}

			if (recordtype == "customerpayment") {
				if (paytype.length > 0) {
					var amount_paid;
					var paytype_desc_opt;
					if (paytype[0].hasOwnProperty("paytype_desc")) {
						paytype_desc_opt = paytype[0].paytype_desc;
						paytype_desc_opt = String(paytype_desc_opt).toLowerCase();
					}
					if (
						paytype_desc_opt != "" &&
						paytype_desc_opt != null &&
						paytype_desc_opt != undefined
					) {
						if (paytype_desc_opt == "cash") {
							log.debug("amount_paid else if", amount_paid);
							amount_paid = amt_cash;
						} else if (
							paytype_desc_opt != "check" &&
							paytype_desc_opt != "bdo bills payment otc" &&
							paytype_desc_opt != "landbank online banking otc" &&
							paytype_desc_opt != "direct account online transfers" &&
							paytype_desc_opt != "bukas payment" &&
							paytype_desc_opt != "non-student online transfers - government" &&
							paytype_desc_opt != "non-student online transfers - private" &&
							paytype_desc_opt != "non-student online transfers - individual" &&
							paytype_desc_opt != "credit cards (mas.card & visa)"
						) {
							if (paytype[0].hasOwnProperty("amount")) {
								amount_paid = paytype[0].amount;
							}
							log.debug("amount_paid if", amount_paid);
							amount_paid = amount_paid.replace(",", "");
						} else {
							if (paytype[0].hasOwnProperty("amount_paid")) {
								amount_paid = paytype[0].amount_paid;
							}
							log.debug("amount_paid else", amount_paid);
							amount_paid = amount_paid.replace(",", "");
						}

						log.debug("amount_paid", amount_paid);

						newRecord.setValue({
							fieldId: "payment",
							value: amount_paid,
						});
					}
				}
			}

			if (particular.length > 0) {
				var acc_ref_arr = [];
				var install_no_arr = [];
				for (var i = 0; i < particular.length; i++) {
					if (i == 0) {
						school_year = particular[i].school_year;
						sem = particular[i].sem;
						sy_sem = particular[i].sy_sem;
					}
					var acct_ref_no = particular[i].enr_refno;
					if (acct_ref_no != "0") {
						var acct_code = particular[i].acct_code;
						var balance = particular[i].amount;

						balance = balance.replace(",", "");
						log.debug("acct_code", acct_code);
						log.debug(" balance", balance);

						var searchFilterInv = [];
						var searchColumnsInv = [];

						searchFilterInv.push(
							search.createFilter({
								name: "mainline",
								operator: search.Operator.IS,
								values: true,
							})
						);

						searchFilterInv.push(
							search.createFilter({
								name: "numbertext",
								operator: search.Operator.IS,
								values: acct_ref_no,
							})
						);

						searchFilterInv.push(
							search.createFilter({
								name: "type",
								operator: search.Operator.ANYOF,
								values: "CustInvc",
							})
						);

						searchColumnsInv.push(
							search.createColumn({
								name: "internalid",
							})
						);

						searchColumnsInv.push(
							search.createColumn({
								name: "terms",
							})
						);

						log.audit("Search Result");

						var ResultsInv = search
							.create({
								type: "invoice",
								filters: searchFilterInv,
								columns: searchColumnsInv,
							})
							.run()
							.getRange(0, 1000);

						log.audit("Search ResultsInv", ResultsInv);
						log.audit("Search ResultsInv Length", ResultsInv.length);

						if (ResultsInv.length > 0) {
							var terms_inv = ResultsInv[0].getValue("terms");
							if (
								terms_inv != "" &&
								terms_inv != null &&
								terms_inv != undefined
							) {
								var searchFilter = [];
								var searchColumns = [];

								searchFilter.push(
									search.createFilter({
										name: "isinactive",
										operator: search.Operator.IS,
										values: false,
									})
								);

								searchFilter.push(
									search.createFilter({
										name: "custrecord_sis_map_acctcode",
										operator: search.Operator.IS,
										values: acct_code,
									})
								);

								searchFilter.push(
									search.createFilter({
										name: "custrecord_sis_map_instparent",
										operator: search.Operator.IS,
										values: terms_inv,
									})
								);

								searchColumns.push(
									search.createColumn({
										name: "custrecord_sis_map_instno",
									})
								);

								var Results = search
									.create({
										type: "customrecord_sis_installmentmap",
										filters: searchFilter,
										columns: searchColumns,
									})
									.run()
									.getRange(0, 1000);
								log.debug("Search Result", Results);
								log.debug("Search Length", Results.length);

								if (Results.length > 0) {
									var numLines = newRecord.getLineCount({
										sublistId: "apply",
									});
									log.debug("numLines", numLines);
									if (numLines > 0) {
										for (var k = 0; k < numLines; k++) {
											var refnum = newRecord.getSublistValue({
												sublistId: "apply",
												fieldId: "refnum",
												line: k,
											});

											var installmentnumber = newRecord.getSublistValue({
												sublistId: "apply",
												fieldId: "installmentnumber",
												line: k,
											});

											log.debug("installmentnumber", installmentnumber);
											log.debug(
												"Results[0].getValue",
												Results[0].getValue("custrecord_sis_map_instno")
											);
											log.debug(
												"Results[0].getValue",
												acct_ref_no + " " + refnum
											);

											if (
												installmentnumber ==
												Results[0].getValue("custrecord_sis_map_instno") &&
												refnum == acct_ref_no
											) {
												acc_ref_arr.push(acct_ref_no);
												install_no_arr.push(installmentnumber);
												newRecord.selectLine({
													sublistId: "apply",
													line: k,
												});

												newRecord.setCurrentSublistValue({
													sublistId: "apply",
													fieldId: "apply",
													value: true,
												});

												newRecord.setCurrentSublistValue({
													sublistId: "apply",
													fieldId: "amount",
													value: balance,
												});

												newRecord.commitLine({
													sublistId: "apply",
												});

												log.debug("In apply");
											}
										}
									}
								}
							}
						}
					}
				}
			}

			if (
				school_year != "" &&
				school_year != null &&
				school_year != undefined
			) {
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

			if (sem != "" && sem != null && sem != undefined) {
				newRecord.setValue({
					fieldId: "custbody_softype_sis_acadterm",
					value: sem,
				});
			}

			if (sy_sem != "" && sy_sem != null && sy_sem != undefined) {
				newRecord.setValue({
					fieldId: "custbody_softype_sis_syandsem",
					value: sy_sem,
				});
			}

			var jv_bank_notfound = true;
			var payment_option_notfound = false;
			if (paytype.length > 0) {
				var paytype_desc;
				var jv_bank;

				if (paytype[0].hasOwnProperty("jv_bank")) {
					jv_bank = paytype[0].jv_bank;
				}

				if (paytype[0].hasOwnProperty("paytype_desc")) {
					paytype_desc = paytype[0].paytype_desc;
				}

				var proc_id;
				var check_no;
				var check_date;
				var approval_no;
				if (paytype[0].hasOwnProperty("proc_id")) {
					proc_id = paytype[0].proc_id;
				}

				if (paytype[0].hasOwnProperty("check_no")) {
					check_no = paytype[0].check_no;
				}

				if (paytype[0].hasOwnProperty("check_date")) {
					check_date = paytype[0].check_date;
				}

				if (paytype[0].hasOwnProperty("approval_no")) {
					approval_no = paytype[0].approval_no;
				}

				if (proc_id != "" && proc_id != null && proc_id != undefined) {
					newRecord.setValue({
						fieldId: "custbody_st_sis_for_schaprcode",
						value: proc_id,
					});
				}
				if (check_no != "" && check_no != null && check_no != undefined) {
					newRecord.setValue({
						fieldId: "custbody_st_sis_for_checkno",
						value: check_no,
					});
				}
				if (check_date != "" && check_date != null && check_date != undefined) {
					newRecord.setValue({
						fieldId: "custbody_st_sis_for_checkdate",
						value: new Date(check_date),
					});
				}
				if (
					approval_no != "" &&
					approval_no != null &&
					approval_no != undefined
				) {
					newRecord.setValue({
						fieldId: "custbody_st_sis_for_ccapprovalcode",
						value: approval_no,
					});
				}

				if (
					paytype_desc != "" &&
					paytype_desc != null &&
					paytype_desc != undefined
				) {
					log.debug("options paymentoption", paytype_desc);
					var objField = newRecord.getField({ fieldId: "paymentoption" });
					var options = objField.getSelectOptions({
						filter: paytype_desc,
						operator: "is",
					});
					log.debug("options paymentoption", options);
					log.debug("options CUSTPAYMENT", options);
					if (options.length > 0) {
						newRecord.setValue({
							fieldId: "paymentoption",
							value: options[0].value,
						});
						payment_option_notfound = true;
					} else {
						createError(
							"Payment Option is invalid/not found",
							enr_refno,
							student_number,
							jsonData,
							fileName,
							custRecordId,
							customrecordtype
						);
						payment_option_notfound = false;
					}
				} else {
					createError(
						"Payment Option is Empty",
						enr_refno,
						student_number,
						jsonData,
						fileName,
						custRecordId,
						customrecordtype
					);
					payment_option_notfound = false;
				}

				if (jv_bank != "" && jv_bank != null && jv_bank != undefined) {
					log.debug("jv_bank");
					var results = accountSearch(jv_bank);

					if (results.length > 0) {
						newRecord.setValue({
							fieldId: "account",
							value: results[0].getValue("internalid"),
						});

						log.debug("set_jv_bank", results[0].getValue("internalid"));

						jv_bank_notfound = true;
					} else {
						log.debug("jv_bank_notfound", jv_bank_notfound);
						createError(
							"JV_Bank is invalid/not found",
							enr_refno,
							student_number,
							jsonData,
							fileName,
							custRecordId,
							customrecordtype
						);
						jv_bank_notfound = false;
					}
				}
			}

			log.debug("auto_pay", auto_pay);
			if (recordtype == "customerpayment" && paymentReservation == "F") {
				log.debug("auto_pay", auto_pay);
				if (auto_pay) {
					var inv_results = searchInvoiceForAutoApply(intid);
					if (inv_results.length > 0) {
						var numLines = newRecord.getLineCount({
							sublistId: "apply",
						});
						for (var k = 0; k < inv_results.length; k++) {
							var status_installment = inv_results[k].getValue({
								name: "status",
								join: "installment",
							});
							if (status_installment != "paid") {
								var installment_no = inv_results[k].getValue({
									name: "installmentnumber",
									join: "installment",
								});
								var refnum_tocheck = inv_results[k].getValue({
									name: "tranid",
								});
								for (var m = 0; m < numLines; m++) {
									var refnum = newRecord.getSublistValue({
										sublistId: "apply",
										fieldId: "refnum",
										line: m,
									});

									var inst_no = newRecord.getSublistValue({
										sublistId: "apply",
										fieldId: "installmentnumber",
										line: m,
									});

									if (installment_no) {
										if (installment_no == inst_no && refnum == refnum_tocheck) {
											if (!install_no_arr.includes(inst_no)) {
												newRecord.selectLine({
													sublistId: "apply",
													line: m,
												});
												newRecord.setCurrentSublistValue({
													sublistId: "apply",
													fieldId: "apply",
													value: true,
												});

												newRecord.commitLine({
													sublistId: "apply",
												});
											}
										}
									} else {
										if (refnum == refnum_tocheck) {
											newRecord.selectLine({
												sublistId: "apply",
												line: m,
											});
											newRecord.setCurrentSublistValue({
												sublistId: "apply",
												fieldId: "apply",
												value: true,
											});

											newRecord.commitLine({
												sublistId: "apply",
											});
										}
									}
								}
							}
						}
					}
				}
			}

			if (recordtype == "journal") {
				if (accAvailable) {
					newRecord.setValue({
						fieldId: "approvalstatus",
						value: 2,
					});

					var recordid = newRecord.save({
						enableSourcing: true,
						ignoreMandatoryFields: true,
					});
					log.debug("recordid", recordid);
					log.debug("Details", "New Journal Created Successfully==>", recordid);
				} else {
					createError(
						acc_notfound + " " + "Account is invalid/not found",
						enr_refno,
						student_number,
						jsonData,
						fileName,
						custRecordId,
						customrecordtype
					);
				}
			} else {
				if (item_present) {
					if (jv_bank_notfound) {
						if (payment_option_notfound) {
							log.debug("newrecord data", newRecord);
							var recordid = newRecord.save({
								enableSourcing: true,
								ignoreMandatoryFields: true,
							});
							log.debug("recordid", recordid);
							log.debug("New payment Created Successfully==>", recordid);

							//to void the transaction
							log.debug("cancelled", cancelled);
							if (recordid) {
								if (cancelled != "" && cancelled != null && cancelled != undefined) {

									if (recordtype == "customerpayment") {
										if (cancelled == "Y") {
											var voidPaymentId = transaction.void({
												type: 'customerpayment',
												id: recordid
											});

											log.debug("voided", voidPaymentId);

											var jvResults = getExistingJV(enr_refno);
											if (jvResults.length > 0) {
												var jv_id = jvResults[0].getValue("internalid");
												var voidJVId = transaction.void({
													type: 'journalentry',
													id: jv_id
												});

												log.debug("JV voided", voidJVId);

											}
										}
									}
								}
							}
						}
					}
				}
			}
		} catch (e) {
			log.debug("error", e);
			createError(
				e,
				enr_refno,
				student_number,
				jsonData,
				fileName,
				custRecordId,
				customrecordtype
			);
			return;
		}
	}

	function searchInvoiceForAutoApply(getStudentID) {
		var searchStudFilter = [];
		var searchStudColumns = [];

		searchStudFilter.push(
			search.createFilter({
				name: "type",
				operator: search.Operator.ANYOF,
				values: "CustInvc",
			})
		);

		searchStudFilter.push(
			search.createFilter({
				name: "status",
				operator: search.Operator.ANYOF,
				values: "CustInvc:A",
			})
		);

		searchStudFilter.push(
			search.createFilter({
				name: "mainline",
				operator: search.Operator.IS,
				values: true,
			})
		);

		searchStudFilter.push(
			search.createFilter({
				name: "mainname",
				operator: search.Operator.ANYOF,
				values: getStudentID,
			})
		);

		searchStudColumns.push(
			search.createColumn({ name: "status", join: "installment" })
		);
		searchStudColumns.push(
			search.createColumn({
				name: "installmentnumber",
				join: "installment",
				sort: search.Sort.ASC,
			})
		);
		searchStudColumns.push(
			search.createColumn({ name: "trandate", sort: search.Sort.ASC })
		);
		searchStudColumns.push(search.createColumn({ name: "tranid" }));

		var studentResults = search
			.create({
				type: "invoice",
				filters: searchStudFilter,
				columns: searchStudColumns,
			})
			.run()
			.getRange(0, 1000);
		log.audit("invoice Search Result", studentResults);
		log.audit("invoice Search Length", studentResults.length);

		return studentResults;
	}

	function accountSearch(acc) {
		var searchFilter = [];
		var searchColumns = [];

		searchFilter.push(
			search.createFilter({
				name: "isinactive",
				operator: search.Operator.IS,
				values: false,
			})
		);

		searchFilter.push(
			search.createFilter({
				name: "number",
				operator: search.Operator.IS,
				values: acc,
			})
		);

		searchColumns.push(
			search.createColumn({
				name: "internalid",
			})
		);

		var Results = search
			.create({
				type: "account",
				filters: searchFilter,
				columns: searchColumns,
			})
			.run()
			.getRange(0, 1000);
		log.debug("Search Result", Results);
		log.debug("Search Length", Results.length);

		return Results;
	}

	function createError(
		error,
		enr_refno,
		student_number,
		jsonData,
		filename,
		custRecordId,
		customrecordtype
	) {
		var errorCatcherObj = record.create({
			type: "customrecord_tip_integration_error_catch",
			isDynamic: true,
		});

		if (error.hasOwnProperty("message")) {
			var errmsg = error.message;
		}

		if (errmsg != "" && errmsg != null && errmsg != undefined) {
			if (errmsg.indexOf("Cannot read property 'value' of undefined") > -1) {
				errorCatcherObj.setValue({
					fieldId: "custrecord_tip_integration_error_msg",
					value:
						"Invalid Campus/NetsuiteProgram/year level/SY1/terms description (Value Not available in Netsuite Instance)",
				});
			} else {
				errorCatcherObj.setValue({
					fieldId: "custrecord_tip_integration_error_msg",
					value: errmsg,
				});
			}
		}

		errorCatcherObj.setValue({
			fieldId: "custrecord_tip_integration_errorfull",
			value: JSON.stringify(error),
		});

		if (enr_refno != "" && enr_refno != null && enr_refno != undefined) {
			errorCatcherObj.setValue({
				fieldId: "custrecord_tip_integration_trans_id",
				value: enr_refno,
			});
		}

		if (jsonData != "" && jsonData != null && jsonData != undefined) {
			errorCatcherObj.setValue({
				fieldId: "custrecord_tip_integration_json_data",
				value: jsonData,
			});
		}

		if (
			custRecordId != "" &&
			custRecordId != null &&
			custRecordId != undefined
		) {
			var outputUrl = url.resolveRecord({
				recordType: customrecordtype,
				recordId: custRecordId,
			});

			errorCatcherObj.setValue({
				fieldId: "custrecord_tip_custrecordid_error",
				value: outputUrl,
			});
		}

		if (filename != "" && filename != null && filename != undefined) {
			errorCatcherObj.setValue({
				fieldId: "custrecord_tip_integration_errorfilename",
				value: filename,
			});
		}
		errorCatcherObj.save();
		return;
	}

	function searchExistingStudents(getStudentID) {
		var searchStudFilter = [];
		var searchStudColumns = [];

		searchStudFilter.push(
			search.createFilter({
				name: "isinactive",
				operator: search.Operator.IS,
				values: false,
			})
		);

		searchStudFilter.push(
			search.createFilter({
				name: "entityid",
				operator: search.Operator.IS,
				values: getStudentID,
			})
		);

		searchStudColumns.push(
			search.createColumn({
				name: "internalid",
			})
		);

		searchStudColumns.push(
			search.createColumn({
				name: "category",
			})
		);

		var studentResults = search
			.create({
				type: "customer",
				filters: searchStudFilter,
				columns: searchStudColumns,
			})
			.run()
			.getRange(0, 1000);
		log.debug("Student Search Result", studentResults);
		log.debug("Student Search Length", studentResults.length);

		return studentResults;
	}

	function searchUnprocessedRequests() {
		var recordIds = [];
		var startIndex = 0;
		do {
			var searchPaymentFilter = [];
			var searchPaymentColumns = [];

			searchPaymentFilter.push(
				search.createFilter({
					name: "isinactive",
					operator: search.Operator.IS,
					values: false,
				})
			);

			searchPaymentFilter.push(
				search.createFilter({
					name: "custrecord_tip_payment_reserv_process",
					operator: search.Operator.IS,
					values: false,
				})
			);

			searchPaymentColumns.push(
				search.createColumn({
					name: "internalid",
				})
			);

			var result = search
				.create({
					type: "customrecord_tip_payment_reservation",
					filters: searchPaymentFilter,
					columns: searchPaymentColumns,
				})
				.run()
				.getRange({ start: startIndex, end: startIndex + 1000 });

			log.debug("results", result);
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
		reduce: reduce,
	};
});
