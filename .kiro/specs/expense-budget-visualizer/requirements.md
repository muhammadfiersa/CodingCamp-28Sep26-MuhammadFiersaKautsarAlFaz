# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that enables users to record expenses, set budgets per category, and visualize spending patterns through interactive charts and summaries. All data is stored in the browser's Local Storage — no backend server, account, or internet connection is required after the initial page load. The application is built with plain HTML, CSS, and Vanilla JavaScript.

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Expense**: A single spending record consisting of an amount, category, date, and optional description.
- **Category**: A user-defined or predefined label used to group expenses (e.g., Food, Transport, Entertainment).
- **Budget**: A monetary limit set by the user for a specific Category within a given period (monthly by default).
- **Dashboard**: The main view that displays summary cards, budget progress, and charts.
- **Chart**: A visual representation (bar chart or pie chart) of expense data rendered on an HTML `<canvas>` element using Vanilla JavaScript.
- **Storage**: The browser Local Storage API used to persist all application data client-side.
- **Period**: A calendar month used as the default unit for budget tracking and expense filtering.
- **Export**: The action of converting stored data into a downloadable file.
- **Filter**: A control that narrows the displayed expenses by Category, date range, or Period.

---

## Requirements

### Requirement 1: Expense Entry

**User Story:** As a user, I want to add expense records with relevant details, so that I can track where my money goes.

#### Acceptance Criteria

1. THE App SHALL provide a form with fields for amount (numeric, 0.01 to 999999999.99), category (select or free-text, maximum 100 characters), date (calendar date, not in the future), and an optional description (maximum 500 characters).
2. WHEN the user submits the expense form with all required fields filled, THE App SHALL save the Expense to Storage and display it in the expense list within 1 second without a page reload.
3. IF the user submits the expense form with a missing required field (amount, category, or date), THEN THE App SHALL display an inline validation message identifying each missing field and SHALL NOT save the Expense.
4. IF the user enters a non-numeric value or a value outside the range 0.01 to 999999999.99 in the amount field, THEN THE App SHALL display an inline validation message adjacent to the amount field and SHALL NOT save the Expense.
5. IF the user enters a date in the future in the date field, THEN THE App SHALL display an inline validation message adjacent to the date field and SHALL NOT save the Expense.
6. WHEN an Expense is saved successfully, THE App SHALL reset all form fields to their default empty state within 1 second of the save completing.

---

### Requirement 2: Expense List and Management

**User Story:** As a user, I want to view, edit, and delete my recorded expenses, so that I can correct mistakes and keep my data accurate.

#### Acceptance Criteria

1. THE App SHALL display a list of all saved Expenses, ordered by date descending by default, showing at most 500 Expenses at a time.
2. WHEN the user selects an Expense for editing, THE App SHALL populate the expense form with that Expense's existing field values and allow the user to modify and save changes to Storage.
3. IF the user attempts to save an edited Expense with one or more invalid or missing required fields, THEN THE App SHALL display an error message indicating which fields are invalid and retain all entered values without saving.
4. WHEN the user confirms deletion of an Expense, THE App SHALL remove the Expense from Storage and from the displayed list within 1 second.
5. IF the user attempts to delete an Expense, THEN THE App SHALL display a confirmation prompt identifying the Expense before performing the deletion.
6. WHILE a Filter is active, THE App SHALL display only the Expenses that match all active Filter criteria.
7. THE App SHALL allow the user to filter Expenses by Category, by a date range with a start date and an end date inclusive of both boundary dates, or by Period defined as a single calendar month.
8. WHEN the user clears all active Filters, THE App SHALL restore the full list of saved Expenses ordered by date descending within 1 second.

---

### Requirement 3: Budget Management

**User Story:** As a user, I want to set a monthly spending budget per category, so that I can control my expenses and avoid overspending.

#### Acceptance Criteria

