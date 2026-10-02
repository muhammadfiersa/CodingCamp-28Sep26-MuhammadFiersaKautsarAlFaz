# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a single-page, client-side web application using plain HTML, CSS, and Vanilla JavaScript. All code lives in three files: `index.html`, `css/styles.css`, and `js/app.js`. All data is persisted in `localStorage` under the single key `"evb_data"`. The app follows a layered MVC-style architecture inside a single IIFE module.

## Tasks

- [ ] 1. Set up project skeleton and CSS design tokens
  - [ ] 1.1 Create `index.html` with full DOM skeleton
    - Create `index.html` at the workspace root
    - Include `<head>` with viewport meta tag, charset, title, and link to `css/styles.css`
    - Add `<nav>` top bar with links for Dashboard, Expense List, and Budget Management views
    - Add `<main>` with three `<section>` elements: `#view-dashboard`, `#view-expenses`, `#view-budgets`
    - Add the expense entry form inside `#view-expenses` with fields: amount, category (select), date, description, and a hidden `data-editing-id` input
    - Add the budget entry form inside `#view-budgets` with fields: category (select), period (month input), limit
    - Add two `<canvas>` elements inside `#view-dashboard`: `#chart-bar` and `#chart-pie`
    - Add a `<div id="toast-container">` for notification toasts
    - Add a `<script src="js/app.js">` tag at the bottom of `<body>`
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 4.5, 4.6, 8.3_

  - [ ] 1.2 Create `css/styles.css` with CSS custom properties and base styles
    - Define CSS custom properties (`:root`) for colours, spacing, font sizes, and border-radius
    - Apply CSS reset (`box-sizing: border-box`, `margin: 0`, `padding: 0`)
    - Style the `<body>` with base font (minimum 14px), line height, and background colour
    - Style headings H1–H3 with distinct sizes to establish visual hierarchy
    - Ensure all body text colour meets WCAG 2.1 AA 4.5:1 contrast ratio against its background
    - _Requirements: 8.1, 8.2_

- [ ] 2. Implement the CSS layout system and navigation
  - [ ] 2.1 Build responsive layout and navigation styles
    - Lay out the app shell with a top navigation bar and a `<main>` content area using Flexbox
    - Style nav links with hover state and active-link visual distinction
    - Add responsive breakpoints: ≥1024 px (desktop), 768–1023 px (single-column, nav visible), <768 px (hamburger hidden menu)
    - Add a hamburger toggle button `<button id="nav-toggle">` in the nav (visible only below 768 px)
    - Style the hidden menu so activating the toggle expands it to show all view links
    - _Requirements: 8.1, 8.3, 8.4, 8.6_

  - [ ] 2.2 Add interactive control styles (focus ring, hover, form, buttons, progress bar, toast)
    - Add visible `:focus-visible` focus ring on all interactive elements (buttons, inputs, selects, links)
    - Add hover state styles on all interactive controls
    - Style form fields, labels, and inline error message containers (`[data-error]`)
    - Style primary and secondary buttons
    - Style progress bar component (neutral/positive state and warning/overspent state)
    - Style the toast notification container and individual toast elements (success, error, info)
    - Style the expense list table/cards and the empty-state message element
    - _Requirements: 8.2, 8.5_

- [ ] 3. Implement the Data Layer (AppState, Serializer, StorageManager)
  - [ ] 3.1 Create `js/app.js` IIFE skeleton and AppState
    - Create `js/app.js` with a top-level IIFE `(function() { 'use strict'; ... })()`
    - Define the `AppState` object with properties: `expenses`, `budgets`, `categories`, `activeView`, `selectedPeriod`, `activeFilters`
    - _Requirements: 5.1, 5.2_

  - [ ] 3.2 Implement Serializer (encode / decode)
    - Implement `Serializer.encode(state)` that returns a JSON string of `{ version: 1, expenses, budgets, categories }`
    - Implement `Serializer.decode(jsonStr)` that parses the JSON and restores Date objects from ISO-8601 strings; throws on malformed input
    - Expense `date` field is stored and read as an ISO-8601 string `'YYYY-MM-DD'`
    - _Requirements: 5.4, 5.5_

  - [ ]* 3.3 Write property test for Serializer round-trip (Property 16)
    - **Property 16: Storage serialisation round-trip preserves all fields**
    - **Validates: Requirements 5.4, 5.5**
    - Generate valid `AppState` objects with varied field values; assert `Serializer.decode(Serializer.encode(state))` produces strictly equal fields for every Expense and Budget

  - [ ] 3.4 Implement StorageManager (save / load / isAvailable)
    - Implement `StorageManager.isAvailable()` using a try/catch feature-detection write to `localStorage`
    - Implement `StorageManager.save(state)` that calls `Serializer.encode` and writes to `localStorage` key `"evb_data"`; throws (caller handles) on `setItem` failure
    - Implement `StorageManager.load()` that reads `"evb_data"`, calls `Serializer.decode`, and returns the parsed state; throws on failure
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

