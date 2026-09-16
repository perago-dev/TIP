# Development Team Intelligence (Slack)

**Source:** #dev-team (C0254GSBTAA), #sea-ninjas (C089D2SDE10)
**Last Updated:** 2026-01-08
**Coverage:** October 2025 - January 2026 (90 days)

---

## AI Coding Resources & Best Practices

### Claude Code - Creator's Setup (Boris Cherny)

**Source:** https://xcancel.com/bcherny/status/2007179832300581177

Key insights from Claude Code's creator:
- Vanilla setup works great out of the box
- Each team member uses Claude Code differently - no single correct way
- Intentionally built for customization and hacking
- Don't over-complicate your setup initially

### AI Is Forcing Better Code Standards

**Source:** https://bits.logic.inc/p/ai-is-forcing-us-to-write-good-code

The article argues AI agents require disciplined coding practices to function effectively.

**1. 100% Code Coverage**
- Not about preventing bugs - ensures "the agent has double-checked every line"
- At 100%, there's a "phase change" eliminating ambiguity about what needs testing
- Fast tests are essential (their 10,000+ assertions run in ~1 minute)

**2. Organized File Structure**
- Treat directory structures as interfaces
- `./billing/invoices/compute.ts` > `./utils/helpers.ts`
- Small, well-scoped files preferred (agents truncate large files in context)

**3. Fast, Ephemeral Development Environments**
- Speed: Tests run constantly, fast enough to execute on every change
- Automation: Single commands spawn fresh environments in 1-2 seconds
- Isolation: Multiple concurrent environments without conflicts

**4. End-to-End Type Systems**
- TypeScript throughout enables agents to understand data flows
- Semantic type names like `UserId` or `SignedWebhookPayload` help models
- OpenAPI specifications and Postgres constraints complement type systems

### Just Talk To It - Agentic Engineering Guide

**Source:** https://steipete.me/posts/just-talk-to-it

Practical, no-hype approach to working with AI coding agents:

**Blast Radius Management**
- Consider scope before prompting - anticipate files affected and time needed
- Stop models mid-execution if they exceed expectations
- File changes are atomic; models can resume effectively

**Prompt Brevity**
- Modern models require minimal context
- Screenshots are particularly effective
- Models read broadly before acting, understanding intent from minimal input

**Iterative UI Development**
- Start with incomplete specifications, iterate in real-time
- Observe browser updates while developing
- Queue related changes in parallel windows

**Atomic Commits**
- Configure agents to commit only their specific changes
- Maintains clean git history
- Prevents cross-agent interference

**Testing Integration**
- Request tests immediately after feature completion in same context
- Surfaces implementation bugs
- Produces better coverage than retrospective testing

**Avoid Over-Engineering**
- Skip subagents, RAG systems, and elaborate planning documents
- Maintain simple reference documentation (markdown files)
- Use CLIs rather than MCPs to minimize context overhead

---

## Advanced Tool Use Patterns (Anthropic)

**Source:** https://www.anthropic.com/engineering/advanced-tool-use

Three beta features for intelligent tool orchestration:

### 1. Tool Search Tool
- Dynamically discovers tools on-demand vs. loading all upfront
- Reduces token consumption by 85%
- Most effective with 10+ tools and >10K tokens of definitions
- Keep 3-5 most-used tools always loaded; defer the rest

### 2. Programmatic Tool Calling
- Claude writes Python to orchestrate multiple tools
- Keeps intermediate results out of context
- Reduces token usage by 37% on complex tasks (43K to 27K tokens)
- Use for processing large datasets, multi-step workflows, parallel operations

### 3. Tool Use Examples
- Concrete usage patterns showing correct invocation
- Improves accuracy from 72% to 90% on parameter handling
- Include 1-5 realistic examples per tool
- Focus on ambiguities not obvious from JSON schema

**Strategic Layering:**
- Context bloat from definitions -> Tool Search Tool
- Large intermediate results -> Programmatic Tool Calling
- Parameter errors -> Tool Use Examples

---

## JavaScript Design Patterns

**Source:** https://www.patterns.dev/

### Foundational Patterns

**Creational:** Factory Pattern, Singleton Pattern
**Structural:** Proxy Pattern, Mixin Pattern, Flyweight Pattern
**Behavioral:** Observer Pattern, Mediator/Middleware Pattern
**Organization:** Module Pattern, Prototype Pattern

### Performance & Loading Patterns

| Pattern | Purpose |
|---------|---------|
| Bundle Splitting | Separate code into logical chunks |
| Route Based Splitting | Load code per route |
| Dynamic Import | Lazy load on demand |
| Tree Shaking | Remove unused code |
| List Virtualization | Render only visible items |
| Import On Visibility | Load when element enters viewport |
| Import On Interaction | Load on user action |
| PRPL Pattern | Push, Render, Pre-cache, Lazy-load |

### React/Next.js Patterns

- Container/Presentational separation
- Higher Order Components (HOC)
- Render Props
- Hooks Pattern
- Compound Pattern
- Server-Side Rendering (SSR)
- Static Generation
- Incremental Static Regeneration
- Progressive Hydration
- Streaming SSR
- React Server Components

