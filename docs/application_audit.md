# Application Audit Checklist

This document defines the default procedure for performing a non-security audit of this application.

Use this checklist when the user asks for an application audit, code quality review, product readiness review, architecture review, or maintainability review.

By default, this is **not a security audit**. Security issues may be mentioned only when they are obvious and directly visible during the review, but the main focus should be application quality, maintainability, UX, architecture, tests, performance, and production readiness.

---

## 1. General audit rules

When performing the audit:

* Do not modify code unless the user explicitly asks for changes.
* First analyze the project structure, package setup, main application flow, and integration points.
* Prefer concrete findings with file paths, examples, and reasoning.
* Separate confirmed problems from suggestions and opinions.
* Prioritize findings by impact and effort.
* Avoid large rewrites unless there is a clear reason.
* Identify quick wins that can improve the application with low risk.
* If a change would affect many files, architecture, permissions, database schema, or deployment configuration, ask for confirmation before implementing it.
* If the user asks directly to fix a small, localized issue, proceed without asking for additional confirmation.

---

## 2. Audit scope

The audit should cover the following areas:

1. Project structure and architecture
2. Code readability and maintainability
3. Component and module boundaries
4. Business logic placement
5. Supabase integration
6. Data fetching and state management
7. Error handling and empty states
8. UX and functional edge cases
9. Performance
10. Tests and quality gates
11. Configuration and environment variables
12. Build, linting, formatting, and developer experience
13. Production readiness
14. Documentation

---

## 3. Project structure and architecture

Check whether:

* The folder structure is clear and consistent.
* Files are grouped by feature, domain, or responsibility in a logical way.
* Components, services, hooks, utilities, and configuration are not mixed together without reason.
* There are no large files doing too many unrelated things.
* Naming is consistent and understandable.
* The application has clear entry points.
* Shared logic is extracted only when it is actually reused.
* There is no premature over-engineering.
* Important architectural decisions are visible from the structure or documentation.

Look for:

* God components
* God services
* Duplicated folders
* Unclear naming
* Hidden dependencies between modules
* Unused files
* Dead code
* Mixed frontend/backend responsibilities

---

## 4. Code readability and maintainability

Check whether:

* Functions and components have clear responsibilities.
* Complex logic is split into smaller, understandable parts.
* Naming explains intent.
* Conditional logic is readable.
* There are no unnecessary abstractions.
* There are no excessive comments explaining unclear code instead of improving the code itself.
* Types and interfaces are used consistently.
* Similar logic is not duplicated in many places.
* The code is easy to change without causing unexpected side effects.

Look for:

* Long functions
* Deeply nested conditions
* Repeated code blocks
* Magic values
* Unclear variable names
* Unused imports
* Inconsistent formatting
* Inconsistent error handling
* Inconsistent API response handling

---

## 5. Components and UI structure

Check whether:

* Components are small enough to understand.
* Presentational and logic-heavy components are separated where useful.
* Reusable components are actually reusable.
* Component props are clear and not overly broad.
* UI state is kept close to where it is used.
* Components do not fetch data unnecessarily if that responsibility belongs elsewhere.
* Forms, modals, tables, filters, and lists are implemented consistently.

Look for:

* Components with too many props
* Components mixing UI, API calls, validation, formatting, and business rules
* Duplicated UI patterns
* Inconsistent loading states
* Inconsistent validation messages
* Inconsistent button behavior
* Inconsistent naming of components and props

---

## 6. Business logic placement

Check whether:

* Business rules are not scattered randomly across UI components.
* Validation rules are centralized where appropriate.
* Important calculations are named and testable.
* Data transformation is separated from rendering when it becomes complex.
* Repeated domain rules are not duplicated across screens.
* The code makes it clear which rules come from product requirements.

Look for:

* Business logic hidden inside JSX/templates
* Repeated validation logic
* Data transformation duplicated in multiple components
* Hardcoded business rules
* Missing comments around non-obvious business decisions

---

## 7. Supabase integration

If the project uses Supabase, check whether:

* Supabase client initialization is centralized.
* Environment variables are named clearly and documented.
* Supabase calls are not duplicated unnecessarily across components.
* Data access logic is separated from rendering where appropriate.
* Loading, error, and empty states are handled for Supabase queries.
* Insert, update, delete, and select operations have clear error handling.
* Database table names and column names are not hardcoded in many unrelated places.
* Migrations, schema files, or database setup instructions are present if relevant.
* The frontend does not depend on unclear assumptions about database structure.
* Supabase types are generated or maintained if the stack supports it.
* Realtime subscriptions, if used, are cleaned up correctly.
* Authentication state, if used, is handled consistently.

Look for:

* Repeated `supabase.from(...)` calls with similar logic
* Missing error handling after Supabase operations
* Missing loading states
* Missing empty states
* Hardcoded table names spread across many files
* Missing database documentation
* Missing generated types
* Unclear client/server boundary
* Queries placed directly inside complex UI components
* Unsubscribed realtime listeners
* Environment variables used without documentation