- [ ] 4. Implement CategoryService and seed default categories
  - [ ] 4.1 Implement CategoryService (validate / add / remove / getDefaults)
    - Implement `CategoryService.getDefaults()` returning `['Food', 'Transport', 'Housing', 'Entertainment', 'Health', 'Other']`
    - Implement `CategoryService.validate(state, name)` returning errors for: empty name, name > 50 chars, case-insensitive duplicate
    - Implement `CategoryService.add(state, name)` that validates, assigns a UUID id, and returns `{ state, errors }`
    - Implement `CategoryService.remove(state, id, confirm)` that returns `{ state, associationCounts }` and, on confirm, deletes the category and reassigns all associated expenses to `"Uncategorized"`
    - Seed default categories into `AppState` on first load when `categories` array is empty
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 4.2 Write property test for category name uniqueness (Property 20)
    - **Property 20: Category name uniqueness (case-insensitive)**
    - **Validates: Requirements 7.3**
    - Generate an existing category name; generate random case variations; assert `CategoryService.validate()` returns a duplicate error for each variant

  - [ ]* 4.3 Write property test for category name length validation (Property 21)
    - **Property 21: Category name length validation**
    - **Validates: Requirements 7.4**
    - Generate strings of length 0, 1, 50, 51, and random lengths; assert errors for length 0 and >50, no length error for 1–50

  - [ ]* 4.4 Write property test for deleted category expense reassignment (Property 22)
    - **Property 22: Deleted category reassigns all associated expenses to "Uncategorized"**
    - **Validates: Requirements 7.7**
    - Generate a category and a set of associated expenses; confirm deletion; assert every formerly-associated expense has `category === "Uncategorized"` and the category is absent from `AppState.categories`

- [ ] 5. Implement ExpenseService (validate / add / update / remove)
  - [ ] 5.1 Implement ExpenseService validation and CRUD
    - Implement `ExpenseService.validate(expense)` checking: amount is numeric and in `[0.01, 999999999.99]`; category is non-empty string ≤100 chars; date is a valid non-future calendar date; description ≤500 chars when provided
    - Implement `ExpenseService.add(state, expense)` that validates, assigns UUID, pushes to `state.expenses`, and returns `{ state, errors }`
    - Implement `ExpenseService.update(state, id, updates)` that validates and replaces the matching expense, returning `{ state, errors }`
    - Implement `ExpenseService.remove(state, id)` that filters out the matching expense and returns updated state
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4_

  - [ ]* 5.2 Write property test for invalid amount rejection (Property 1)
    - **Property 1: Invalid amount is always rejected**
    - **Validates: Requirements 1.4**
    - Generate floats outside `[0.01, 999999999.99]`, strings, `NaN`, `Infinity`; assert `ExpenseService.validate()` returns non-empty errors and expense is not added to state

  - [ ]* 5.3 Write property test for future date rejection (Property 2)
    - **Property 2: Future dates are always rejected**
    - **Validates: Requirements 1.5**
    - Generate ISO dates from tomorrow to +100 years; assert `ExpenseService.validate()` returns a date error

  - [ ]* 5.4 Write property test for missing required fields rejection (Property 3)
    - **Property 3: Missing required fields are always rejected**
    - **Validates: Requirements 1.3**
    - Generate expense objects with random subsets of required fields removed; assert `ExpenseService.validate()` returns errors identifying each missing field

  - [ ]* 5.5 Write property test for expense deletion removes from all views (Property 6)
    - **Property 6: Deletion removes the expense from all views**
    - **Validates: Requirements 2.4**
    - Generate an expense list; remove a random expense; assert its `id` is absent from `AppState.expenses` and from `StorageManager.load().expenses`

