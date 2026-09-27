# WorkCore Launch Criteria

## Core rule
> WorkCore is launch-ready only when the core product is stable, secure, tenant-safe, synchronization-safe and operationally validated.

## Mandatory technical criteria

### Authentication / authorization
- Verified identity on protected routes
- Server-side authorization
- Tenant/company membership validated
- Service-role use cannot bypass tenant authorization
- Secure customer portal authentication
- MFA available

### Tenant isolation
- No cross-tenant reads
- No cross-tenant writes
- Multi-company access explicitly assigned
- Shared master data opt-in and scoped

### Synchronization
- Server is source of truth
- Durable offline mutations
- Idempotent mutation retries
- Revision checks prevent silent overwrite
- User-visible conflict handling
- Deleted data does not reappear
- Realtime does not bypass conflict rules

### Database integrity
- Critical invariants enforced server/database-side
- Financial identifiers not generated unsafely in clients
- DB migrations tested against real PostgreSQL
- Recovery procedure documented

### Financial safety
- Collision-safe authoritative invoice numbering
- Transactionally safe financial writes
- Duplicate financial actions prevented
- Deterministic accounting export

### Backup / restore
- Relational source-of-truth included
- Object storage included where relevant
- Restore tested
- Full company export possible

### Media / communication
- Tenant- and role-aware media access
- Consistent deletion behavior
- Protected mail / communication endpoints
- Idempotent sends where needed
- Internal/external visibility enforced

## Mandatory quality criteria
- Critical tests green
- Security tests green
- Tenant-isolation tests green
- Sync/offline/conflict tests green
- Production build passes
- DB migrations pass in a real test environment
- Core mobile flows validated
- DE/SV/EN critical UI complete
- No known critical data-loss bug
- No known critical cross-tenant/security bug

## Mandatory operational criteria
- Status page exists
- Support path exists
- Incident-response path documented
- Backup ownership clear
- Go-live checklist completed
- Responsible person explicitly approves launch
