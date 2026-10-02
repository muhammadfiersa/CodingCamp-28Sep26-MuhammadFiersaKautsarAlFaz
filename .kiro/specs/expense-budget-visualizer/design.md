# Design Document — Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a single-page, client-side web application built with plain HTML, CSS, and Vanilla JavaScript. There is no build step, no framework, and no backend. All application data lives in the browser's `localStorage`. The entire JavaScript codebase ships as one file (`js/app.js`), and all styles live in one file (`css/styles.css`).

The app has three main views — **Dashboard**, **Expense List**, and **Budget Management** — navigated through a persistent top navigation bar. A single `index.html` page hosts all three views; JavaScript toggles their visibility based on the active route.

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Single JS file (`app.js`) | Keeps the codebase simple and avoids a build pipeline |
| Module pattern (IIFE) | Encapsulates state without polluting `window`; no ES modules needed |
| Single Storage key | Simplifies read/write and guarantees atomic updates |
| Canvas charts (no library) | Meets the "Vanilla JS only" constraint while supporting bar and pie charts |
| CSS custom properties | Centralises the design tokens (colours, spacing) for easy theming |
| Responsive breakpoints at 768 px and 1024 px | Covers the 360–1920 px range from the requirements |

---

## Architecture

The application follows a **layered MVC-style** architecture inside a single IIFE module.

```
┌──────────────────────────────────────────────────┐
│                    index.html                     │
│   (DOM skeleton – views, forms, nav, canvas)     │
└──────────────────────┬───────────────────────────┘
                       │ loads
┌──────────────────────▼───────────────────────────┐
│                    js/app.js                      │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Data Layer                                  │ │
│  │  - AppState (in-memory)                      │ │
│  │  - StorageManager (read/write localStorage) │ │
│  │  - Serializer (JSON encode/decode)           │ │
│  └──────────────────┬──────────────────────────┘ │
│                     │                             │
│  ┌──────────────────▼──────────────────────────┐ │
│  │  Business Logic Layer                        │ │
│  │  - ExpenseService (CRUD + validation)        │ │
│  │  - BudgetService (CRUD + validation)         │ │
│  │  - CategoryService (CRUD + validation)       │ │
│  │  - FilterEngine (filter/sort)                │ │
│  │  - SummaryCalculator (totals, percentages)   │ │
│  │  - CSVExporter (generate CSV string)         │ │
│  └──────────────────┬──────────────────────────┘ │
│                     │                             │
│  ┌──────────────────▼──────────────────────────┐ │
│  │  UI / View Layer                             │ │
│  │  - Router (view switching)                   │ │
│  │  - DashboardView (render summary + charts)   │ │
│  │  - ExpenseListView (render list + filter UI) │ │
│  │  - BudgetView (render budget list + form)    │ │
│  │  - ChartRenderer (canvas bar + pie)          │ │
│  │  - FormController (form bind/reset/validate) │ │
│  │  - NotificationManager (toast messages)      │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
                       │ styles
┌──────────────────────▼───────────────────────────┐
│                   css/styles.css                  │
│   (custom properties, layout, components)         │
└──────────────────────────────────────────────────┘
```

### Data flow for a typical user action (e.g. adding an expense)

```
User submits form
  → FormController reads DOM values
  → ExpenseService.validate(expense) → returns errors[]
  → If errors: FormController shows inline messages, stops
  → If valid: AppState.expenses.push(expense)
  → StorageManager.save(AppState)          ← always sync
  → ExpenseListView.render(AppState)
  → DashboardView.render(AppState)         ← summary + charts
  → FormController.reset()
  → NotificationManager.show("Expense saved")
```

---

## Components and Interfaces

All components live inside the top-level IIFE. Each is an object literal or a set of related functions. Below is the public interface of every component.

### AppState

```js
// Single source of truth, never touched directly by views
AppState = {
  expenses: Expense[],       // all saved expenses
  budgets:  Budget[],        // all saved budgets
  categories: Category[],    // all categories (including defaults)
  activeView: 'dashboard' | 'expenses' | 'budgets',
  selectedPeriod: 'YYYY-MM', // currently viewed period
  activeFilters: FilterConfig
}
```

### StorageManager