Do not perform a deep security/RLS audit unless the user explicitly asks for it. However, if obvious Supabase configuration risks are visible, mention them separately as “security-related observations outside the main audit scope.”

---

## 8. Data fetching and state management

Check whether:

* Data fetching is predictable and easy to follow.
* Components do not trigger unnecessary repeated requests.
* Loading states are visible to the user.
* Failed requests are handled.
* Empty results are handled.
* State is not duplicated unnecessarily.
* Derived state is not stored when it can be calculated safely.
* Cache invalidation or refresh behavior is understandable.
* Forms do not lose user input unexpectedly.
* Data mutations update the UI correctly.

Look for:

* Fetching inside render flow
* Duplicate requests
* Missing dependency arrays
* Overly broad state objects
* State stored in too many places
* Stale data after mutation
* Missing optimistic or post-save update strategy
* No user feedback after save/delete/update

---

## 9. Error handling

Check whether:

* Errors are caught and shown in a useful way.
* Technical errors are not exposed directly to the user unless appropriate.
* The user knows what happened and what to do next.
* Errors are logged or surfaced in a way useful for debugging.
* Critical flows handle partial failures.
* Forms show validation errors clearly.
* API/Supabase failures do not leave the UI in a broken state.

Look for:

* Empty catch blocks
* `console.log` used as the only error handling
* Generic “Something went wrong” everywhere
* No retry option where it would help
* No fallback UI
* No distinction between validation error and system error
* UI stuck in loading state after an error

---

## 10. UX and functional edge cases

Check whether:

* Main user flows are understandable.
* Buttons, links, forms, and navigation behave consistently.
* The user receives feedback after actions.
* Loading, empty, success, and error states are implemented.
* Forms prevent invalid submissions.
* Long text, empty values, special characters, and large data sets are handled.
* The app behaves reasonably on smaller screens if relevant.
* The user can recover from mistakes.
* Destructive actions require enough user intent.

Look for:

* Missing confirmation for delete/destructive actions
* Disabled buttons without explanation
* Forms without validation
* No feedback after save
* Tables without empty state
* Filters without reset option
* Search without no-results state
* Pagination issues
* Broken layout with long names/text
* UI that assumes ideal data only

---

## 11. Performance

Check whether:

* The application avoids unnecessary re-renders.
* Expensive calculations are not repeated unnecessarily.
* Large lists are handled efficiently.
* Data fetching is not repeated without reason.
* Assets are reasonably optimized.
* The bundle is not obviously bloated.
* Components do not load heavy dependencies unnecessarily.
* Pagination, filtering, and sorting are implemented in a scalable way when needed.

Look for:

* Rendering large lists without pagination/virtualization
* Unnecessary state updates
* Unnecessary effects
* Heavy calculations inside render
* Repeated API calls
* Large dependencies used for small tasks
* Images/assets without optimization
* Filtering large datasets only on the client when server-side filtering would be more appropriate

---

## 12. Tests and quality gates

Check whether:

* The project has a clear testing strategy.
* Critical user flows are covered.
* Important business logic is testable.
* Edge cases are covered where risk is high.
* There are scripts for test, lint, type-check, and build.
* Tests are not overly coupled to implementation details.
* The project can be validated locally with clear commands.

Look for:

* No tests for critical flows
* No tests for business logic
* Missing test scripts
* Failing or outdated tests
* Tests that only check rendering but not behavior
* Missing edge case tests
* Missing validation tests
* Missing integration tests around Supabase-dependent flows

Recommended minimum checks:

* Install dependencies
* Run lint
* Run type-check if available
* Run tests if available
* Run build
* Report which commands passed, failed, or were not available

---

## 13. Configuration and environment

Check whether:

* Required environment variables are documented.
* `.env.example` exists if environment variables are needed.
* Local setup instructions are clear.
* Development, test, and production assumptions are separated.
* Configuration values are not duplicated across unrelated files.
* Feature flags or toggles are named clearly if present.
* The app fails clearly when required configuration is missing.

Look for:

* Missing `.env.example`
* Missing README setup section
* Environment variables used but not documented
* Hardcoded URLs
* Hardcoded IDs
* Different naming conventions for config values
* Config spread across too many places
* No validation of required environment variables

---

## 14. Build, linting, formatting, and developer experience

Check whether:

* The project has clear scripts for common tasks.
* The README explains how to run the app.
* Formatting is consistent.
* Linting rules are present and useful.
* Type checking is available if the stack supports it.
* The project can be started by a new developer without guessing.
* Dependencies are reasonable and not obviously unused.
* The package manager is clear and consistent.

Look for:

* Missing README
* Missing start/dev/build scripts
* Multiple lock files from different package managers
* Unused dependencies
* Outdated scripts
* No formatting setup
* No linting setup
* No clear local development flow

---

## 15. Production readiness

