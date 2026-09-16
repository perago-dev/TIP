# Dev Team Channel Historical Analysis

> **Source:** #dev-team Slack channel  
> **Period:** January 2025 - January 2026 (1 year)  
> **Last Updated:** 2026-01-08  
> **Purpose:** Technical patterns, tool adoption, and institutional knowledge for Mason skill

---

## Executive Summary

The #dev-team channel documents a significant transformation in Softype's development practices over 2025, marked by:

1. **AI Tool Adoption** - Formalized rollout of Claude Code, Cursor, and GitHub Copilot (August 2025)
2. **Version Control Migration** - Bitbucket to GitHub transition (July 2025)
3. **Process Formalization** - Jira-based workflow with mandatory PR approvals (February 2025)
4. **NetSuite Platform Updates** - Client script deployment limits removed in 2025.2
5. **Knowledge Sharing** - Strong culture of sharing AI coding resources and best practices

---

## 1. Technical Debt Evolution: SuiteScript 1.0 to 2.1 Migration

### Current State
- **Primary Focus:** SuiteScript 2.0/2.1 for new development
- **Migration Support:** AI tools explicitly recommended for modernizing SS 1.0 to 2.x
- **GL Plugin 2.0:** Active development interest (February 2025 - Rizwan S. asking about custom GL impact plugins)

### Key Discussions

**October 2025 - Client Script Deployment Changes:**
> "The limit forces you to think about what's really needed before customising but I can see where this is helpful. But use it with caution, but if you prefer to have several light-weight Client scripts, you can deploy as many as necessary now. In the past, we have to a single Client script that loads other client scripts as modules to get around this limitation. Nice to see the need for that is going away in 2025.2." - Crish Arellano

**Implications:**
- Previous workaround: Single client script loading others as modules
- NetSuite 2025.2: Removed deployment limits, allowing multiple lightweight scripts
- Recommendation: Use caution, but multiple client scripts now viable

### AI-Assisted Migration Guidance (July 2025)
From Henry's comprehensive AI coding guide:
- Use AI to "Modernize SuiteScript 1.0 to 2.x"
- Common AI mistakes: "Mixing SuiteScript 1.0 and 2.0 syntax"
- Always specify SuiteScript version in prompts (1.0 or 2.0/2.1)

---

## 2. Tool Adoption Timeline

### AI Tools Rollout (August 2025)

**Official Announcement (2025-08-12):**
> "AI tools for everyone - they're in the budget"

**Approved Tools:**
| Tool | Access Method | Primary Use |
|------|---------------|-------------|
| GitHub Copilot Business | Contact Henry | GitHub + VSCode integration |
| Cursor | Contact Sangita P. | VSCode fork with AI |
| Claude Code | Contact Sangita P. | CLI-based AI coding |

### Supporting Resources Shared

**Context Engineering & Best Practices:**
- Advanced Context Engineering for Coding Agents (September 2025)
- "Frequent intentional compaction" workflow
- Spec-driven development approach
- Claude Code subagents for parallelization (September 2025)

**Training Videos:**
- "Claude Code - 47 PRO TIPS in 9 minutes" (Greg Code)
- "5 Resources To Vibe Code Like The Top 1%" (Sean Kochel)
- "Outperform 99% Of Vibe Coders With This Planning Method" (Sean Kochel)
- "The Case for Claude Code" (Brian Casel)

**Model Releases Tracked:**
- Claude Sonnet 4.5 (September 2025) - "best coding model in the world"
- GPT-5/Codex introduction (December 2025)
- Claude Code on the web (October 2025)

### Version Control Migration (July 2025)

**Timeline:**
- 2025-07-08: Bitbucket access removal announced
- 2025-07-09: GitHub invites sent to team leads
- Migration to GitHub with CLI support

**Key Actions:**
- All repos pulled from Bitbucket before cutover
- Team leads retained Bitbucket access during transition
- GitHub CLI recommended: https://cli.github.com/
- GitHub Desktop and Mobile apps also recommended

---

## 3. Architecture Decisions

### Development Workflow Formalization (February 2025)

