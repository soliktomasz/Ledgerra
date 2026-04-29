# AI Keys and Monthly Report Import Design

## Goal

Ledgerra will let authenticated users store encrypted API keys for OpenAI and Anthropic, then use a selected provider to analyze monthly account reports from PDF or CSV files. Parsed results will be shown as editable transaction drafts first; Ledgerra will only create transactions after the user reviews and confirms them.

## Scope

This feature covers:

- Encrypted storage for OpenAI and Anthropic API keys.
- Provider selection for report analysis.
- PDF and CSV upload for monthly account reports.
- AI-assisted extraction into transaction drafts.
- Review-first editing and bulk save of accepted drafts.

This feature does not cover automatic transaction creation, bank API integrations, recurring import jobs, or long-term storage of uploaded report files.

## User Experience

Settings gains an AI providers section. Users can save, replace, or remove an OpenAI key and an Anthropic key. The UI shows whether each provider is configured and masks stored values; raw keys are never displayed after saving. Users can choose a default provider for imports.

A new Imports page lets users choose an account, month, AI provider, and a PDF or CSV file. After upload, Ledgerra analyzes the report and returns draft rows. Each row can be edited before saving:

- date and time
- transaction type
- account
- category
- amount
- note
- confidence
- warnings

The review screen lets users discard incorrect rows and save the remaining selected rows. Saved rows become normal Ledgerra transactions and appear in the existing Transactions and Dashboard views.

## Backend Architecture

Add domain models for per-user AI settings:

- `AiProviderCredential`
  - `Id`
  - `UserId`
  - `Provider` (`OpenAi`, `Anthropic`)
  - encrypted key payload
  - key fingerprint or masked suffix for display
  - `CreatedAtUtc`
  - `UpdatedAtUtc`

- `UserAiPreference`
  - `UserId`
  - `DefaultProvider`

Add EF mappings to `LedgerraDbContext`. The current app uses `EnsureCreated`, so no migration file is required unless the repository later adopts migrations.

Add an encryption service in Infrastructure. It should use ASP.NET Core Data Protection or an equivalent authenticated encryption API, with purpose-specific protectors for AI credentials. The encrypted blob is stored in the database; decrypted keys are only held in memory while calling the selected provider.

Add provider abstractions:

- `IAiReportAnalysisClient`
- `OpenAiReportAnalysisClient`
- `AnthropicReportAnalysisClient`
- `AiReportAnalysisClientFactory`

Each provider client accepts normalized report content plus user account/category context and returns a structured analysis response. The service should validate provider output before returning drafts to the frontend.

Add report extraction:

- CSV files are parsed server-side into rows using a structured CSV parser.
- PDF files are converted to text server-side before AI analysis.
- File size and content type are validated before parsing.

If PDF text extraction cannot read usable text, the API returns a clear validation error rather than creating empty drafts.

## API Design

Add settings endpoints under `api/settings/ai`:

- `GET /api/settings/ai`
  - returns configured provider statuses and default provider.
- `PUT /api/settings/ai/{provider}`
  - saves or replaces an encrypted provider key.
- `DELETE /api/settings/ai/{provider}`
  - removes a stored key.
- `PUT /api/settings/ai/default-provider`
  - updates the default provider.

Add import endpoints under `api/imports/monthly-report`:

- `POST /api/imports/monthly-report/analyze`
  - multipart form with account id, month, provider, and file.
  - returns draft transactions and warnings.
- `POST /api/imports/monthly-report/commit`
  - accepts reviewed draft transactions.
  - validates account/category ownership and creates transactions.

The analyze endpoint does not save uploaded files or transactions. The commit endpoint treats the frontend drafts as untrusted input and repeats all ownership and transaction validation.

## Data Flow

1. User stores an OpenAI or Anthropic key in Settings.
2. Backend encrypts the key and stores only the encrypted value plus masked metadata.
3. User uploads a monthly PDF or CSV on the Imports page.
4. Backend validates file metadata and extracts report text or rows.
5. Backend loads the user’s accounts and categories.
6. Backend decrypts the selected provider key in memory.
7. Provider client asks the AI model for structured transaction drafts.
8. Backend validates the AI response and returns drafts.
9. User reviews, edits, selects, or discards drafts.
10. Backend validates confirmed drafts and creates transactions.

## Error Handling

Settings errors:

- Missing or invalid provider name returns validation errors.
- Empty API key payload returns validation errors.
- Raw API keys are never included in error responses or logs.

Analyze errors:

- Missing configured key returns a provider setup error.
- Unsupported file type returns validation errors.
- Unreadable PDF text returns a report parsing error.
- Provider failures return a generic provider error with enough context for the UI to retry.
- Invalid provider JSON is rejected and surfaced as an analysis failure.

Commit errors:

- Account/category ids must belong to the authenticated user.
- Amount, date, type, and category rules match the existing transaction rules.
- Partial success is avoided in the first version; if any selected draft is invalid, no transactions are created.

## Frontend Design

Settings page adds an AI providers section with:

- provider status rows for OpenAI and Anthropic
- password-style input for replacing keys
- remove buttons
- default provider selector

App navigation adds an Imports link. The Imports page contains:

- account selector
- month picker
- provider selector
- PDF/CSV file input
- analyze action
- editable draft table
- save selected drafts action

The table should be dense and utilitarian, matching the existing finance console style. Draft rows should show confidence and warnings without blocking edits.

## Testing

Backend API tests:

- saving AI credentials returns masked provider status and never returns raw keys
- removing a credential clears provider status
- analyzing without a configured provider returns a setup error
- committing reviewed drafts creates normal transactions
- invalid account/category ids are rejected on commit

Service tests:

- encryption round-trips and produces non-plaintext stored values
- CSV extraction handles common transaction columns
- AI response validation rejects malformed rows

Frontend tests:

- Settings can render configured/unconfigured provider states
- Imports page renders draft rows returned by the API
- selected reviewed drafts are submitted to commit

Provider clients should be tested with fake HTTP handlers or test doubles. Automated tests must not call real OpenAI or Anthropic APIs.

## Security and Privacy

AI keys are encrypted at rest and never returned to clients. Decrypted keys are held only for the duration of a provider request. Uploaded reports are processed transiently and not persisted in the first version. Logs must avoid raw report contents and API keys because monthly statements contain sensitive financial data.

## Open Decisions Resolved

- API keys are stored encrypted.
- OpenAI and Anthropic are both supported.
- PDF and CSV are both supported.
- Import is review-first; no automatic transaction creation.