1. THE App SHALL allow the user to create a Budget by specifying a Category and a monetary limit for a Period, where the monetary limit must be between 0.01 and 999,999,999.99.
2. WHEN the user saves a Budget, THE App SHALL store it in Storage and reflect the new limit immediately on the Dashboard.
3. IF the user attempts to save a Budget with a non-numeric or non-positive limit value, THEN THE App SHALL display a validation message indicating the limit must be a positive number and SHALL NOT save the Budget.
4. IF the user attempts to save a Budget for a Category that already has an active Budget for the same Period, THEN THE App SHALL display a validation message indicating a duplicate Budget exists and SHALL NOT save the new Budget.
5. WHILE total spending for a Category in the current Period is below the Budget limit, THE App SHALL display the budget progress indicator in a neutral or positive visual state showing the amount spent and the amount remaining.
6. WHEN total spending for a Category in the current Period reaches or exceeds the Budget limit, THE App SHALL display the budget progress indicator in a warning visual state and show the overspent amount.
7. WHEN the user edits a Budget limit, THE App SHALL validate the new limit using the same rules as creation, update the stored Budget in Storage, and reflect the updated limit on the Dashboard immediately.
8. WHEN the user deletes a Budget, THE App SHALL remove it from Storage and remove its progress indicator from the Dashboard immediately.

---

### Requirement 4: Dashboard and Summary

**User Story:** As a user, I want a dashboard that summarizes my financial status at a glance, so that I can make informed spending decisions quickly.

#### Acceptance Criteria

1. THE App SHALL display a Dashboard as the default view when the application loads.
2. THE Dashboard SHALL show total spending for the current Period, total budgeted amount for the current Period, and remaining balance calculated as total budgeted amount minus total spending; where remaining balance is negative, THE Dashboard SHALL display it as an exceeded-budget indicator.
3. THE Dashboard SHALL show per-Category spending versus Budget for the current Period as a progress bar or equivalent visual component, where each bar reflects the ratio of Category spending to Category Budget capped at 100%, and Categories with spending exceeding their Budget SHALL be visually distinguished from those within Budget.
4. WHEN the user changes the selected Period on the Dashboard, THE App SHALL recalculate and re-render all summary values and Charts using data for the selected Period within 2 seconds of the selection change.
5. THE App SHALL render a bar Chart showing total spending per Category for the selected Period, with each bar labeled with the Category name and its total spending amount.
6. THE App SHALL render a pie Chart showing the proportional distribution of spending across Categories for the selected Period, with each segment labeled with the Category name and its percentage of total spending rounded to one decimal place.
7. IF no Expenses exist for the selected Period, THEN THE App SHALL display an empty-state message on the Dashboard instead of blank Charts, and all summary values SHALL be displayed as zero.
8. IF the selected Period has no configured Budget, THEN THE App SHALL display the total budgeted amount as zero and the remaining balance as zero on the Dashboard.

---

### Requirement 5: Data Persistence via Local Storage

**User Story:** As a user, I want my data to be saved automatically in my browser, so that my records are still available after I close and reopen the application.

#### Acceptance Criteria

1. WHEN a create, update, or delete operation completes successfully on any Expense or Budget record, THE App SHALL write the complete current set of Expense and Budget data to Storage before the next user interaction is processed.
2. WHEN the App loads, THE App SHALL read all Expense and Budget data from Storage and restore the application state before rendering the Dashboard.
3. IF Storage is unavailable or read fails on load, THEN THE App SHALL display an error notification indicating that saved data could not be loaded and operate with an empty Expense list and empty Budget list for the current session without modifying any existing Storage contents.
4. THE App SHALL serialize Expense and Budget data as a single JSON string when writing to Storage and deserialize that JSON string back into Expense and Budget objects when reading from Storage.
5. FOR ALL valid Expense and Budget objects, serializing then deserializing SHALL produce an object where every field value is strictly equal to the corresponding field value in the original object.
6. IF a write to Storage fails after a successful create, update, or delete operation, THEN THE App SHALL display an error notification indicating that the change could not be saved and preserve the in-memory application state reflecting the completed operation.

