# Smart Import Review Design

## Summary

Ledgerra will make monthly report imports faster and safer by applying user-defined categorization rules to imported transaction drafts and by detecting likely duplicate transactions before commit. The flow remains review-first: Ledgerra can preselect trustworthy rows, unselect likely duplicates, and explain why a row was changed or flagged, but it only creates transactions after the user confirms the selected drafts.

## Goals

- Automatically apply saved import categorization rules to analyzed drafts.
- Let users create rules from import review edits and from a manual rules section.
- Detect likely duplicate transactions during import review.
- Leave likely duplicates visible but unselected by default.
- Keep imported drafts untrusted until commit validation succeeds.
- Preserve the existing AI/PDF/CSV import flow and normal transaction model.

## Non-Goals

- Bank API integrations, recurring imports, or background sync jobs.
- Automatic transaction creation without review.
- Storing uploaded report files.
- Complex machine-learning categorization beyond explicit user rules.
- Full transaction reconciliation against bank balances.

## User Experience

The Imports page keeps the existing analyze-and-review workflow. After a report is analyzed, Ledgerra returns draft rows enriched with review metadata:

- matched rule name or marker when a categorization rule changed the draft
- duplicate warning when the draft resembles an existing transaction
- selected state recommendation
- warnings from extraction, AI analysis, rule matching, or duplicate detection

Rows with no duplicate match are selected by default, including rows categorized by rules. Rows with likely duplicates are visible but unselected by default. The user can still select a duplicate row manually if it is a legitimate separate transaction.

When a user changes a draft category or type, the review UI offers a compact "remember this" action. The action creates a rule using the draft note as the initial match value and the selected category/type as the outcome. Users can also manage rules manually from a small Import Rules section on the Settings page, keeping import behavior separate from category CRUD.

## Rule Model

Add a user-owned `CategorizationRule` entity:

- `Id`
- `UserId`
- `Name`
- `MatchField`
- `MatchOperator`
- `MatchValue`
- `AssignCategoryId`
- `AssignTransactionType`
- `Priority`
- `IsActive`
- `CreatedAtUtc`
- `UpdatedAtUtc`

The first version supports `note contains` matching. The model keeps `MatchField` and `MatchOperator` explicit so later versions can add fields such as payee, amount range, or exact normalized text without changing the contract shape.

Rules are applied in priority order. The first active matching rule wins for category/type assignment. If a matching rule references an inactive or deleted category, the backend ignores that assignment and includes a warning.

## Duplicate Detection

Duplicate detection compares each draft against existing transactions owned by the user for the same account. A draft is a likely duplicate when it matches:

- same account
- same transaction type family, where income matches income and expense matches expense
- same amount
- same local calendar date after converting the draft and existing transaction timestamps to their `yyyy-MM-dd` date values
- similar note text when both notes are present

The duplicate result includes enough metadata for the frontend to explain the flag without exposing unrelated account data:

- `isLikelyDuplicate`
- `duplicateTransactionId`
- `duplicateReason`

Duplicate detection is advisory during analyze/review. The commit endpoint repeats duplicate checks for selected rows and rejects selected likely duplicates unless the request explicitly says the user accepted the duplicate. This protects against stale review state and direct API misuse.

## Backend Architecture

Add a small import review enrichment layer after report extraction and AI analysis:

1. Existing import analysis extracts report text.
2. Existing provider client returns draft transactions.
3. Backend validates basic draft shape.
4. New rule service applies active categorization rules for the user.
5. New duplicate service checks enriched drafts against existing transactions.
6. Analyze endpoint returns enriched drafts and warnings.

Suggested services:

- `IImportCategorizationRuleMatcher`
- `IImportDuplicateDetector`

The import controller should remain thin: it coordinates extraction, AI analysis, enrichment, and response mapping. Rule matching and duplicate scoring should be testable without HTTP.

## API Changes

Extend monthly report analyze responses with review metadata on each draft:

- `appliedRuleId`
- `appliedRuleName`
- `isLikelyDuplicate`
- `duplicateTransactionId`
- `duplicateReason`
- `isSelectedByDefault`

Add authenticated rule endpoints:

- `GET /api/import-rules`
- `POST /api/import-rules`
- `PUT /api/import-rules/{id}`
- `DELETE /api/import-rules/{id}`

Rule requests validate category ownership, supported transaction type, supported match field/operator, non-empty match value, names no longer than 120 characters, and match values no longer than 200 characters.

Extend monthly report commit requests so selected duplicate rows can be intentionally accepted:

- `acceptedDuplicateSourceIds`

If a selected row is still likely duplicate and its source id is not accepted, the commit returns a validation error and creates no transactions.

## Frontend Architecture

Update the Imports page to display review metadata in the draft table:

- duplicate rows are unselected by default
- duplicate badge and reason are visible in the row
- rule-applied badge is visible when a rule changed category/type
- warning text is available near affected rows
- changing category/type exposes a "remember this" action

Add import rule client calls to `apiClient` and TypeScript types for rules and enriched drafts.

Add a compact manual rule management section to Settings because rules configure application behavior and do not belong to a single category. The first version includes list rules, add rule, edit name/match/category/type/active, and delete rule.

## Data Flow

Analyze flow:

1. User uploads a report from Imports.
2. Backend analyzes the report into drafts.
3. Rule matcher assigns category/type for matching drafts.
4. Duplicate detector marks likely duplicates.
5. Backend returns enriched drafts.
6. Frontend initializes selected rows from `isSelectedByDefault`.
7. User reviews, edits, creates rules if useful, and saves selected drafts.

Commit flow:

1. Frontend submits selected drafts and any accepted duplicate source ids.
2. Backend validates account/category ownership and transaction rules.
3. Backend repeats duplicate detection for selected drafts.
4. If any unaccepted likely duplicate remains, no rows are created.
5. Backend creates normal Ledgerra transactions and returns the created rows.

## Error Handling

Rule creation and updates return validation errors for invalid match definitions, missing categories, unsupported transaction types, or duplicate rule names for the user.

Import analyze should still return usable drafts when a rule cannot be applied because of a deleted category. The affected row keeps its original category/type and receives a warning.

Commit remains all-or-nothing. Partial success is avoided so the user does not need to reconcile half-created imports.

## Testing

Backend tests should cover:

- rule creation, update, delete, and user ownership isolation
- `note contains` matching, case-insensitive behavior, and priority ordering
- ignored inactive rules
- ignored rules pointing to unavailable categories
- duplicate detection for same account/date/amount/type
- no duplicate match across different accounts
- analyze response metadata for applied rules and duplicates
- commit rejecting unaccepted likely duplicates
- commit accepting explicitly approved duplicates

Frontend tests should cover:

- duplicate drafts render unselected by default
- rule-applied and duplicate badges render from response metadata
- edited drafts can trigger rule creation
- manual rule management can create/update/delete rules through the API client
- commit sends accepted duplicate source ids only for rows the user explicitly included

## Acceptance Criteria

- Import review automatically applies active categorization rules.
- Users can create rules from edited import drafts.
- Users can create, edit, disable, and delete rules manually.
- Likely duplicate drafts are visible and unselected by default.
- Selected likely duplicates require explicit acceptance before commit.
- Commit validation prevents duplicate rows from slipping through stale or tampered review state.
- Existing account, category, transaction, budget, dashboard, and AI settings behavior remains unchanged.
