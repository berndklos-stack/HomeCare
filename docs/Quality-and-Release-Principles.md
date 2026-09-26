# Quality and Release Principles

## Core rule
Quality is more important than speed on critical workflows.

## Required practices
- automated tests
- staging
- rollback
- small releases
- feature flags where useful
- safe DB migrations
- CI checks
- code review
- dependency/security review
- production error tracking
- performance monitoring
- load testing on critical paths
- release notes
- traceability
- docs updated with behavior changes

## Definition of Done
Relevant changes include:
- requirement satisfied
- permission behavior correct
- server validation
- migration if needed
- existing data preserved
- automated tests
- failure states handled
- mobile/localization considered
- documentation updated
- rollback/recovery understood

## Migration rules
Version, review, test, preserve data and document recovery for risky changes.

## Sync test baseline
1. server newer than local cache
2. offline update later syncs
3. duplicate mutation retry does not duplicate
4. deletion does not reappear
5. concurrent edit has no silent loss
6. simultaneous same-resource start allows max one active
7. start device A / end device B
8. latest authoritative derived value
9. deleted media does not reappear
10. failed sync is visible and retryable

## Environments
Production, staging/test and local development must be separated.

## Quality gates
Critical regressions block release.
