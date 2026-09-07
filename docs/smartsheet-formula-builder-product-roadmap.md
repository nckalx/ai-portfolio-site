# Smartsheet Formula Builder Product Roadmap

**Status:** Agreed product direction  
**Primary v1 platform:** Chrome extension  
**Development workflow:** inspect → propose → review → apply → validate → review diff → commit → push

## Product Vision

Build a Smartsheet Formula Builder that gives knowledgeable users a fast, deterministic way to generate formulas using their own Smartsheet column names, while also providing a paid **Formula Modification** capability for requests that go beyond the deterministic formula catalog.

The product should avoid user-facing references to AI. Users interact with **Formula Modification** and **Formula Modification Credits**. The underlying model/provider implementation remains an internal technical detail.

---

## Product Principles

1. **Deterministic first**
   - Known formula patterns should be generated locally and reliably without consuming paid model usage.
   - Preserve and expand the existing catalog of formula types.

2. **Formula Modification as the escape hatch**
   - Users can start from a known-good generated formula and request changes when the deterministic builder does not fully satisfy their need.
   - The existing formula, column names, configuration, and requested change should be provided as structured context.

3. **Validation before delivery**
   - Modified formulas should pass automated validation where possible.
   - Validation can include:
     - balanced parentheses
     - balanced brackets
     - balanced quotation marks
     - preservation of user-specified column names
     - valid `@row` usage
     - cross-sheet reference structure
     - known Smartsheet function names
     - obvious malformed-expression detection
   - Failed validation can trigger an automatic retry or escalation to a stronger model.

4. **Hide implementation complexity from users**
   - Do not expose model names, token counts, API terminology, or provider-specific credits.
   - The product sells formula-building capability, not access to a particular AI model.

5. **Cost-aware model routing**
   - Formula Modification requests should be routed to the lowest-cost model likely to solve the request correctly.
   - More difficult requests can automatically escalate when needed.
   - Pricing should be based on measured real-world usage plus a healthy safety margin rather than assuming current model pricing remains fixed.

---

# Commercial Structure

## Base Product

### Chrome Extension — tentative price: **$5 one-time**

Includes the deterministic Formula Builder.

Expected capabilities:

- all existing deterministic formula types
- customizable Smartsheet column names
- formula generation
- explanation of the formula
- validation of required inputs
- setup instructions
- cross-sheet reference guidance where applicable
- copy-to-clipboard
- category/search-based formula discovery
- responsive extension UI
- future deterministic formulas as the product evolves

The base product should remain genuinely useful without requiring a Formula Modification subscription.

---

## Formula Modification

### Tentative price: **$2.99/month**

Unlocks the **Formula Modification** feature.

The user can take a generated formula and request changes such as:

> Return blank when Status is Complete and ignore Cancelled rows.

The extension sends structured context to the backend, including:

- deterministic formula type
- current generated formula
- configured column names
- relevant setup/reference information
- user-requested modification

The backend performs:

1. license/subscription verification
2. Formula Modification Credit verification
3. model selection/routing
4. formula modification
5. formula validation
6. retry or escalation if required
7. return of the validated formula to the extension

The underlying provider/API credentials remain on the backend and are never exposed in the Chrome extension.

---

## Formula Modification Credits

Use the customer-facing term **Formula Modification Credits**.

Do not refer to:

- AI credits
- ChatGPT credits
- tokens
- OpenAI credits

### Monthly credits

The $2.99/month subscription should include a defined monthly Formula Modification Credit allowance.

The included allowance should be designed so normal usage costs materially less than the subscription price after accounting for:

- model/API usage
- payment-processing fees
- hosting/backend costs
- fraud/abuse allowance
- taxes or other operating costs where applicable

The exact credit allowance should be determined from measured usage during development/testing.

### Additional credits

Offer optional prepaid credit packs after the included monthly allowance is consumed.

Initial pricing concepts:

- **50 additional Formula Modification Credits — approximately $1.99**
- **150 additional Formula Modification Credits — approximately $4.99**

These are placeholders until actual request costs are measured.

### Credit rollover