- [ ] 6. Implement FilterEngine (apply / sort)
  - [ ] 6.1 Implement FilterEngine (apply / sort)
    - Implement `FilterEngine.sort(expenses, field, dir)` defaulting to date descending
    - Implement `FilterEngine.apply(expenses, filters)` filtering by `category`, `dateFrom` (inclusive), `dateTo` (inclusive), and `period` (`YYYY-MM`); returns the matching subset
    - _Requirements: 2.1, 2.6, 2.7, 2.8_

  - [ ]* 6.2 Write property test for filter returns matching subset (Property 7)
    - **Property 7: Active filter returns exactly the matching subset**
    - **Validates: Requirements 2.6**
    - Generate expenses and random valid `FilterConfig` objects; assert every returned expense matches all active criteria and every matching expense is included

  - [ ]* 6.3 Write property test for sort date descending (Property 4)
    - **Property 4: Expense list is always sorted by date descending**
    - **Validates: Requirements 2.1**
    - Generate arrays of 1–200 expenses with random dates; assert every adjacent pair satisfies `items[i].date >= items[i+1].date`

  - [ ]* 6.4 Write property test for clearing filter restores full list (Property 8)
    - **Property 8: Clearing a filter restores the full unfiltered list**
    - **Validates: Requirements 2.8**
    - Generate expenses and filters; apply then clear; assert result length equals original unfiltered collection length

- [ ] 7. Implement BudgetService (validate / add / update / remove / getStatus)
  - [ ] 7.1 Implement BudgetService validation and CRUD
    - Implement `BudgetService.validate(state, budget)` checking: limit is numeric and positive in `[0.01, 999999999.99]`; no duplicate `(category, period)` pair exists in `state.budgets`
    - Implement `BudgetService.add(state, budget)` that validates, assigns UUID, pushes to `state.budgets`, returns `{ state, errors }`
    - Implement `BudgetService.update(state, id, updates)` that validates and replaces the matching budget, returning `{ state, errors }`
    - Implement `BudgetService.remove(state, id)` that filters out the matching budget and returns updated state
    - Implement `BudgetService.getStatus(spending, limit)` returning `{ status: 'ok'|'warning', overspent: number }`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 7.2 Write property test for invalid budget limit rejection (Property 10)
    - **Property 10: Invalid budget limits are always rejected**
    - **Validates: Requirements 3.3**
    - Generate non-positive numbers and non-numeric strings; assert `BudgetService.validate()` returns non-empty errors and budget is not written to Storage

  - [ ]* 7.3 Write property test for duplicate budget rejection (Property 11)
    - **Property 11: Duplicate budget for same category and period is always rejected**
    - **Validates: Requirements 3.4**
    - Generate a state with a budget; generate a matching `(category, period)` pair; assert validation returns an error and no new budget is added

  - [ ]* 7.4 Write property test for budget status correctness (Property 12)
    - **Property 12: Budget status is correct for all spending / limit combinations**
    - **Validates: Requirements 3.5, 3.6**
    - Generate `(spending, limit)` pairs in both `spending < limit` and `spending >= limit` ranges; assert correct `status` and `overspent` values

  - [ ]* 7.5 Write property test for budget persistence round-trip (Property 9)
    - **Property 9: Budget persistence round-trip**
    - **Validates: Requirements 3.2**
    - Generate valid budget objects; save via `BudgetService.add()`, load via `StorageManager.load()`; assert every field is strictly equal to the original

