# Mason Skill References

> Reference materials for Mason (technical patterns library)
> Last Updated: January 2026

---

## Quick Reference

### Technical Patterns
| File | Purpose |
|------|---------|
| `integration-patterns.md` | Integration architecture patterns |
| `netsuite-magento-integration.md` | Magento connector patterns |

### Slack Intelligence
| File | Purpose |
|------|---------|
| `slack-intel.md` | 90-day #dev-team analysis |
| `dev-team-history.md` | **1 year** - Technical evolution, tool adoption, architecture decisions |

---

## Key Technical Events (from dev-team-history.md)

| Date | Event |
|------|-------|
| Feb 2025 | Jira workflow formalized (mandatory PR approvals) |
| Jul 2025 | Bitbucket → GitHub migration |
| Aug 2025 | AI tools rollout (Copilot, Cursor, Claude Code) |
| Oct 2025 | NetSuite 2025.2 - client script deployment limits removed |

---

## AI-Assisted Development Guidelines

**Verification checklist for AI-generated code:**
1. All NetSuite APIs used correctly
2. Field and record type IDs match account
3. Governance limits considered (especially loops)
4. Search filters and column definitions validated
5. Correct script deployment settings

**Common AI mistakes to watch:**
- Mixing SuiteScript 1.0 and 2.0 syntax
- Incorrect module dependencies
- Forgetting governance limits
- Field IDs not matching NetSuite conventions
