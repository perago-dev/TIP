# Integration and Technical Implementation Patterns

> Extracted from Softype Slack channels (#dev-team, #sea-ninjas) and technical discussions.
> Last updated: January 2026

---

## Integration Type Catalog

### 1. NetSuite Integration Patterns

#### REST API (Inbound/Outbound)

**Outbound REST (NetSuite to External Systems)**
- Use `N/https` module for external API calls
- Implement OAuth 2.0 token-based authentication
- Create separate integration user with minimal permissions
- Store tokens encrypted, implement token refresh mechanism

**Inbound REST (External to NetSuite via RESTlet)**
```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(['N/record', 'N/error'], function(record, error) {
    function post(requestBody) {
        try {
            // Validate input with Zod or similar
            // Process request
            // Return structured response
            return { success: true, data: result };
        } catch (e) {
            log.error('RESTlet Error', e);
            return { success: false, error: e.message };
        }
    }
    return { post: post };
});
```

**Best Practices from Team Discussions:**
- Always validate all data before sync
- Implement retry logic with exponential backoff
- Log all integration activities
- Monitor for sync failures with alerting

#### SFTP Integration

**File Upload Pattern (from Slack discussions)**
```javascript
/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @description SFTP file upload pattern
 */
define(['N/runtime', 'N/file', 'N/sftp'], function(runtime, file, sftp) {
    function execute() {
        const fileIds = JSON.parse(
            runtime.getCurrentScript().getParameter('custscript_file_ids')
        );

        try {
            const connection = sftp.createConnection({
                username: 'INTEGRATION_USER',
                keyId: 'custkey_sftp_private',
                url: 'sftp.example.com',
                directory: '/outbound',
                hostKey: 'AAAAB3NzaC1...'  // Host key verification
            });

            fileIds.forEach(function(fileId) {
                const fileObj = file.load({ id: fileId });
                connection.upload({
                    file: fileObj,
                    replaceExisting: true,
                    directory: '/outbound'
                });
                log.debug('File uploaded', fileObj.name);
            });
        } catch (err) {
            log.error('SFTP Upload Error', err);
            // Trigger error notification
        }
    }
    return { execute: execute };
});
```

**Key Considerations:**
- Use private key authentication (stored in NetSuite)
- Host key verification required for security
- Implement file validation before upload
- Track upload status in custom record for audit

#### OAuth 1.0 (TBA - Token-Based Authentication)

**Used for external apps accessing NetSuite:**
- Consumer Key/Secret + Token Key/Secret
- Signature method: HMAC-SHA256
- Realm: Account ID

**Implementation Notes:**
- Store credentials in environment variables
- Never commit credentials to version control
- Rotate tokens periodically

### 2. Modern Web Stack Integrations

#### Aquarius/Sea Ninja Architecture Pattern

**T3 Stack Integration:**
```
Frontend: Next.js 14 + React 18 + TypeScript
Backend: tRPC (type-safe APIs)
Database: PostgreSQL + Prisma ORM
Hosting: Vercel (app) + Neon (database)
Auth: NextAuth.js
```

**tRPC Integration Pattern:**
```typescript
// Type-safe API router
export const bookingRouter = createTRPCRouter({
    create: protectedProcedure
        .input(bookingSchema)
        .mutation(async ({ ctx, input }) => {
            // Validate with Zod
            // Create booking with Prisma
            // Sync to NetSuite if needed
            return booking;
        }),
});
```

**NetSuite Sync from Web App:**
```typescript
// OAuth 1.0 Authentication for NetSuite
async function syncToNetSuite(data: BookingData) {
    const oauth = new OAuth1({
        consumerKey: process.env.NS_CONSUMER_KEY,
        consumerSecret: process.env.NS_CONSUMER_SECRET,
        tokenKey: process.env.NS_TOKEN_KEY,
        tokenSecret: process.env.NS_TOKEN_SECRET,
    });

    const response = await fetch(NETSUITE_RESTLET_URL, {
        method: 'POST',
        headers: oauth.sign('POST', NETSUITE_RESTLET_URL),
        body: JSON.stringify(data),
    });

    return response.json();
}
```

#### trigger.dev Workflow Integration

**GitHub + Vercel + Neon Orchestration:**
```typescript
import { TriggerApi, eventTrigger } from '@trigger.dev/sdk';
import { Github } from '@trigger.dev/github';
import { neon } from '@neondatabase/serverless';

export const onGitHubPush = client.defineJob({
    id: 'github-push-workflow',
    trigger: github.triggers.repo({
        repo: 'org/repo',
        events: ['push'],
    }),
    run: async (payload, io) => {
        const sql = neon(process.env.DATABASE_URL);

        // Log event to database
        await sql`
            INSERT INTO git_events (repo, branch, pusher)
            VALUES (${payload.repository.full_name},
                    ${payload.ref},
                    ${payload.pusher.name})
        `;

        // Trigger deployment if main branch
        if (payload.ref === 'refs/heads/main') {
            await io.sendEvent('trigger-deployment', {
                name: 'deployment.requested',
                payload: { commit: payload.head_commit?.id }
            });
        }
    }
});
```

---

## Error Handling Approaches

### SuiteScript Error Handling Pattern

**Standard try-catch with error constants:**
```javascript
const ERROR_CONSTANTS = {
    RECORD_NOT_FOUND: { code: 'RECORD_NOT_FOUND', message: 'Record not found' },
    VALIDATION_FAILED: { code: 'VALIDATION_FAILED', message: 'Validation failed' },
    INTEGRATION_ERROR: { code: 'INTEGRATION_ERROR', message: 'Integration error' }
};

function processRecord(recordId) {
    try {
        const rec = record.load({ type: 'salesorder', id: recordId });
        // Process...
    } catch (e) {
        log.error({
            title: ERROR_CONSTANTS.RECORD_NOT_FOUND.code,
            details: JSON.stringify({ recordId, error: e.message })
        });
        throw error.create({
            name: ERROR_CONSTANTS.RECORD_NOT_FOUND.code,
            message: ERROR_CONSTANTS.RECORD_NOT_FOUND.message
        });
    }
}
```

### Retry with Exponential Backoff

**From team discussions on integration resilience:**
```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (e) {
            if (i === maxRetries - 1) throw e;
            const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, delay));
            log.debug('Retry attempt', { attempt: i + 1, delay });
        }
    }
}
```

### Web App Error Handling

**Next.js API Route Pattern:**
```typescript
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validated = schema.parse(body); // Zod validation

        const result = await processRequest(validated);
        return Response.json({ success: true, data: result });
    } catch (e) {
        if (e instanceof ZodError) {
            return Response.json(
                { success: false, error: 'Validation failed', details: e.errors },
                { status: 400 }
            );
        }

        console.error('API Error:', e);
        return Response.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
```

### Webhook Validation

**From security standards:**
```typescript
function validateWebhook(req: Request): boolean {
    const signature = req.headers['x-webhook-signature'];
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}
```

---

## Code Review Patterns

### Code Review Security Checklist

From team documentation:

- [ ] No hardcoded credentials or secrets (verified with secretlint)
- [ ] Input validation on all user inputs
- [ ] Proper error handling without information leakage
- [ ] Authentication and authorization checks
- [ ] Secure communication (HTTPS/TLS)
- [ ] Audit logging for sensitive operations
- [ ] Rate limiting on public endpoints
- [ ] OWASP Top 10 considerations

### SuiteScript Code Review Example

**Real code review from Slack (SOA Scripts):**

Issues identified:
1. Poor commit message: "Update 12-08-2025" provides no context
2. Logic bug: Both conditions check for COMPLETE when one should be FAILED
3. Copy-paste error: `parseFloat(interestRate)` should be `parseFloat(penaltyRate)`
4. Inconsistent error handling
5. Dead code: Large commented blocks should be removed
6. Hard-coded values: NetSuite URLs and IDs embedded in code

**Recommendations:**
- Fix logic bugs immediately
- Add proper error handling throughout async operations
- Remove dead code and improve commit messages
- Extract configuration to constants

### Pre-commit Hooks

**Standard configuration:**
```bash
# .husky/pre-commit
npm run typecheck
npm run check
npm test
npx secretlint '**/*' --secretlintignore .gitignore
```

---

## Deployment Practices

### Branching Strategy

**From Bitbucket Best Practices:**
- **Main Branch**: Production-ready code only
- **Development Branch**: Sandbox environment testing
- **Feature Branches**: Individual features/fixes (e.g., `feature-name/client-request`)

### Workflow

1. Feature Development: Develop in feature branches, PR to sandbox
2. Sandbox Testing: Deploy development branch for client testing
3. Production Deployment: PR from development to main after testing
4. Tag production deployments (e.g., `v1.0-prod`, `v2.0-prod`)
5. Enable rollback capability

### Definition of Done

Each Jira issue must complete:
- [ ] Automated unit tests complete and passing
- [ ] Automated acceptance tests complete and passing
- [ ] Pull request reviewed and approved
- [ ] Benchmarks updated
- [ ] Monitoring/Alerting updated
- [ ] Deployed to staging environment
- [ ] All release documentation written and edited

### Vercel Deployment

**Environment variables required:**
```
TRIGGER_API_KEY=your_trigger_api_key
DATABASE_URL=your_neon_connection_string
GITHUB_TOKEN=your_github_token
```

**Preview deployments:** Automatic on PR
**Production:** Main branch only

---

## Testing Approaches

### Testing Framework Setup

**Recommended stack (from Tech Talks):**
- **Unit Tests**: Vitest
- **E2E Tests**: Playwright
- **Test Command**: `npm run test` runs all

### SuiteScript Unit Testing

**Vitest example from team:**
```javascript
import { expect, test } from 'vitest';
import { button } from './UE_SO_Button.impl.js';

test('add custpage_customerlist_button if conditions are correct', () => {
    const beforeLoad = button;
    const context = {
        newRecord: { type: 'salesorder' },
        type: 'create',
        form: {
            addButton: function(button) {
                expect(button.id).toBe('custpage_customerlist_button');
            }
        }
    };
    beforeLoad(context);
});
```

### Sea Ninja Testing Pattern

**Comprehensive test structure:**
```
test/
  schemas/auth.schema.test.ts      # Schema validation
  trpc/                             # API endpoint testing
    faresValidation.test.ts
    freightDiscount.test.ts
    paymentCalcs.test.ts
    seatManagement.test.ts
  utils/                            # Utility testing
    discountHelper.test.ts
    pricingUtils.test.ts
e2e/
  Passage_000.spec.ts              # Booking workflows
  accommodation.test.ts            # Vessel testing
```

### E2E Test Example

**Playwright booking journey:**
```typescript
test('Complete passenger booking journey', async ({ page }) => {
    await page.goto('/customer/booking');

    // Select route and date
    await page.selectOption('route', 'CEBU-BOHOL');
    await page.click('[data-testid=date-tomorrow]');

    // Add passenger
    await page.fill('firstName', 'Maria');
    await page.fill('lastName', 'Santos');

    // Process payment
    await page.click('[data-testid=pay-maya]');
    await page.fill('maya-phone', '09171234567');
    await page.click('[data-testid=confirm-payment]');

    // Verify
    await expect(page).toHaveURL(/\/customer\/booking\/confirmation\//);
    await expect(page.locator('[data-testid=booking-reference]')).toBeVisible();
});
```

---

## Infrastructure Discussions

### Cloud-Native Stack (Aquarius/Sea Ninja)

**Production Architecture:**
- **Application**: Vercel (Singapore region)
- **Database**: Neon Serverless PostgreSQL (Singapore)
- **Caching**: Upstash Redis (optional)
- **Background Jobs**: trigger.dev or Inngest

**Scalability Features:**
- Serverless architecture scales automatically
- Database connection pooling
- Edge functions for global performance
- CDN-ready with image optimization

### On-Premise Considerations

**From team discussions - why NOT to do on-prem:**

What you'd need:
- Node.js environment with PM2
- PostgreSQL database
- Nginx reverse proxy
- SSL certificates
- Monitoring setup
- Backup solution

What you'd lose:
- Vercel's global CDN
- Automatic scaling
- One-click rollbacks
- Built-in analytics

**Cost reality:**
- Setup: $10-20k
- Ops staff: $150k+/year
- Tools: $2k/month
- Total: 3x more than cloud

### Environment Configuration

**Secret management:**
```bash
# NEVER commit .env files
# Use .env.example for documentation
# Rotate secrets quarterly
# Different values for dev/staging/prod
```

### Database Security

- Restrict access by IP whitelist
- Use connection pooling with SSL
- Regular security patches
- Automated backups with encryption

---

## Best Practices from Team Discussions

### AI-Assisted NetSuite Development

**Effective prompting for SuiteScript:**

1. Set Clear Context:
   - Specify script type (Client, User Event, Scheduled, etc.)
   - Mention NetSuite and SuiteScript version
   - Include record types and fields
   - Share business requirements

2. Example prompt structure:
```
I need a User Event script in SuiteScript 2.1 that runs
afterSubmit on Sales Orders. The script should update
custentity_last_order_date on the customer when orders
exceed $1000.
```

3. Always verify:
   - Correct NetSuite APIs
   - Governance limits considered
   - Error handling included
   - Field IDs match your account

### Common AI Mistakes to Watch For

- Mixing SuiteScript 1.0 and 2.0 syntax
- Incorrect module dependencies
- Ignoring governance limits
- Wrong field ID conventions
- Missing transaction-specific behaviors

### Governance Considerations

Always consider:
- Expected governance usage
- Batch processing strategies
- Yield mechanisms for long-running scripts
- Map/Reduce for high-volume operations

---

## Integration Security Standards

### Authentication Patterns

**OAuth 2.0 (External APIs):**
- Token-based authentication
- Separate integration user with minimal permissions
- Token refresh mechanism
- Encrypted token storage

**OAuth 1.0 (NetSuite TBA):**
- Consumer Key/Secret + Token Key/Secret
- HMAC-SHA256 signature
- Account ID as realm

### Data Synchronization Security

- Validate all data before sync
- Implement retry logic with exponential backoff
- Log all integration activities
- Monitor for sync failures
- Encrypt sensitive data in transit and at rest

### API Security

**Rate Limiting:**
```typescript
const rateLimiter = new RateLimiter({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100,                    // 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
});
```

**Request signing for webhooks** (see Webhook Validation above)

---

## Sources

- Slack #dev-team discussions
- Slack #sea-ninjas channel
- Slack #proj-aquarius-liteferries
- Tech Uplift Project Documentation
- edERP Security Standards
- Aquarius 2.0 System Requirements
- Code Review discussions
