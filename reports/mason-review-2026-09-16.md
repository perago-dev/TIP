# Mason Code Health Review — TIP

**Date:** 16 September 2026
**Reviewer:** Mason 2.0.0 via Claude Code
**Branch:** `mason-review-2026-09-16`
**Default branch / commit reviewed:** `master` @ `3b09c03606add795efcabc2c68d0c91e00e2a42c`
**Files audited / total SuiteScript files:** 6 opened in full / 11 total
**Sampling note:** 11 files is well under the 60-file cap, but 4 of them are 84–129KB integration Map/Reduce scripts. All 11 files were deduplicated by content hash (10 unique — the two `ClientScript` copies are byte-identical) and inventoried. 6 of the 10 unique files were opened and read end-to-end: both copies of the duplicate-invoice guard (Client Script + User Event, Production and Sandbox), the RESTlet, and the two mid-sized Map/Reduce scripts (`Journal_integration`, `payment_nonstud_reservation`). The remaining 4 — both copies each of `Softype_MR_creditmemo_debitmemo_enrollwithdrawal.js` and `Softype_MR_Tutbill_Terms_Fullscholar_ChangeinEnroll.js` — were not read line-by-line; they were verified with targeted searches for the two defect patterns found in the smaller scripts (the single-comma amount-parsing bug and the duplicated helper functions), confirming both patterns are present at the same scale. No score claims coverage of logic in those 4 files beyond what those targeted searches verify.
**Standard:** Mason 2.0.0 Code Health Scoring (`modules/code-health-scoring.md`)

---

## Code Health Scores

| Dimension | Before | After |
|---|---|---|
| Security | 5 — Exemplary | not applied |
| Governance | 4 — Strong | not applied |
| Documentation | 2 — Weak | not applied |
| Maintainability | 2 — Weak | not applied |
| Functionality | 2 — Weak | not applied |

This is an assessment-only engagement — no code was changed, so there is no "after" state. Functionality and Maintainability are both scored below their raw weighted-rate calculation: the two Functionality MUSTs are not edge-case gaps but a live control that silently does nothing (F-1) and a money-parsing bug that produces wrong amounts under ordinary real-world values (F-2), and the Maintainability finding is the textbook "pervasive copy-paste" Level-2 indicator from Mason's own rubric, confirmed at repo-wide scale.

## Executive Summary

TIP's SuiteScript is a set of large, single-purpose integration Map/Reduce jobs that pull JSON payloads from custom "unprocessed request" records and turn them into journal entries, cash sales, and customer payments for a school's enrollment/billing system. Two real defects stand out. First, Production's duplicate-invoice guard — the User Event whose entire job is to stop a second invoice from being created against the same enrollment reference — detects the duplicate, writes an error-catcher record, and then logs "Validation Passed" and lets the save proceed anyway, because the `throw` that should abort the save is missing; the Sandbox copy of the exact same file has the `throw` already in place. Second, every money amount parsed from an incoming JSON payload across all six Map/Reduce integration scripts is de-commafied with `.replace(",", "")`, which only removes the *first* comma in a string — a value like `"1,234,567.89"` becomes `"1,234567.89"`, which `Number()` reads as `NaN`. This repeats at roughly 40 call sites across every money field in every book handled by this integration (tuition payments, journal debit/credit lines, cash sale amounts), and there is not one instance of the correct global-replace pattern anywhere in the repo. A third, less severe pattern is heavy duplication: the same ~15 helper functions (`searchExistingStudents`, `createError`, `accountSearch`, `searchExistingCustomerPayment`, `searchExistingJV`) are copy-pasted near-verbatim across up to six separate 1,000–2,000 line scripts rather than factored into one shared module.

## Files Reviewed (6 opened in full, 4 verified via targeted pattern search)

| # | File | Type | Verdict |
|---|---|---|---|
| 1 | `Production/ClientScript/Softype_TIP_CS_ValidateDupeInv.js` | Client Script | Approved w/ Comments |
| 2 | `Production/UserEvent/Softype_TIP_UE_ValidateDupeInv.js` | User Event | Changes Requested |
| 3 | `Sandbox/UserEvent/Softype_TIP_UE_ValidateDupeInv.js` | User Event | Approved |
| 4 | `Sandbox/Restlet/softype_rl_creditmemo_integration.js` | RESTlet | Changes Requested |
| 5 | `Sandbox/MapReduce/Softype_MR_Journal_integration.js` | Map/Reduce | Changes Requested |
| 6 | `Sandbox/MapReduce/Softype_payment_nonstud_reservation_.js` | Map/Reduce | Changes Requested |
| — | `Production/MapReduce/Softype_MR_creditmemo_debitmemo_enrollwithdrawal.js`, `Sandbox/` copy, `Production/MapReduce/Softype_MR_Tutbill_Terms_Fullscholar_ChangeinEnroll.js`, `Sandbox/` copy | Map/Reduce | Pattern-verified only (F-2, M-1 confirmed present) |

