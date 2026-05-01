# Dashboard Quick Transaction Design

## Goal

Let users add a transaction from the main dashboard without visiting the Transactions page, and let them create a missing category while adding or editing a transaction.

## User Experience

The dashboard gets a primary `Add transaction` button near the page header. Activating it opens a focused dialog containing the same transaction fields users already know from the Transactions page:

- Type: Expense, Income, or Transfer
- Account
- Destination account for transfers
- Category for income and expense transactions
- Amount
- Date and time
- Note

Saving from the dialog closes it, resets the form, and refreshes dashboard data so income, expenses, net, budget, top categories, and account balances update immediately.

## Inline Category Creation

For income and expense transactions, the category control includes an option to create a new category. Choosing that option reveals a compact inline category form with:

- Category name
- Accent color

The new category kind follows the current transaction type: `Expense` transactions create expense categories, and `Income` transactions create income categories. Transfers do not show category creation because they do not use categories.

When the transaction form is submitted with a new category entered, the UI first creates the category through the existing categories API, then creates or updates the transaction with the new category selected. The refreshed category list makes the new category available immediately elsewhere in the app.

## Architecture

Extract the current transaction form behavior from `TransactionsPage` into a reusable frontend component. Both the Transactions page and the dashboard dialog use this component so validation, transfer handling, category filtering, and inline category creation remain consistent.

The component accepts accounts, categories, auth token, initial mode/state, and callbacks for mutation success or cancellation. The Transactions page keeps ownership of ledger filters, transaction list actions, editing state, and status messages. The dashboard owns only dialog open/closed state and refresh behavior.

No backend API change is required. The frontend can use the existing `apiClient.createCategory`, `apiClient.createTransaction`, and `apiClient.updateTransaction` methods.

## Error Handling

If category creation fails, the transaction is not saved and the form shows the error. If transaction saving fails after category creation succeeds, the new category remains available and the form shows the transaction error. The user can retry without leaving the form.

The save button is disabled while submitting to prevent duplicate requests.

## Testing

Add focused frontend tests for:

- Opening the dashboard quick-add dialog and creating a transaction.
- Creating a missing category from the transaction form and using it for the saved transaction.
- Keeping category creation hidden for transfers.
- Preserving existing Transactions page create/edit behavior through the shared form.

Existing API workflow coverage is sufficient because this change reuses existing endpoints.