- [ ] 8. Checkpoint — Ensure all service-layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement SummaryCalculator and CSVExporter
  - [ ] 9.1 Implement SummaryCalculator (periodSummary / progressPercent / piePercentages)
    - Implement `SummaryCalculator.periodSummary(expenses, budgets, period)` returning `{ totalSpending, totalBudgeted, remaining, perCategory: [] }`; `remaining` is `totalBudgeted - totalSpending`
    - Implement `SummaryCalculator.progressPercent(spending, limit)` returning `Math.min((spending / limit) * 100, 100)`
    - Implement `SummaryCalculator.piePercentages(categoryTotals)` returning `[{ category, amount, percent }]` where each `percent` is rounded to 1 decimal place
    - _Requirements: 4.2, 4.3, 4.6_

  - [ ]* 9.2 Write property test for period summary arithmetic (Property 13)
    - **Property 13: Period summary arithmetic is always correct**
    - **Validates: Requirements 4.2**
    - Generate random sets of expenses and budgets for a period; assert `totalSpending`, `totalBudgeted`, and `remaining` are computed correctly

  - [ ]* 9.3 Write property test for progress percentage capped at 100 (Property 14)
    - **Property 14: Progress percentage is capped at 100**
    - **Validates: Requirements 4.3**
    - Generate `(spending, limit)` pairs including cases where `spending >> limit`; assert result equals `Math.min((spending / limit) * 100, 100)`

  - [ ]* 9.4 Write property test for pie percentages sum to ~100 (Property 15)
    - **Property 15: Pie chart percentages sum to ~100 and are rounded to 1 decimal place**
    - **Validates: Requirements 4.6**
    - Generate arrays of 1–20 positive amounts; assert each `percent` has exactly one decimal place and numeric sum is between 99.9 and 100.1

  - [ ] 9.5 Implement CSVExporter (generate / filename / escapeField / triggerDownload)
    - Implement `CSVExporter.escapeField(value)` per RFC 4180: wrap in double-quotes if value contains a comma, double-quote, or newline; escape internal double-quotes as `""`
    - Implement `CSVExporter.filename(period)` returning `'expenses-YYYY-MM.csv'` with zero-padded year and month
    - Implement `CSVExporter.generate(expenses, period)` filtering expenses to the given period, outputting a header row `date,category,amount,description` followed by one data row per expense
    - Implement `CSVExporter.triggerDownload(csvText, filename)` creating a Blob URL and clicking a temporary `<a>` element
    - Handle the empty-period case: return an empty string (caller will show a message instead of triggering download)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 9.6 Write property test for CSV round-trip preserves expense data (Property 17)
    - **Property 17: CSV generation round-trip preserves expense data**
    - **Validates: Requirements 6.1, 6.4**
    - Generate arrays of expenses with varied field values; assert CSV, when parsed as RFC 4180, yields rows where each field equals the original expense field

  - [ ]* 9.7 Write property test for CSV field escaping (Property 18)
    - **Property 18: CSV field escaping is correct for all special characters**
    - **Validates: Requirements 6.4**
    - Generate field values containing commas, double-quotes, newlines, and combinations; assert `CSVExporter.escapeField()` wraps and escapes correctly

  - [ ]* 9.8 Write property test for export filename matches period (Property 19)
    - **Property 19: Export filename matches period**
    - **Validates: Requirements 6.2**
    - Generate `(year, month)` pairs; assert `CSVExporter.filename()` returns the correctly zero-padded string `'expenses-YYYY-MM.csv'`

- [ ] 10. Implement NotificationManager and Router
  - [ ] 10.1 Implement NotificationManager (show)
    - Implement `NotificationManager.show(message, type)` where `type` is `'success'|'error'|'info'`
    - Create a toast `<div>` with the appropriate type class, append it to `#toast-container`, and auto-remove it after 4 seconds
    - _Requirements: 5.3, 5.6_

  - [ ] 10.2 Implement Router (init / navigate)
    - Implement `Router.init()` attaching click handlers to all nav links
    - Implement `Router.navigate(viewName)` that shows the target `<section>` and hides the others, updates the active nav link class, and updates `AppState.activeView`
    - Wire the hamburger toggle button (`#nav-toggle`) to expand/collapse the nav at viewport < 768 px
    - _Requirements: 8.3, 8.4_