**Mandatory Process (Tech Talk #12):**

```
For all code changes to production:

1. Jira Issue Required
   - Actionable description
   - Definition of done
   - Story point estimation

2. Bitbucket/GitHub Branch
   - Based on Jira issue
   - Pull request when complete
   - PR needs approval from team member

3. Only then: Merge and deploy to production
```

**Key Points:**
- Jira issue creation: Shared between Tech and requesting department (Delivery, Support, Product)
- Jira Sprints: Optional at Tech lead discretion
- Jira/Confluence training: February 20, 2025 (India office)

### edERP Architecture Decisions

**Test Coverage Strategy (June 2025):**

| Priority | Components | Target Coverage |
|----------|------------|-----------------|
| P1 | GenericDataTable, FormDialog, FilterComponent, ProtectedRoute | 90% |
| P2 | Navbar, Sidebar, Auth pages | 80% |
| P3 | Academic Planning, Course Scheduling | 80-90% |

**Testing Exclusions:**
- Generated files (ZenStack)
- Simple CRUD pages
- Seed data files
- Configuration files
- Third-party wrappers

**Architecture Patterns:**
- Next.js application
- ZenStack for code generation
- Testing Library best practices
- Test execution target: <5 minutes for full suite

### Scout Marketing Site (December 2025)
- Vercel deployment for AI-powered NetSuite analysis
- Pre-sales, optimization, and rescue scenarios

---

## 4. Code Quality Standards Evolution

### AI-Assisted Code Review Guidelines

**Verification Checklist (from July 2025 guide):**
1. All NetSuite APIs used correctly
2. Field and record type IDs match account
3. Governance limits considered (especially loops)
4. Search filters and column definitions validated
5. Correct script deployment settings

**Common AI Mistakes to Watch:**
- Mixing SuiteScript 1.0 and 2.0 syntax
- Incorrect module dependencies
- Forgetting governance limits
- Field IDs not matching NetSuite conventions
- Overlooking transaction-specific behaviors

### Best Practices for AI-Generated Code

**Request Structure:**
1. Core logic first
2. Error handling separately
3. Performance optimizations as follow-ups
4. Logging and debugging features last

**Documentation Standards:**
- JSDoc annotations for script deployment
- Script parameter definitions
- Deployment configuration details
- Dependencies and module requirements
- Governance impact estimates

### Security Considerations
- Proper permission checks
- Secure handling of sensitive data
- Appropriate use of NetSuite roles
- Safe parameter validation
- Protection against injection attacks

---

## 5. Training Resources Shared

### NetSuite Development

**Oracle Developer Portal (August 2025):**
> "Oracle NetSuite has launched a dedicated Developer Portal... a centralized hub for everything SuiteScript."
- URL: https://docs.oracle.com/en/cloud/saas/netsuite-developers/devresources/
- Coverage: User Events, Suitelets, RESTlets, Map/Reduce, debugging tools, code samples

**GL Plugin 2.0 Documentation:**
- Custom GL Plugin 2.0 Reference Doc shared (March 2025 - Rizwan S.)

**Odoo Training (August 2024):**
- Functional + Technical training mandatory
- Google Drive resource folder shared

### AI/Coding Resources

**Foundational Articles:**
| Resource | Source | Key Concept |
|----------|--------|-------------|
| Effective context engineering for AI agents | Anthropic | Context management |
| Advanced tool use | Anthropic | Dynamic tool execution |
| Spec-driven development | GitHub Blog | Markdown as code |
| Vibe engineering | Simon Willison | Responsible AI coding |
| The AI coding trap | Chris Loy | Critical thinking first |

**Video Resources:**
- Claude Code creator's setup (Boris Cherny) - January 2026
- Frontend design through Skills Claude - November 2025
- CodeRabbit CLI for AI code reviews - September 2025

### External Tools & Platforms

| Tool | URL | Purpose |
|------|-----|---------|
| Cursor | cursor.com | AI code editor |
| Windsurf | windsurf.com | AI-native IDE |
| bolt.new | bolt.new | Prompt-based app deployment |
| v0 by Vercel | v0.dev | UI generation |
| Claude Code Transcripts | Simon Willison | Transcript extraction tool |
| GitHub Copilot Agent Skills | GitHub | Agent skill framework |

---

## 6. Technical Challenges & Solutions

### Recurring Problems

**1. Code Deployment Without Tracking**
- **Problem:** Code pushed to production without documentation
- **Solution:** Mandatory Jira issue + PR approval workflow (February 2025)

**2. AI-Generated Code Quality**
- **Problem:** "Too much slop. Tech debt factory."
- **Solution:** 
  - Spec-driven development
  - Frequent intentional compaction
  - Human review at key points
  - Context utilization at 40-60%

**3. Version Control Fragmentation**
- **Problem:** Bitbucket access/update issues
- **Solution:** GitHub migration with centralized access management

**4. Client Script Deployment Limits**
- **Problem:** Single client script loading modules as workaround
- **Solution:** NetSuite 2025.2 removed limits

### Solutions & Patterns Discovered

**Context Engineering for Large Codebases:**
From shared resources:
- Works in 300k LOC codebases
- "Ship a week's worth of work in a day"
- "Maintain code quality that passes expert review"

**Key Workflow:**
1. Research phase
2. Plan phase  
3. Implement phase
4. High-leverage human review at specific points

**Test Planning Approach:**
- Focus on business-critical components first
- Exclude generated/low-impact code
- Target meaningful tests over coverage percentage
- Integration tests for complex workflows

---

## 7. Channel Activity Patterns

### Key Contributors
- **Henry Tilford (henryt):** Primary resource sharer, AI tools champion, process owner
- **Pandurang A. (panduranga):** Administrative coordination, training announcements
- **Crish Arellano (cristophera):** NetSuite platform expertise, technical insights
- **Rizwan S. (rizwans):** SuiteScript 2.0/GL plugin development

### Discussion Themes by Month

| Month | Primary Topics |
|-------|----------------|
| Jan 2025 | Tech Talk planning |
| Feb 2025 | Jira workflow formalization, GL plugin 2.0 |
| Mar 2025 | Employee of the month voting |
| Apr 2025 | Accounting 101 KT |
| May 2025 | SQL/NetSuite connectivity |
| Jun 2025 | AI tools introduction, test planning, edERP CLAUDE.md |
| Jul 2025 | GitHub migration, AI coding best practices |
| Aug 2025 | AI tools budget approval, NetSuite Developer Portal |
| Sep 2025 | Claude Sonnet 4.5, context engineering deep dives |
| Oct 2025 | All-hands meeting, client script limits, vibe engineering |
| Nov 2025 | Anthropic tool use, frontend skills |
| Dec 2025 | GPT-5/Codex, Scout marketing site, AI workflow resources |
| Jan 2026 | Claude Code creator interview |

---

## 8. Implications for Mason

### Pattern Library Priorities

Based on channel discussions, Mason should prioritize:

1. **SuiteScript 2.1 Patterns**
   - Modern module structure
   - Governance-aware designs
   - Migration guides from SS 1.0

2. **AI-Assisted Development Workflows**
   - Prompt engineering for NetSuite
   - Code review checklists for AI output
   - Context engineering best practices

3. **Testing Strategies**
   - Component prioritization framework
   - Exclusion criteria for generated code
   - Coverage targets by component type

4. **Integration Patterns**
   - PR-based workflow integration
   - Jira linkage requirements
   - Branch naming conventions

### Knowledge Gaps to Address

1. **GL Plugin 2.0** - Team actively seeking examples
2. **SuiteAnalytics Connect** - ODBC driver configuration questions
3. **Map/Reduce Optimization** - Governance-efficient patterns
4. **Client Script Architecture** - Post-2025.2 best practices

---

## Appendix: Key Links from Channel

### Official Documentation
- NetSuite Developer Portal: https://docs.oracle.com/en/cloud/saas/netsuite-developers/devresources/

### AI Tools
- Claude Code: https://www.anthropic.com/claude-code
- Cursor: https://www.cursor.com/
- Windsurf: https://windsurf.com/
- GitHub CLI: https://cli.github.com/

### Learning Resources
- Advanced Context Engineering: https://github.com/humanlayer/advanced-context-engineering-for-coding-agents
- Spec-driven Development: https://github.blog/2025/spec-driven-development
- AI Coding Best Practices: https://bits.logic.inc/p/ai-is-forcing-us-to-write-good-code

### Internal Resources
- Tech Talk #12 Workflow: https://perago.atlassian.net/wiki/spaces/TU/pages/163643406/Tech+Talk+12+New+Work+Flow
- edERP CLAUDE.md: https://bitbucket.org/softypetechnicalservices/ederp/src/main/CLAUDE.md