---

### Requirement 6: Data Export

**User Story:** As a user, I want to export my expense data to a file, so that I can archive records or analyze them in a spreadsheet.

#### Acceptance Criteria

1. THE App SHALL provide an export action that generates a CSV file containing all Expenses belonging to the currently selected Period.
2. WHEN the user triggers the export action, THE App SHALL produce a downloadable file named `expenses-<YYYY-MM>.csv` where `<YYYY-MM>` reflects the currently selected Period.
3. WHEN the user triggers the export action, THE App SHALL initiate a browser file download without a page reload.
4. THE CSV file SHALL include a header row with columns `date`, `category`, `amount`, and `description`, followed by one data row per Expense, where any field value containing a comma, double-quote, or newline is enclosed in double-quotes with internal double-quotes escaped as two consecutive double-quotes.
5. IF an Expense has no description, THEN THE App SHALL output an empty string for that field in the CSV row.
6. IF no Expenses exist for the selected Period, THEN THE App SHALL display a message indicating that there is no data to export for the selected Period and SHALL NOT initiate a download.

---

### Requirement 7: Category Management

**User Story:** As a user, I want to manage the list of expense categories, so that I can tailor the application to my personal spending habits.

#### Acceptance Criteria

1. THE App SHALL provide a set of default Categories (Food, Transport, Housing, Entertainment, Health, Other) on first load when no data exists in Storage.
2. THE App SHALL allow the user to add a new custom Category by entering a unique name of 1 to 50 characters.
3. IF the user attempts to add a Category with a name that already exists (case-insensitive), THEN THE App SHALL display a validation message indicating the name is already in use and SHALL NOT create a duplicate Category.
4. IF the user attempts to add a Category with a name that is empty or exceeds 50 characters, THEN THE App SHALL display a validation message indicating the naming constraint and SHALL NOT create the Category.
5. WHEN the user initiates deletion of a Category that has one or more associated Expenses or Budgets, THE App SHALL display a warning message listing the count of associated Expenses and Budgets and SHALL require the user to explicitly confirm the deletion before proceeding.
6. WHEN the user initiates deletion of a Category that has no associated Expenses or Budgets, THE App SHALL delete the Category immediately without a confirmation prompt.
7. WHEN a Category is deleted and the user confirms, THE App SHALL remove the Category from Storage and reassign all associated Expenses to the reserved "Uncategorized" Category.

---

### Requirement 8: Responsive Layout and Visual Design

**User Story:** As a user, I want the application to be usable on different screen sizes, so that I can access it on both desktop and mobile browsers.

#### Acceptance Criteria

1. THE App SHALL use a responsive CSS layout that adapts to viewport widths from 360px to 1920px without horizontal scrolling.
2. THE App SHALL apply a clear visual hierarchy with distinct heading levels (H1 through H3 minimum), readable body text at a minimum of 14px, and sufficient color contrast meeting WCAG 2.1 AA contrast ratio (4.5:1 for normal text, 3:1 for large text above 18px or bold text above 14px).
3. THE App SHALL display a navigation element (top bar or side bar) containing links to the Dashboard view, the Expense List view, and the Budget Management view, where the currently active view is visually distinguished from the other navigation links.
4. WHEN the viewport width is below 768px, THE App SHALL collapse the navigation into a hidden menu, and THE App SHALL display a toggle control that, when activated, expands the navigation menu to show all view links.
5. THE App SHALL provide a visible focus ring on all interactive controls when they receive keyboard focus, and THE App SHALL provide a visible hover state on all interactive controls when the pointer hovers over them.
6. IF the viewport width is between 768px and 1024px, THEN THE App SHALL adapt the layout to a single-column arrangement for content areas while keeping the navigation element visible without requiring a toggle control.