Check whether:

* The main user flows are stable enough for real usage.
* Failure states are handled.
* The app has basic observability or logging where appropriate.
* There is a clear deployment process.
* Configuration for production is documented.
* The app does not rely on local-only assumptions.
* Important limitations are documented.
* Known risks are visible before release.

Look for:

* Missing deployment instructions
* Missing production environment documentation
* Missing error boundaries or fallback UI
* No logging around important failures
* No release checklist
* No known limitations section
* No smoke test checklist

---

## 16. Documentation

Check whether:

* README explains what the app does.
* README explains how to install and run the app.
* README lists required environment variables.
* Important architectural decisions are documented.
* Supabase setup is documented if relevant.
* Testing and deployment instructions are documented.
* Known limitations are documented.

Look for:

* Empty or generic README
* Setup steps that do not work
* Missing screenshots or examples where they would help
* Missing database setup instructions
* Missing explanation of important flows
* Missing troubleshooting section

---

## 17. Recommended audit process

When asked to perform the audit, follow this process:

1. Read `AGENTS.md`.
2. Read this file.
3. Inspect the project structure.
4. Identify the stack, package manager, scripts, and main entry points.
5. Inspect configuration files.
6. Inspect Supabase-related files, if present.
7. Inspect main screens, components, services, hooks, utilities, and data access logic.
8. Check tests and available quality scripts.
9. Run safe read-only commands where possible, such as:

   * dependency inspection
   * lint
   * type-check
   * tests
   * build
10. Do not make code changes unless explicitly requested.
11. Prepare a structured report.

---

## 18. Output format

The audit report should use the following structure:

### Executive summary

Briefly describe the general condition of the application.

Include:

* Overall quality assessment
* Main strengths
* Main risks
* Whether the app looks ready for further development, demo, or production-like use

### Critical issues

Issues that can block usage, development, deployment, or core user flows.

For each issue include:

* Title
* Severity
* File/path
* What is wrong
* Why it matters
* Suggested fix

### Important issues

Issues that should be addressed soon but do not fully block work.

For each issue include:

* Title
* Severity
* File/path
* What is wrong
* Why it matters
* Suggested fix

### Medium and low priority suggestions

Improvements that would increase maintainability, UX, consistency, or developer experience.

For each suggestion include:

* Title
* Area
* File/path if relevant
* Recommendation

### Quick wins

List small improvements with high value and low risk.

For each quick win include:

* Change
* Expected benefit
* Estimated risk

### Supabase observations

If the project uses Supabase, include a separate section covering:

* Client initialization
* Query organization
* Error handling
* Types
* Migrations/schema documentation
* Environment variables
* Auth/realtime usage if present

Do not perform a full security/RLS audit unless explicitly requested.

### Tests and quality gates

Include:

* Existing scripts found
* Commands run
* Results
* Missing checks
* Suggested minimum test coverage

### Recommended next actions

Provide a prioritized action plan:

1. Must fix first
2. Should fix soon
3. Nice to have
4. Do not touch for now

### Files worth manual review

List files that deserve human attention because they are central, complex, risky, or unclear.

---

## 19. Prioritization rules

Use the following severity levels:

### Critical

Use when the issue:

* Breaks the main application flow
* Prevents build or deployment
* Causes data loss or incorrect core behavior
* Makes the app very hard to maintain
* Blocks further development

### High

Use when the issue:

* Creates significant UX problems
* Makes future changes risky
* Causes repeated bugs
* Affects important flows
* Should be fixed before serious usage

### Medium

Use when the issue:

* Reduces maintainability
* Creates inconsistency
* Adds unnecessary complexity
* May cause bugs later
* Should be improved when convenient

### Low

Use when the issue:

* Is mostly cosmetic
* Is a small cleanup
* Improves clarity but is not urgent
* Can wait

---

## 20. Change policy after audit

After producing the audit report:

* Do not start fixing everything automatically.
* Suggest a small first batch of changes.
* Prefer quick wins first.
* Ask for confirmation before:

  * large rewrites,
  * architectural changes,
  * database schema changes,
  * permission changes,
  * changes affecting many files,
  * dependency replacement,
  * deployment configuration changes.
* If the user explicitly asks to implement selected fixes, implement only those fixes.
* If the user asks to fix all quick wins, proceed with quick wins that are low-risk and localized.

---

## 21. Example audit prompt

The user may trigger the audit with:

```text
Use docs/application_audit.md and perform a non-security audit of this application.
Do not modify code.
Focus on architecture, maintainability, UX, tests, performance, configuration, and Supabase integration.
Return a prioritized report with quick wins and recommended next actions.
```

---

## 22. Important reminder

This audit is intended to improve product quality, maintainability, and development readiness.

It is not a replacement for:

* a dedicated security audit,
* a penetration test,
* a database permission/RLS review,
* legal/compliance review,
* production incident review.

If the user needs one of those, treat it as a separate task with a dedicated checklist.