## Universal Issues

### [MUST] D-1 — No file carries `@DeployedOn`
0 of 11 files declare `@DeployedOn`.

### [SHOULD] D-2 — 5 of 11 files have no `@Updates`/`@Update` entry
Consistent with the pattern seen across every repo reviewed this cycle.

---

## File-by-File Findings

### `Production/UserEvent/Softype_TIP_UE_ValidateDupeInv.js` vs. `Sandbox/UserEvent/Softype_TIP_UE_ValidateDupeInv.js`

#### [MUST] F-1 — Production's duplicate-invoice guard detects the duplicate, logs it, and then lets the invoice save anyway
```javascript
// Production/UserEvent/Softype_TIP_UE_ValidateDupeInv.js — lines 58-90
if (invoiceSearch.length > 0) {
    const existingInvoiceId = invoiceSearch[0].getValue('internalid');
    const errorMsg = `An invoice with the reference number "${transactionId}" already exists (ID: ${existingInvoiceId}). Duplicate creation is not allowed.`;

    log.debug('DUPLICATE_INVOICE', errorMsg);

    try {
        const invoiceData = { tranid: transactionId, customer: studentNumber, customer_id: customerId, existing_invoice_id: existingInvoiceId };
        createErrorCatcher(errorMsg, transactionId, studentNumber, invoiceData, null, null, 'invoice');
    } catch (e) {
        log.error('Error Catcher Creation Failed', e);
    }

    // Throw error to prevent invoice creation
}

log.debug('Validation Passed', 'No duplicate invoice found. Invoice creation allowed.');
```
The comment says "Throw error to prevent invoice creation," but there is no `throw` there — execution falls through to the unconditional "Validation Passed" log and the record saves normally. This file's own header describes its purpose as "Validate if an invoice with the same enrollment reference (tranid) already exists and create error catcher record" — the error catcher fires, but the validation does not actually validate anything. The Sandbox copy of this exact file has the fix already:
```javascript
// Sandbox/UserEvent/Softype_TIP_UE_ValidateDupeInv.js — same location
    // Throw error to prevent invoice creation
    throw error.create({
        name: 'DUPLICATE_INVOICE',
        message: errorMsg
    });
}
```
The client-side guard (`Softype_TIP_CS_ValidateDupeInv.js`, identical in both Production and Sandbox) does correctly return `false` to block a manual UI save — but that is bypassable by CSV import, SuiteScript, or any path that doesn't run client scripts, which is exactly why a server-side `beforeSubmit` guard exists in the first place. Right now Production's server-side guard is decorative.
**Recommended fix:** Promote the `throw error.create(...)` from the Sandbox copy to Production.

---

### `Sandbox/MapReduce/Softype_MR_Journal_integration.js`, `Softype_payment_nonstud_reservation_.js`, and (confirmed present) both copies of `Softype_MR_creditmemo_debitmemo_enrollwithdrawal.js` and `Softype_MR_Tutbill_Terms_Fullscholar_ChangeinEnroll.js`

#### [MUST] F-2 — Every money amount from an incoming payload is de-commafied with a single-replace, silently corrupting any amount with two or more thousands separators
```javascript
// Softype_MR_Journal_integration.js:144, representative of ~40 call sites across all 6 integration scripts
if (paytype[0].hasOwnProperty('amount_paid')) {
    amountpaid = paytype[0].amount_paid;
    amountpaid = amountpaid.replace(",", "");
}
```
JavaScript's `String.prototype.replace(searchValue, replaceValue)` with a plain string `searchValue` replaces only the *first* match. `"1,234,567.89".replace(",", "")` produces `"1,234567.89"`, which `Number(...)` parses as `NaN`. Every money field this integration reads — payment amounts, journal debit/credit lines (`jv_bank_amount`, `jv_expense_amount`, `jv_otherincome_amount`, `jv_acctrecvable_amount_proc_fee`, `jv_cred_w_tax_amount`), item balances (`balance`) — goes through this same single-replace pattern. A search across the whole repo finds this exact call shape roughly 40 times and the correct global-replace equivalent (`.replace(/,/g, '')`) zero times.
**Recommended fix:** Replace every `.replace(",", "")` on a money string with `.replace(/,/g, '')` (or route all money parsing through one shared helper that does this once, correctly).
**Files affected:** `Softype_MR_Journal_integration.js` (6), `Softype_payment_nonstud_reservation_.js` (5), `Softype_MR_creditmemo_debitmemo_enrollwithdrawal.js` — both copies (8 each), `Softype_MR_Tutbill_Terms_Fullscholar_ChangeinEnroll.js` — both copies (7 each).

