# AI Portfolio Site

This is Nick Alexander's AI project controls portfolio website.

The site showcases practical, business-facing automation projects focused on:

- Project controls automation
- Schedule movement analysis
- Smartsheet workflow support
- Project reporting
- Workflow standardization
- AI-assisted process improvement

## Live Site

- Live site: https://nickalexander.io
- GitHub Pages URL: https://nckalx.github.io/ai-portfolio-site/

The site is hosted with GitHub Pages and backed by this repository.

## Project Purpose

This portfolio is the central home for Nick's AI-enabled project controls work.

Rather than only linking to GitHub repositories, the site presents each project with business context, skills demonstrated, and lightweight interactive demos. The goal is to show how AI-assisted development can support real project controls workflows by turning manual, repetitive processes into clearer, repeatable tools.

## Current Tools And Features

- Single-page portfolio layout
- Project cards for completed portfolio projects
- Business problem / automation solution / skills shown framing
- Browser-based Smartsheet schedule movement analyzer for exported `.xlsx` schedules
- Downloadable Excel summary report generated in the browser
- Original hardcoded schedule movement sample demo
- Interactive Smartsheet Formula Builder
- GitHub Pages deployment
- Custom domain: `nickalexander.io`

## Featured Projects

### Project #1: Schedule Movement Analyzer

This project started as a Python/CSV tool that compares original and updated milestone dates, calculates schedule movement, and generates a variance report.

The portfolio site now also includes a browser-based Smartsheet `.xlsx` analyzer that supports mapped columns, schedule movement calculations, dependency validation, parent/summary row handling, grouped estimated dependency-based critical path analysis, and a downloadable Excel report.

Repository:

https://github.com/nckalx/schedule-movement-analyzer

### Project #2: Smartsheet Formula Helper

A Python tool that converts structured Smartsheet formula examples into a reusable Markdown reference guide grouped by formula type and business use case.

The portfolio site also includes an interactive Smartsheet Formula Builder with helper formulas for schedule reporting, milestone IDs, lookups, hierarchy helpers, and related workflows.

Repository:

https://github.com/nckalx/smartsheet-formula-helper

### Project #3: AI Portfolio Site

This website.

The portfolio site presents project controls automation work in a business-facing format with project summaries, GitHub links, and lightweight interactive demos.

Repository:

https://github.com/nckalx/ai-portfolio-site

## Browser Smartsheet Schedule Analyzer

The schedule analyzer works with exported Smartsheet `.xlsx` files. It is not a Smartsheet API integration.

The analyzer:

- Processes uploaded workbooks locally in the browser
- Uses user-entered column mappings instead of fixed column names
- Compares baseline start/finish dates to actual/current start/finish dates
- Calculates calendar-day and weekday-only movement
- Validates missing, invalid, or inconsistent mapped dates
- Parses and validates Smartsheet-style predecessor references
- Identifies likely parent/summary rows and excludes them from estimated critical path logic by default
- Supports Row Hierarchy / Outline Level mapping for parent/child Smartsheet schedules
- Supports Project Name / Project Grouping mapping when one export contains multiple projects, properties, or schedules
- Generates a downloadable Excel report using the SheetJS browser library

### Required Column Mappings

- Task or Milestone Name
- Baseline Start
- Baseline Finish
- Actual / Current Start
- Actual / Current Finish
- Predecessors

### Optional Column Mappings

- Task ID / Row ID
- Status / % Complete
- Row Hierarchy / Outline Level
- Project Name / Project Grouping

Row Hierarchy / Outline Level is recommended for Smartsheet schedules with parent/child rows. It helps the analyzer identify parent/summary rows so they do not drive estimated critical path logic. If a sheet does not already have a helper column, the site's Smartsheet Formula Builder includes a Hierarchy Level Helper formula option.

Project Name / Project Grouping is recommended when one workbook contains multiple projects, properties, or schedules. When mapped, estimated critical paths are calculated separately by project group.

## Generated Excel Report

The web output focuses on changed schedule rows so the browser view stays readable. The downloadable Excel report includes a fuller audit trail.

Report tabs:

- Executive Summary
- Changed Schedule Items
- All Schedule Items
- Warnings - Data Quality
- Dependency Validation
- Estimated Critical Path
- Column Mapping Used

## Privacy And Browser-Only Processing

Uploaded schedule exports are processed client-side in the browser. The analyzer does not call the Smartsheet API, does not require a server, and does not upload workbook contents from the page.

## Estimated Critical Path Limitations

The critical path output is an estimated dependency-based analysis intended for schedule movement review and reporting support.

It is not a full replacement for:

- Smartsheet project settings
- Primavera P6
- Microsoft Project
- A formal CPM scheduling engine

Current limitations:

- Holiday calendars are not yet applied
- Parent/summary rows are excluded only where hierarchy data or fallback heuristics identify them
- Dependency validation focuses on parsed predecessor references, not full scheduling-engine behavior
- The estimated path should be reviewed by a scheduler or project controls professional before being used for formal schedule decisions

## Screenshots And Sample Output

Planned screenshot/sample-output placeholders:

- Workbook upload and column mapping
- Executive Summary after analysis
- Changed Schedule Items web output
- Dependency / Predecessor Validation output
- Estimated Critical Path output
- Downloaded Excel report tab examples

No screenshot or sample workbook files are included in this pass.

## Technology

- HTML
- CSS
- JavaScript
- SheetJS browser library for `.xlsx` parsing and report generation
- GitHub Pages
- Custom domain through Namecheap

The goal is to keep the site easy to understand, easy to maintain, and easy to deploy.

## Future Roadmap

Planned improvements include:

- Add sample downloadable files
- Add optional Row Type / Include in Critical Path mapping
- Add holiday calendar support
- Add an All Dependency Links Excel report tab
- Refactor schedule analyzer JavaScript into smaller modules
- Add automated tests
- Add dedicated project detail pages
- Continue refining the portfolio as the broader AI project portfolio grows
