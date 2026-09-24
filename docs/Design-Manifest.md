# WorkCore / Koll – Design Manifest

## Core Design Identity
> Easy. Professional. Clear.

## Core UX Rules
- Every screen has one obvious primary purpose.
- The interface must never feel confusing.
- Important controls must be large and touch-friendly.
- Frequent tasks should require as few interactions as reasonably possible.
- New users should not require formal training.
- Advanced options stay hidden until needed.
- Only truly necessary fields should be required.
- WorkCore should remember, suggest and pre-fill useful values.
- Errors should be prevented early, not merely corrected later.
- WorkCore may guide, but should not force rigid workflows.
- The interface should adapt terminology and emphasis to the business.
- The product should be modular.

## Navigation
- Important areas must be reachable directly.
- Avoid deep navigation.
- Favor clear categories and fast access.

## Dashboard
The dashboard is a working overview, not a reporting wall.
Show:
- urgent work
- today’s work
- important exceptions
- relevant reminders

Avoid:
- excessive charts
- unnecessary KPI cards
- visual noise

## Cards vs Tables
Use cards/blocks for daily operational work.
Use tables when comparing many records is truly useful.

## Forms
- Split long forms into logical sections.
- Show only relevant fields.
- Keep advanced details expandable.

## Status
Status must be immediately understandable and consistent.

## Feedback
Important actions must always provide clear feedback:
- Saved
- Trip started
- Invoice created
- Report sent
- Synced
- Save failed

## Undo / Recovery
Prefer:
- undo
- soft delete
- version history
- restore

over irreversible actions.

## Confirmation Dialogs
Use only for truly critical/destructive actions.

## Error Messages
Never show raw technical errors to normal users.
Explain:
- what happened
- what it means
- what to do next

## Contextual Help
Help should appear where needed, not as a forced manual.

## Visual Style
- calm
- high quality
- clear typography
- sufficient spacing
- restrained color use
- strong visual hierarchy

## Color
Use color primarily for:
- status
- urgency
- priority
- primary actions

## Icons
Use icon + text for important actions.
Use icon-only mainly for universally understood actions.

## Dark Mode
Dark Mode should be intentionally designed.

## Customization
Users may customize:
- start page
- module priority
- favorites
- default filters
- personal preferences

## Mobile First
Mobile must be designed intentionally, not just scaled down from desktop.

## Cross-Device Consistency
Concepts, terminology and workflows must remain consistent across:
- iPhone
- Android
- Mac
- Windows
- tablet

## Search
Provide both:
- module search
- global search

## Filters and Sorting
Keep both simple, visible and fast.

## Quick Actions
Allow safe common actions directly from lists/cards.

## Personalized Start Page
Adapt the start page to role and actual work.

## Favorites
Allow users to pin frequently used:
- customers
- projects
- vehicles
- functions

## Recent Items
Useful, but secondary to favorites and clear navigation.

## Contextual Actions
Show only actions relevant to the current context.

## Prioritization
Urgent items should be highlighted automatically without creating alert fatigue.

## Notifications
Only notify when information is genuinely useful.

## Empty States
Explain what the area is for and offer the next useful action.

## Progress
Long-running operations should visibly show progress.

## Drafts and Autosave
Long input must be protected through drafts/autosave.

## Sync Visibility
Users must be able to tell whether data is:
- synced
- syncing
- offline
- pending
- in error

## Device Switching
Users should be able to start on one device and continue on another.

## Offline
As much of the product as practical should remain usable offline.

## Conflict Handling
Never silently overwrite conflicting changes.
Safe merges should happen automatically.

## History and Restore
Important data should support:
- audit history
- version history
- restore

## Trash
Important deleted data should usually go to a recoverable trash state first.

## Backups
Backups must be automatic and independent of the primary production system.

## Import / Export
Users must be able to import existing data and export their own data.

## Integrations
The product should be integration-friendly without exposing complexity.

## Vendor Independence
Core business logic should not be tightly coupled to one provider.

## Privacy by Design
Privacy and security must be built into the architecture.

## Roles and Permissions
Flexible, but simple enough for normal businesses.

## Company and Personal Defaults
Support company-wide defaults and personal preferences.

## Final Design Rule
> If a feature is powerful but feels complicated, the design is not finished.