```js
StorageManager.save(state)        // serialize and write to localStorage
StorageManager.load()             // read and deserialize; throws on failure
StorageManager.isAvailable()      // boolean – feature-detects localStorage
```

Single key: `"evb_data"` (Expense & Budget Visualizer data).

### Serializer

```js
Serializer.encode(state)          // → JSON string
Serializer.decode(jsonStr)        // → AppState (with Date objects restored)
```

`Date` fields are stored as ISO-8601 strings and restored via `new Date()` during decode, ensuring strict field equality on round-trip (Requirement 5.5).

### ExpenseService

```js
ExpenseService.validate(expense)              // → string[] (error messages)
ExpenseService.add(state, expense)            // → { state, errors }
ExpenseService.update(state, id, updates)     // → { state, errors }
ExpenseService.remove(state, id)              // → state
```

Validation rules applied:
- `amount`: numeric, in `[0.01, 999999999.99]`
- `category`: non-empty string, ≤ 100 chars
- `date`: valid calendar date, not in the future
- `description`: optional, ≤ 500 chars

### BudgetService

```js
BudgetService.validate(state, budget)         // → string[] (error messages)
BudgetService.add(state, budget)              // → { state, errors }
BudgetService.update(state, id, updates)      // → { state, errors }
BudgetService.remove(state, id)              // → state
BudgetService.getStatus(spending, limit)      // → { status: 'ok'|'warning', overspent: number }
```

### CategoryService

```js
CategoryService.validate(state, name)         // → string[] (error messages)
CategoryService.add(state, name)              // → { state, errors }
CategoryService.remove(state, id, confirm)    // → { state, associationCounts }
CategoryService.getDefaults()                 // → string[]  ['Food','Transport',...]
```

### FilterEngine

```js
FilterEngine.apply(expenses, filters)         // → Expense[]
FilterEngine.sort(expenses, field, dir)       // → Expense[]  (default: date desc)
```

`FilterConfig`:
```js
{
  category: string | null,
  dateFrom: Date | null,
  dateTo:   Date | null,
  period:   'YYYY-MM' | null
}
```

### SummaryCalculator

```js
SummaryCalculator.periodSummary(expenses, budgets, period)
// → { totalSpending, totalBudgeted, remaining, perCategory: [] }

SummaryCalculator.progressPercent(spending, limit)
// → number  (capped at 100)

SummaryCalculator.piePercentages(categoryTotals)
// → [{ category, amount, percent: string }]  // percent rounded to 1dp
```

### CSVExporter

```js
CSVExporter.generate(expenses, period)        // → string (full CSV text)
CSVExporter.filename(period)                  // → 'expenses-YYYY-MM.csv'
CSVExporter.escapeField(value)                // → string (RFC 4180 escaping)
CSVExporter.triggerDownload(csvText, filename) // fires anchor click
```

### Router

```js
Router.navigate(viewName)   // shows the target view, hides others, updates nav
Router.init()               // attaches nav link click handlers
```

### ChartRenderer

```js
ChartRenderer.drawBar(canvas, data)
// data: [{ label: string, value: number, color: string }]

ChartRenderer.drawPie(canvas, data)
// data: [{ label: string, value: number, color: string }]
```

Both functions clear the canvas before drawing. They use the Canvas 2D API directly — no external charting library.

### NotificationManager

```js
NotificationManager.show(message, type)   // type: 'success'|'error'|'info'
// renders a toast that auto-dismisses after 4 seconds
```

### FormController

```js
FormController.bindExpenseForm(onSubmit)
FormController.populateExpenseForm(expense)   // for edit mode
FormController.resetExpenseForm()
FormController.bindBudgetForm(onSubmit)
FormController.resetBudgetForm()
FormController.showFieldError(fieldId, message)
FormController.clearFieldErrors()
```

---

## Data Models

All objects stored in `localStorage` under the single key `"evb_data"` as a JSON-serialised `AppState`.

### Expense

```js
{
  id:          string,   // crypto.randomUUID() or Date.now().toString() fallback
  amount:      number,   // float, 0.01–999999999.99
  category:    string,   // category name (max 100 chars)
  date:        string,   // ISO-8601 date string 'YYYY-MM-DD'
  description: string    // optional, max 500 chars; empty string if omitted
}
```

### Budget