Purchased Formula Modification Credits should roll over so users feel comfortable buying additional credits without fear of losing unused value.

Monthly subscription credits may also roll over, potentially subject to a reasonable accumulation cap. The exact rollover policy will be decided later.

---

# Technical Architecture

## Extension

The Chrome extension contains:

- Formula Builder UI
- deterministic formula catalog
- deterministic formula engine
- formula utilities
- local input validation
- copy functionality
- Formula Modification interface
- account/license state display

The deterministic functionality should continue to work locally without model/API calls.

## Backend

Formula Modification requires a backend service.

The backend will eventually handle:

- user authentication
- extension license verification
- subscription status
- Formula Modification Credit balances
- usage metering
- rate limiting
- abuse protection
- model routing
- provider API credentials
- formula validation
- retry/escalation logic
- billing integration
- purchase of additional credits

No provider API key should be shipped in extension source code.

---

# Shared Formula Engine

The existing Formula Builder logic should be refactored into reusable modules before significant product expansion.

Conceptually:

```text
formula-catalog
      +
formula-utils
      +
formula-engine
      |
      +-------------------+
      |                   |
Chrome Extension UI   Future Interfaces
```

Possible future interfaces could include:

- additional browsers
- Windows application
- macOS application
- ChatGPT app/plugin
- web-based account or support portal

The shared formula engine should remain independent of the UI wherever practical.

---

# Roadmap

## V1 — Chrome Extension / Deterministic Formula Builder

Goal: turn the existing Formula Builder into a polished Chrome extension.

Focus:

- extract the existing Formula Builder from the portfolio site's general JavaScript
- preserve all current deterministic functionality
- create a clean reusable formula engine/catalog
- add automated tests for deterministic formula generation
- improve formula discovery with search/categories
- build the Chrome extension interface
- add local formula validation
- package and validate the extension
- determine licensing/distribution approach
- keep Formula Modification out of the critical path for initial deterministic functionality

Tentative commercial model:

**$5 one-time purchase**

---

## V1.1 — Formula Modification

Goal: add the paid Formula Modification capability.

Focus:

- backend service
- user accounts/authentication
- subscription handling
- $2.99/month Formula Modification plan
- Formula Modification Credit ledger
- structured modification requests
- model routing
- automated formula validation
- retry/escalation behavior
- usage monitoring
- real-world cost measurement

Tentative commercial model:

**$2.99/month**

---

## V1.2 — Additional Formula Modification Credits

Goal: support users who exceed their monthly Formula Modification allowance.

Focus:

- prepaid credit packs
- rollover behavior
- credit-purchase UI
- usage transparency
- safeguards against runaway costs
- margin tuning based on measured request costs

Initial placeholder concepts:

- 50 additional credits — ~$1.99
- 150 additional credits — ~$4.99

Final quantities and pricing will be determined from production-like usage data.

---

# Later Expansion

Potential later features include:

- saved formulas
- formula history
- favorites
- additional deterministic formula types
- user-created formula templates
- reusable column-name profiles
- shared/team formula libraries
- deeper Smartsheet integration
- contextual awareness of Smartsheet sheets/columns
- additional browser support
- Windows desktop application
- macOS desktop application
- ChatGPT app/plugin
- richer formula diagnostics
- formula explanation mode
- import of Smartsheet column structures
- organizational/admin licensing

These are intentionally outside the V1 scope.

---

# Immediate Development Strategy

The next coding milestone should remain conservative and behavior-preserving.

## Phase 1 — Refactor Existing Formula Builder

Before redesigning the UI or packaging the Chrome extension:

1. inspect the existing Formula Builder implementation
2. separate formula catalog/configuration from general portfolio-site code
3. separate deterministic formula utilities/engine
4. remove avoidable catalog duplication where practical
5. add unit tests covering the existing formula types
6. confirm no formula behavior changed
7. review the diff
8. commit and push only after approval

This gives the Chrome extension a tested, reusable foundation.

---

# Working Agreement

All implementation work should preserve the established portfolio workflow:

**inspect → propose → review → apply → validate → review diff → commit → push**

No implementation changes should be made before the proposal/review checkpoint unless explicitly approved.