---

## Claude Code Tips & Tools

### Claude Code Transcripts Tool

**Source:** https://simonwillison.net/2025/Dec/25/claude-code-transcripts/

Python CLI tool for converting Claude Code transcripts to detailed HTML:
- Supports both Claude Code desktop and web (async agent)
- Creates shareable outputs via static HTML or GitHub Gists
- Includes hidden thinking traces
- Generates organized output with summary and detail pages
- Key insight: "The actual work I do is now increasingly represented by these Claude conversations"

### Claude Code Features Discussed in Team Channels

| Feature | Description |
|---------|-------------|
| Skills | Directory-specific system instructions |
| Rules | Segment instructions by directory |
| Async Subagents | Running parallel agent tasks |
| Frontend Design Skill | Production-grade UIs, avoiding distributional convergence |
| Test-Driven Prompts | TDD with recursive agent loops |

### Cross-Platform Skills Format

Claude skills format becoming standard across platforms:
- **GitHub Copilot** now supports `.claude/skills` directory (Dec 2025)
- **ChatGPT/OpenAI** adopting similar format
- Skills are portable across Claude Code, Copilot, and Auctor

---

## SuiteScript Patterns (from Team Discussion)

### Client Script Limits (2025.2 Release)

From Crish Arellano (Oct 2025):
> "The limit forces you to think about what's really needed before customising. But if you prefer several light-weight Client scripts, you can deploy as many as necessary now."

**Context:** NetSuite 2025.2 removes the single client script per record type limitation.

**Previous Workaround:**
- Single Client script that loads other scripts as modules
- No longer needed as of 2025.2

**Best Practice:**
- Still think carefully about necessity before customizing
- Can now use multiple lightweight scripts when appropriate

---

## Development Workflow Patterns

### SDLC Evolution (Agentic Model)

**Old Model: Manual Pipeline**
- Writing code = 80% of development time
- Linear development flow

**New Model: Agentic SDLC**
- AI automates code writing
- "Hourglass" shape: planning/review expand, coding shrinks
- Early career roles shifting from code writing to AI orchestration

### Emerging Best Practices

1. **Good code structure matters more** - AI needs clean patterns
2. **Skills/instructions are key** - Teaching AI task-specific behaviors
3. **Validation still human** - AI makes mistakes, review required
4. **Prompt engineering evolving** - Larger models need less specific prompts; smaller models need more precise prompting

### Model Comparison (Team Observations)

From team discussions (Nov-Dec 2025):
- Gemini 3 vs Sonnet: "Surprising results - shows how much impact the agent can make"
- Claude Code spent "over an hour fixing linter errors it created" - cautionary tale
- Subagents/Skills may be slow but "worth the wait"

---

## Team Resources

### Key Links Shared

| Resource | URL | Date |
|----------|-----|------|
| Softype Scout Landing | https://marketing-site-blue.vercel.app/ | Dec 2025 |
| Claude Skills Announcement | https://www.anthropic.com/news/skills | Oct 2025 |
| Claude Code on Web | https://www.anthropic.com/news/claude-code-on-the-web | Oct 2025 |
| Neon Changelog | https://neon.com/docs/changelog | Nov 2025 |
| Atlassian Team Page | https://perago.atlassian.net/wiki/x/AYA2Ig | Jan 2026 |

### External AI Tools Mentioned

| Tool | Purpose | Notes |
|------|---------|-------|
| Cursor 2.0 | AI IDE | Browser feature, Composer model |
| Amp | AI coding | Alternative to Claude Code |
| Qodo | AI coding | Alternative to Claude Code |
| NotebookLM | Prompt synthesis | Aggregate context for prompts |
| AgentHQ (GitHub) | Enterprise agent hub | Supports multiple agent CLIs |
| Google ADK | Agent development kit | Starting point for AI agents |

---

## Slack Channels

| Channel | ID | Focus |
|---------|-----|-------|
| #dev-team | C0254GSBTAA | Development team, AI resources |
| #sea-ninjas | C089D2SDE10 | Aquarius/Sea Ninja team |
| #sea-ninjas-github-updates | C09AKTVJZR6 | GitHub activity notifications |

---

## Key Team Contributors

| Name | Username | Areas |
|------|----------|-------|
| Henry Tilford | henryt | AI strategy, resource curation |
| Ethan S. | ethans | Aquarius (Achi), Claude Skills |
| Crish Arellano | cristophera | SuiteScript patterns |
| Swastik S. | swastiks | Infrastructure (Neon, deployment) |
| Grace L. | gracel | Infrastructure |
| Sherwin S. | shers | Documentation |

---

## Action Items for Mason

Based on this intelligence, Mason should consider:

1. **Incorporate 100% test coverage guidance** for AI-assisted development
2. **Add file structure recommendations** - small, well-scoped files with semantic naming
3. **Document TypeScript patterns** with semantic type names
4. **Include Claude Code workflow tips** in development standards
5. **Update SuiteScript patterns** for 2025.2 client script changes
6. **Add patterns.dev reference** for JavaScript design patterns
7. **Create guidance on agentic development** - atomic commits, blast radius management