---

### `Sandbox/Restlet/softype_rl_creditmemo_integration.js`

#### [SHOULD] M-2 — Hardcoded File Cabinet folder id, and the created record carries no payload data of its own
```javascript
fileObj.folder = 326;
var fileId = fileObj.save();

var recordid = newRecord.save();
```
The folder the incoming JSON is filed into is a literal internal id, not a script parameter — the "no hardcoded ids" convention followed elsewhere in this review cycle's stronger repos is absent here. Separately, `newRecord` (`customrecord_tip_creditmemo_integration`) is created and saved with no `setValue` calls at all; the only link between the record and the actual `credit_memo` payload is the attached JSON file. If this custom record has any searchable/reportable fields, none of them get populated — only the raw JSON is preserved, inside a file, not the record.
**Recommended fix:** Move the folder id to a script parameter; if the custom record has fields meant to hold key payload values (credit memo id, amount, date), populate them from `data.credit_memo` before saving.

---

### All 6 integration Map/Reduce scripts

#### [SHOULD] M-1 — The same ~15 helper functions are copy-pasted across up to six separate 1,000–2,000-line scripts
`searchExistingStudents`, `createError`, `accountSearch`, `searchExistingCustomerPayment`, and `searchExistingJV` (identical or near-identical bodies) are each defined independently in multiple files rather than factored into one shared library module:
```
searchExistingStudents: Production+Sandbox creditmemo_debitmemo, Production+Sandbox Tutbill_Terms, Journal_integration, payment_nonstud_reservation (6 copies)
createError:            same 6 files
accountSearch:          Journal_integration, payment_nonstud_reservation (2 copies; likely more in the 2 files verified only by pattern)
searchExistingCustomerPayment / searchExistingJV: Journal_integration, payment_nonstud_reservation (2 copies each)
```
This is the ≥10-line-block-repeated-3+-times pattern Mason's own maintainability rubric names as a Level-2 (Weak) indicator, here repeated across the majority of the repo's SuiteScript surface. A bug fix or field-mapping change made in one copy (as F-1 already demonstrates happened with the duplicate-invoice guard) has no mechanism to propagate to the others.
**Recommended fix:** Extract the shared search/error-catcher helpers into one SuiteScript library module (`define`-able, no `@NScriptType`) that every integration entry point imports, matching the shared-edge pattern used successfully elsewhere in this review cycle (e.g. `prg-cas`'s `bookEntry.ts`).

---

## Other findings

#### [CONSIDER] G-1 — `getInputData` materializes the full unprocessed-record list as an array rather than returning the search
Each Map/Reduce script's `getInputData` manually pages through its "unprocessed" saved search in a `do`/`while` loop and returns a plain array of ids, rather than returning the `search.Search` object directly (Mason's own `suitescript/patterns/map-reduce.md` recommends the latter "for large datasets" so the platform paginates natively). Unlike a hard governance cap, this pagination loop is implemented correctly and does not silently drop rows past 1,000 — it is a style/robustness note, not a defect.

---

## Since the previous review

`prior_review` on file: none. No `reports/mason-*` file exists on `master`. This is the first Mason review for this repository.

## Summary: Required Actions

1. **[MUST]** Add the missing `throw error.create(...)` to Production's `Softype_TIP_UE_ValidateDupeInv.js` — the fix already exists in the Sandbox copy.
2. **[MUST]** Replace every `.replace(",", "")` on a parsed money amount with a global comma-strip, across all six integration Map/Reduce scripts (~40 call sites).
3. **[MUST]** Add `@DeployedOn` to every script header (0/11 today).
4. **[SHOULD]** Factor the ~15 duplicated helper functions into one shared library module.
5. **[SHOULD]** Move the RESTlet's hardcoded folder id to a script parameter, and populate the created custom record's own fields from the payload.

Findings this cycle: **3 MUST / 3 SHOULD / 1 CONSIDER** (7 total).