- [ ] 11. Implement FormController
  - [ ] 11.1 Implement FormController (bind / populate / reset / showFieldError / clearFieldErrors)
    - Implement `FormController.showFieldError(fieldId, message)` setting the text of the `[data-error]` container adjacent to the field
    - Implement `FormController.clearFieldErrors()` clearing all `[data-error]` containers
    - Implement `FormController.bindExpenseForm(onSubmit)` reading DOM values and calling `onSubmit` with a raw expense object
    - Implement `FormController.populateExpenseForm(expense)` setting each form field to the corresponding expense field value (for edit mode); set the hidden `data-editing-id` input
    - Implement `FormController.resetExpenseForm()` clearing all fields and the hidden `data-editing-id` input to their default empty state
    - Implement `FormController.bindBudgetForm(onSubmit)` reading budget form DOM values and calling `onSubmit`
    - Implement `FormController.resetBudgetForm()` clearing all budget form fields
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 2.2, 2.3, 3.3_

  - [ ]* 11.2 Write property test for edit form round-trip (Property 5)
    - **Property 5: Edit form round-trip preserves all field values**
    - **Validates: Requirements 2.2**
    - Generate valid expense objects with arbitrary field values; call `FormController.populateExpenseForm(expense)`; assert each DOM field value is strictly equal to the corresponding expense field

- [ ] 12. Implement ChartRenderer (drawBar / drawPie)
  - [ ] 12.1 Implement ChartRenderer (drawBar / drawPie)
    - Implement `ChartRenderer.drawBar(canvas, data)` where `data` is `[{ label, value, color }]`; clear canvas, draw bar chart with labeled bars and spending amounts using Canvas 2D API
    - Implement `ChartRenderer.drawPie(canvas, data)` where `data` is `[{ label, value, color }]`; clear canvas, draw pie/donut segments with labels showing category name and percentage
    - Both functions must handle an empty `data` array by clearing the canvas without throwing
    - No external charting library; use only Canvas 2D API
    - _Requirements: 4.5, 4.6_

- [ ] 13. Implement DashboardView
  - [ ] 13.1 Implement DashboardView (render)
    - Implement `DashboardView.render(state)` that calls `SummaryCalculator.periodSummary()` for `state.selectedPeriod`
    - Render the three summary cards: total spending, total budgeted, and remaining balance (show exceeded-budget indicator when remaining < 0)
    - Render per-category progress bars using `SummaryCalculator.progressPercent()` and `BudgetService.getStatus()`; visually distinguish over-budget categories
    - Call `ChartRenderer.drawBar()` and `ChartRenderer.drawPie()` with the calculated category data
    - Render the empty-state message and zero summaries when no expenses exist for the selected period
    - Render `totalBudgeted = 0` and `remaining = 0` when no budgets exist for the selected period
    - Add a period selector control bound to `AppState.selectedPeriod`; on change call `DashboardView.render(state)` within 2 seconds
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [ ] 14. Implement ExpenseListView
  - [ ] 14.1 Implement ExpenseListView (render)
    - Implement `ExpenseListView.render(state)` that applies `FilterEngine.sort()` (date descending) then `FilterEngine.apply()` with `state.activeFilters`, and renders up to 500 expenses
    - Render each expense row with amount, category, date, description, an Edit button, and a Delete button
    - On Edit: call `FormController.populateExpenseForm(expense)` and scroll/focus the form
    - On Delete: show a confirmation prompt identifying the expense; on confirm call `ExpenseService.remove()`, `StorageManager.save()`, and re-render
    - Render filter controls (category select, date-range inputs, period input) bound to `state.activeFilters`; on filter change call `FilterEngine.apply()` and re-render within 1 second
    - Add a "Clear Filters" button that resets `state.activeFilters` and re-renders the full list within 1 second
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 2.8_

- [ ] 15. Implement BudgetView
  - [ ] 15.1 Implement BudgetView (render)
    - Implement `BudgetView.render(state)` that renders all saved budgets in a list with their category, period, limit, current spending, and Edit/Delete buttons
    - Render the budget entry form with category select (populated from `state.categories`) and period/limit fields
    - On Edit: populate the budget form with the existing budget values and set a hidden editing-id
    - On Delete: call `BudgetService.remove()`, `StorageManager.save()`, and re-render the budget list and Dashboard
    - _Requirements: 3.1, 3.2, 3.7, 3.8_