```js
{
  id:       string,   // crypto.randomUUID()
  category: string,   // category name
  period:   string,   // 'YYYY-MM'
  limit:    number    // float, 0.01–999999999.99
}
```

### Category

```js
{
  id:   string,   // crypto.randomUUID()
  name: string    // unique (case-insensitive), 1–50 chars
}
```

### AppState (persisted)

```js
{
  expenses:   Expense[],
  budgets:    Budget[],
  categories: Category[]
  // UI state (activeView, selectedPeriod, activeFilters) is NOT persisted
}
```

### Storage schema version

A `version` field is stored alongside the data to support future migrations:

```js
{
  version:  1,
  expenses: [...],
  budgets:  [...],
  categories: [...]
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Invalid amount is always rejected

*For any* value that is non-numeric, zero, negative, or greater than 999,999,999.99, `ExpenseService.validate()` SHALL return a non-empty errors array and the expense SHALL NOT be added to `AppState.expenses`.

**Validates: Requirements 1.4**

---

### Property 2: Future dates are always rejected

*For any* date string that represents a calendar date strictly after today's date, `ExpenseService.validate()` SHALL return a non-empty errors array containing a date error.

**Validates: Requirements 1.5**

---

### Property 3: Missing required fields are always rejected

*For any* expense object where at least one of `amount`, `category`, or `date` is absent or empty, `ExpenseService.validate()` SHALL return a non-empty errors array identifying each missing field, and the expense SHALL NOT be written to Storage.

**Validates: Requirements 1.3**

---

### Property 4: Expense list is always sorted by date descending

*For any* non-empty collection of expenses rendered by `ExpenseListView`, every adjacent pair of items SHALL satisfy `items[i].date >= items[i+1].date`.

**Validates: Requirements 2.1**

---

### Property 5: Edit form round-trip preserves all field values

*For any* valid saved expense, selecting it for editing SHALL populate each form field with a value strictly equal to the corresponding field in the stored expense object.

**Validates: Requirements 2.2**

---

### Property 6: Deletion removes the expense from all views

*For any* saved expense, after the user confirms deletion, that expense's `id` SHALL NOT appear in `AppState.expenses`, SHALL NOT appear in any rendered expense list, and SHALL NOT be present in Storage.

**Validates: Requirements 2.4**

---

### Property 7: Active filter returns exactly the matching subset

*For any* collection of expenses and any `FilterConfig`, `FilterEngine.apply(expenses, filters)` SHALL return a subset where every returned expense matches all active filter criteria, and every expense that matches all criteria IS included in the result.

**Validates: Requirements 2.6**

---

### Property 8: Clearing a filter restores the full unfiltered list

*For any* collection of expenses with any filter applied, clearing all filters SHALL result in `FilterEngine.apply(expenses, {})` returning a list of the same length as the original unfiltered collection.

**Validates: Requirements 2.8**

---

### Property 9: Budget persistence round-trip

*For any* valid budget object, saving it via `BudgetService.add()` and then loading via `StorageManager.load()` SHALL return a budget object where every field is strictly equal to the original.

**Validates: Requirements 3.2**

---

### Property 10: Invalid budget limits are always rejected

*For any* value that is non-numeric, zero, or negative, `BudgetService.validate()` SHALL return a non-empty errors array and the budget SHALL NOT be written to Storage.

**Validates: Requirements 3.3**

---

### Property 11: Duplicate budget for same category and period is always rejected

*For any* existing budget with a given `(category, period)` pair, attempting to add a second budget with the same pair SHALL return a validation error and SHALL NOT write the new budget to Storage.

**Validates: Requirements 3.4**

---

### Property 12: Budget status is correct for all spending / limit combinations

*For any* `spending` and `limit` where `spending < limit`, `BudgetService.getStatus(spending, limit).status` SHALL equal `'ok'`. *For any* `spending >= limit`, it SHALL equal `'warning'` with `overspent = spending - limit`.

**Validates: Requirements 3.5, 3.6**

---

### Property 13: Period summary arithmetic is always correct

*For any* collection of expenses and budgets for a given period, `SummaryCalculator.periodSummary()` SHALL return `totalSpending` equal to the sum of all expense amounts in the period, `totalBudgeted` equal to the sum of all budget limits in the period, and `remaining = totalBudgeted - totalSpending`.

**Validates: Requirements 4.2**

---

### Property 14: Progress percentage is capped at 100

*For any* `spending >= 0` and `limit > 0`, `SummaryCalculator.progressPercent(spending, limit)` SHALL return `Math.min((spending / limit) * 100, 100)`.

**Validates: Requirements 4.3**

---

### Property 15: Pie chart percentages sum to ~100 and are rounded to 1 decimal place

*For any* non-empty array of positive category spending amounts, `SummaryCalculator.piePercentages()` SHALL return an array where each `percent` string has exactly one decimal place and the numeric sum of all percentages is between 99.9 and 100.1 (allowing for rounding).

**Validates: Requirements 4.6**

---

### Property 16: Storage serialisation round-trip preserves all fields

*For any* valid `AppState` object, `Serializer.decode(Serializer.encode(state))` SHALL return an object where every field of every `Expense` and `Budget` is strictly equal (`===`) to the corresponding field in the original object.

**Validates: Requirements 5.4, 5.5**

---

### Property 17: CSV generation round-trip preserves expense data

*For any* non-empty array of expenses, `CSVExporter.generate(expenses)` SHALL produce a string that, when parsed as RFC 4180 CSV, yields rows where each field is equal to the corresponding field in the original expense object.

**Validates: Requirements 6.1, 6.4**

---

### Property 18: CSV field escaping is correct for all special characters

*For any* field value containing at least one of: a comma, a double-quote, or a newline, `CSVExporter.escapeField(value)` SHALL wrap the value in double-quotes and escape all internal double-quotes as `""`.

**Validates: Requirements 6.4**

---

### Property 19: Export filename matches period

*For any* valid period string `'YYYY-MM'`, `CSVExporter.filename(period)` SHALL return the string `'expenses-YYYY-MM.csv'` with the year zero-padded to 4 digits and the month zero-padded to 2 digits.

**Validates: Requirements 6.2**

---

### Property 20: Category name uniqueness (case-insensitive)

*For any* existing category name and any string that differs only in case, `CategoryService.validate()` SHALL return a duplicate validation error.

**Validates: Requirements 7.3**

---

### Property 21: Category name length validation

*For any* string of length 0 or greater than 50 characters, `CategoryService.validate()` SHALL return a validation error. *For any* string of length 1–50, it SHALL return no length error.

**Validates: Requirements 7.4**

---

### Property 22: Deleted category reassigns all associated expenses to "Uncategorized"

*For any* category and *any* set of expenses belonging to that category, after `CategoryService.remove()` is confirmed, every formerly-associated expense SHALL have its `category` field equal to `"Uncategorized"` and the category SHALL not be present in `AppState.categories`.

**Validates: Requirements 7.7**

---

## Error Handling

### Validation errors (inline, non-blocking)

Every service function returns an `errors: string[]` array. The `FormController` maps each error to the adjacent field using `data-field` attributes on error containers. Errors are cleared on each new submission attempt.

### Storage errors (toast notification)

| Scenario | Handling |
|---|---|
| `localStorage.getItem` throws on load | `NotificationManager.show(msg, 'error')` — app starts with empty state, existing storage left untouched (Req 5.3) |
| `localStorage.setItem` throws after mutation | `NotificationManager.show(msg, 'error')` — in-memory state is kept, user can continue working (Req 5.6) |
| `localStorage` not available | Detected once at startup by `StorageManager.isAvailable()`; persistent error banner shown |

### Chart rendering errors

If a `<canvas>` element is missing from the DOM, `ChartRenderer` logs a console warning and returns silently — no unhandled exceptions.

### Unknown/corrupt Storage data

If `Serializer.decode()` throws (malformed JSON or missing required fields), the app treats it the same as a storage load failure: display error notification and start with empty state.

---

## Testing Strategy

### Unit tests — example-based

Focus on specific, concrete behaviors that are not covered by property tests:

- **Router**: navigating to each view shows the correct section and hides the others
- **NotificationManager**: a toast appears after `show()` and disappears after the auto-dismiss timeout
- **FormController**: `populateExpenseForm(expense)` sets each field to the correct DOM value
- **StorageManager**: `isAvailable()` returns `false` when `localStorage` is blocked
- **ChartRenderer**: calling `drawBar` or `drawPie` with an empty data array clears the canvas without throwing
- **CategoryService**: deleting a category with 0 associations skips the confirmation step
- **CategoryService**: deleting a category with associations returns correct `associationCounts`
- **Dashboard empty-state**: renders the empty-state message when `expenses.length === 0` for the selected period
- **Budget no-budget edge case**: summary shows `totalBudgeted = 0` when no budgets exist for the period

### Property-based tests — universal properties

Use a property-based testing library appropriate for Vanilla JS. Each test runs a minimum of **100 iterations**.

Every property test is tagged with a comment in this format:
```
// Feature: expense-budget-visualizer, Property N: <property_text>
```

| Property | Function under test | Generator strategy |
|---|---|---|
| P1 – Invalid amount rejected | `ExpenseService.validate` | Generate floats outside `[0.01, 999999999.99]`, strings, `NaN`, `Infinity` |
| P2 – Future date rejected | `ExpenseService.validate` | Generate ISO dates from tomorrow to +100 years |
| P3 – Missing required fields rejected | `ExpenseService.validate` | Generate expense objects with random subsets of required fields removed |
| P4 – List sorted date descending | `FilterEngine.sort` | Generate arrays of 1–200 expenses with random dates |
| P5 – Edit form round-trip | `FormController.populateExpenseForm` | Generate valid expense objects with arbitrary field values |
| P6 – Deletion removes from all views | `ExpenseService.remove` | Generate an expense list; remove a random one; verify absence |
| P7 – Active filter returns matching subset | `FilterEngine.apply` | Generate expenses and random valid `FilterConfig` objects |
| P8 – Clearing filter restores full list | `FilterEngine.apply` | Generate expenses and filters; apply then clear |
| P9 – Budget persistence round-trip | `BudgetService.add` + `StorageManager` | Generate valid budget objects |
| P10 – Invalid budget limits rejected | `BudgetService.validate` | Generate non-positive numbers and non-numeric strings |
| P11 – Duplicate budget rejected | `BudgetService.validate` | Generate a state with a budget; generate a matching (category, period) pair |
| P12 – Budget status correct | `BudgetService.getStatus` | Generate `(spending, limit)` pairs in both `spending < limit` and `spending >= limit` ranges |
| P13 – Period summary arithmetic | `SummaryCalculator.periodSummary` | Generate random sets of expenses and budgets for a period |
| P14 – Progress percentage capped at 100 | `SummaryCalculator.progressPercent` | Generate `(spending, limit)` pairs including `spending >> limit` cases |
| P15 – Pie percentages sum to ~100 | `SummaryCalculator.piePercentages` | Generate arrays of 1–20 positive amounts |
| P16 – Storage serialisation round-trip | `Serializer.encode` + `Serializer.decode` | Generate valid `AppState` objects with varied field values |
| P17 – CSV generation round-trip | `CSVExporter.generate` | Generate expenses with varied field values |
| P18 – CSV field escaping | `CSVExporter.escapeField` | Generate strings containing commas, double-quotes, newlines, and combinations |
| P19 – Export filename matches period | `CSVExporter.filename` | Generate (year, month) pairs; verify zero-padding |
| P20 – Category name uniqueness (case-insensitive) | `CategoryService.validate` | Generate a category name; generate random case variations |
| P21 – Category name length validation | `CategoryService.validate` | Generate strings of length 0, 1, 50, 51, and random lengths |
| P22 – Deleted category reassigns expenses | `CategoryService.remove` | Generate category + expense set; delete category; verify reassignment |

### Integration tests

- Full CRUD cycle for expenses: create → read → update → delete, with Storage state verified at each step
- Full CRUD cycle for budgets
- Period change on Dashboard: verify all summary values and chart data recalculate correctly
- Export with active period filter: verify CSV contains only expenses from that period
- App reload with pre-populated Storage: verify all data is restored correctly

### Browser compatibility

The app targets Chrome, Firefox, Edge, and Safari. Compatibility is ensured by avoiding:
- ES modules (use IIFE instead)
- `import`/`export` syntax
- Modern APIs without broad support (e.g. `structuredClone` — use JSON round-trip instead)
- CSS features below ~95% global support (use standard Flexbox and Grid)
