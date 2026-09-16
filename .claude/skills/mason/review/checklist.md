# Code Review Checklist

Comprehensive checklist for reviewing SuiteScript code.

## Quick Reference

| Category | Critical Items |
|----------|----------------|
| **Functionality** | Works as specified |
| **Security** | No injection vulnerabilities |
| **Performance** | Governance checked |
| **Maintainability** | Readable and documented |
| **Standards** | Follows naming conventions |

## Pre-Review Requirements

Before requesting code review:

- [ ] Code compiles/runs without errors
- [ ] Tested in sandbox
- [ ] Self-reviewed against this checklist
- [ ] Documentation updated

## Functionality

### Basic Requirements

- [ ] **Meets requirements** - Does what was asked
- [ ] **Edge cases handled** - Empty values, nulls, boundaries
- [ ] **Error cases handled** - Invalid input, missing data
- [ ] **Context types checked** - Create/edit/delete/view as appropriate

### User Events

- [ ] **Context type filtering** - Only runs when needed
- [ ] **Old vs new record comparison** - For change detection
- [ ] **afterSubmit doesn't throw** - Record already saved

### Scheduled Scripts

- [ ] **Governance checked** - Before expensive operations
- [ ] **Checkpointing implemented** - For long-running jobs
- [ ] **Reschedule logic** - When governance exhausted

### Map/Reduce

- [ ] **getInputData efficient** - Returns search, not loaded records
- [ ] **map is lightweight** - Heavy work in reduce
- [ ] **summarize logs errors** - All stages reported

### Client Scripts

- [ ] **Returns correct values** - Boolean from validate functions
- [ ] **User feedback provided** - Dialog for errors
- [ ] **Performance acceptable** - No blocking operations
- [ ] **Async patterns used** - Promises for HTTP calls, not blocking

### Suitelets

- [ ] **Input parameters validated** - Before use
- [ ] **GET vs POST handled** - Appropriate method routing
- [ ] **Error page provided** - User-friendly error display
- [ ] **Redirect after action** - For action Suitelets
- [ ] **CSRF protection** - For state-changing operations

### RESTlets

- [ ] **All parameters validated** - Type and presence checks
- [ ] **Error responses structured** - Consistent JSON format
- [ ] **HTTP methods appropriate** - GET for read, POST for create, etc.

## Security

### Input Validation

- [ ] **All inputs validated** - Before processing
- [ ] **Type checking** - Numbers are numbers, strings are strings
- [ ] **Length limits** - Prevent oversized input
- [ ] **No eval()** - Never use eval

### SQL/Search Injection

```javascript
// BAD: User input in filter
const searchObj = search.create({
    type: 'customer',
    filters: [['companyname', 'is', userInput]]  // Potential injection
});

// GOOD: Validate input first
if (!isValidCompanyName(userInput)) {
    throw new Error('Invalid company name');
}
```

### Permission Checks

- [ ] **Role restrictions respected** - Don't bypass
- [ ] **Sensitive data protected** - Check access before showing
- [ ] **Audit logging** - For sensitive operations

### Credential Handling

- [ ] **No hardcoded credentials** - Use parameters/secrets
- [ ] **API keys in secure storage** - Not in code
- [ ] **Passwords not logged** - Check log statements

## Performance

### Governance

- [ ] **Usage tracked** - getRemainingUsage() called
- [ ] **Heavy operations guarded** - Check before, not after
- [ ] **Efficient methods used** - submitFields vs load/save

### Search Efficiency

- [ ] **Mainline filter** - For transaction searches
- [ ] **Limited columns** - Only request needed fields
- [ ] **lookupFields for single records** - Not full search
- [ ] **Indexed fields** - For frequently searched

### Record Operations

- [ ] **submitFields preferred** - When only updating fields
- [ ] **Batch operations** - Group multiple updates
- [ ] **No record load in loops** - Cache or batch

### API Calls

- [ ] **Retry logic** - For transient failures
- [ ] **Timeout handling** - Don't hang forever
- [ ] **Rate limiting** - Respect external limits

## Maintainability

### Code Readability

- [ ] **Meaningful names** - Variables, functions, constants
- [ ] **Consistent formatting** - Follows style guide
- [ ] **Small functions** - Each does one thing
- [ ] **Low nesting** - Max 3 levels deep

### Documentation

- [ ] **File header complete** - Description, author, date
- [ ] **Functions documented** - JSDoc for public functions
- [ ] **Complex logic explained** - Comments for WHY
- [ ] **No commented-out code** - Remove or explain

### Error Handling

- [ ] **All try/catch needed** - External calls, risky ops
- [ ] **Errors logged** - With context
- [ ] **User-friendly messages** - For UI-facing errors
- [ ] **No silent failures** - Log or throw

## Standards Compliance

### Naming Conventions

- [ ] **Script IDs** - Follow pattern: `customscript_[prefix]_[name]`
- [ ] **Field IDs** - Follow pattern: `cust[scope]_[prefix]_[name]`
- [ ] **Variables** - camelCase
- [ ] **Constants** - UPPER_SNAKE_CASE

### Code Style

- [ ] **Indentation** - 4 spaces (not tabs)
- [ ] **Semicolons** - Used consistently
- [ ] **Quotes** - Single quotes for strings
- [ ] **Braces** - Always, even for single statements

### Module Structure

- [ ] **Constants at top** - After imports
- [ ] **Private functions grouped** - Before public
- [ ] **Clear exports** - Return statement at end

## Testing Evidence

- [ ] **Unit tests pass** - If applicable
- [ ] **Sandbox testing done** - Manual or automated
- [ ] **Test cases documented** - What was tested
- [ ] **Edge cases verified** - Empty, null, boundary

## Review Outcome

### Approval Levels

| Level | Meaning |
|-------|---------|
| **Approved** | Ready for deployment |
| **Approved with comments** | Minor issues, can deploy |
| **Changes requested** | Must fix before approval |
| **Rejected** | Fundamental issues |

### Review Comments

Use these prefixes:
- `[MUST]` - Must fix before approval
- `[SHOULD]` - Should fix, but not blocking
- `[CONSIDER]` - Suggestion for improvement
- `[QUESTION]` - Clarification needed
- `[NICE]` - Praise for good code

### Example Review Comment

```
[MUST] Line 45: Governance check needed before this loop.
Each iteration loads a record (10 units). For 100+ items,
this will exhaust governance.

Suggested fix:
const remaining = runtime.getCurrentScript().getRemainingUsage();
if (remaining < items.length * 15) {
    rescheduleScript();
    return;
}
```

## See Also

- `security.md` - Security review details
- `performance.md` - Performance review details
- `maintainability.md` - Maintainability review details