- [ ] 16. Implement CategoryManagementView (within Budget view or as a subsection)
  - [ ] 16.1 Implement category management UI
    - Add a category management subsection in the Budget view (or as a separate card) with a list of current categories, an "Add Category" input and button, and a Delete button per category
    - On Add: call `CategoryService.validate()` and `CategoryService.add()`; on error show inline validation message; on success re-render the category list and refresh all category selects
    - On Delete with associations: show a warning listing `associationCounts.expenses` and `associationCounts.budgets`; require explicit confirmation before proceeding
    - On Delete without associations: delete immediately without confirmation
    - After confirmed deletion: call `CategoryService.remove()`, `StorageManager.save()`, re-render views
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 17. Wire up all components and implement app initialisation
  - [ ] 17.1 Implement app bootstrap (init function)
    - Write an `init()` function at the bottom of the IIFE that is called immediately
    - Call `StorageManager.isAvailable()`; if unavailable, show a persistent error banner and halt
    - Call `StorageManager.load()`; on failure show error notification and start with empty state (do not modify existing storage)
    - Seed default categories if `state.categories` is empty
    - Set `state.selectedPeriod` to the current calendar month (`'YYYY-MM'`)
    - Call `Router.init()` and `Router.navigate('dashboard')`
    - Bind expense form via `FormController.bindExpenseForm(onExpenseSubmit)`:
      - On submit: validate via `ExpenseService.validate()`; show field errors or call `ExpenseService.add/update()`, `StorageManager.save()`, re-render `ExpenseListView` and `DashboardView`, `FormController.reset()`
    - Bind budget form via `FormController.bindBudgetForm(onBudgetSubmit)`:
      - On submit: validate via `BudgetService.validate()`; show field errors or call `BudgetService.add/update()`, `StorageManager.save()`, re-render `BudgetView` and `DashboardView`
    - Bind the export button: call `CSVExporter.generate()`; if empty show notification; else call `CSVExporter.triggerDownload()`
    - Render initial views: `DashboardView.render(state)`, `ExpenseListView.render(state)`, `BudgetView.render(state)`
    - _Requirements: 1.2, 1.6, 2.4, 3.2, 4.1, 5.2, 5.3, 5.6, 6.2, 6.3, 6.6_

- [ ] 18. Checkpoint — Ensure all integration flows work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Final polish and accessibility
  - [ ] 19.1 Accessibility and visual polish pass
    - Verify all form fields have associated `<label>` elements
    - Verify all icon-only buttons have `aria-label` attributes
    - Verify all `<canvas>` elements have `role="img"` and `aria-label` describing the chart
    - Verify the nav toggle button has `aria-expanded` toggled correctly on open/close
    - Verify focus order is logical (Tab key moves through form fields and buttons in DOM order)
    - Verify WCAG 2.1 AA colour contrast ratios for all text against their backgrounds (4.5:1 normal, 3:1 large/bold)
    - Verify layout renders without horizontal scroll at 360 px viewport width
    - _Requirements: 8.1, 8.2, 8.5_

  - [ ] 19.2 Populate category selects and sync across views
    - Ensure the category `<select>` in the expense form, budget form, and filter controls are all populated from `AppState.categories` on every render
    - After adding or deleting a category, refresh all three selects so they stay in sync
    - _Requirements: 7.1, 7.2_

- [ ] 20. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build
- Each task references specific requirements for traceability
- Checkpoints at tasks 8 and 18 ensure incremental validation before moving to the next phase
- The design document defines 22 correctness properties; each optional `*` property test task maps directly to one of those properties
- Unit tests target concrete behaviours (Router, NotificationManager, ChartRenderer edge cases, StorageManager availability) not covered by property tests
- All three files (`index.html`, `css/styles.css`, `js/app.js`) must remain the only output files — no build step, no additional JS files

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1"] },
    { "id": 2, "tasks": ["3.2", "3.4"] },
    { "id": 3, "tasks": ["3.3", "4.1", "9.5"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "5.1", "7.1", "9.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.4", "5.5", "6.1", "7.2", "7.3", "7.4", "7.5", "9.2", "9.3", "9.4", "9.6", "9.7", "9.8"] },
    { "id": 6, "tasks": ["6.2", "6.3", "6.4", "10.1", "10.2"] },
    { "id": 7, "tasks": ["11.1"] },
    { "id": 8, "tasks": ["11.2", "12.1"] },
    { "id": 9, "tasks": ["13.1"] },
    { "id": 10, "tasks": ["14.1", "15.1"] },
    { "id": 11, "tasks": ["16.1"] },
    { "id": 12, "tasks": ["17.1"] },
    { "id": 13, "tasks": ["19.1", "19.2"] }
  ]
}
```
