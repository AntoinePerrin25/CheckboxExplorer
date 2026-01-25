# Change Log

## 1.0.3

Unreleased / 1.0.3

- Added extensive tests and test coverage improvements (new test cases, integration tests)
- Enhanced file caching and targeted refresh behavior (per-file cache, debounce on file changes)
- Implemented performance improvements for large repositories (batch scanning, parallel reads)
- Added / improved Explorer features: sorting modes, refresh command and button, search enhancements
- Fixed diagnostics false-positives in test files and added exclusion rules for test paths
- Made `toggleCheckboxAtLine` return a Promise and ensured proper refresh after toggles

## 1.0.2

Optimized extension by caching files and added sorting to the Explorer
Added a file refreshing to check if a checkbox was just inserted onDidChangeTextDocument
Added the command and the button in the Explorer to refresh checkbox

## 1.0.1

- Modified VSCode dependency to ^1.90.0

## 1.0.0

- Release
- Fixed a bug where Checkbox Explorer tried to read every file as a text file but crashes when it hits a binary file, now it does not try to read them, along with temporary/.git folders/files

## 0.0.3

- Added support for Jupyter Notebooks
- Added option to display "Click to toggle" Codelens disposable visibility
- Updated decorations to show circled numbers for carousel values and keep ☑/☐ for binary cases
- Added user-configurable colors: `checkbox-display.checkedColor`, `checkbox-display.uncheckedColor`, and `checkbox-display.carouselColor`
- Value validation with diagnostics: warns when variable value doesn't match carousel values
- Auto-save on toggle: added `checkbox-display.autoSave` setting (default: false)
- Project management with Sidebar (Checkbox explorer) with case sensitivity option, and option to search a checkbox

## 0.0.2

- Added support for multiple languages

## 0.0.1

- Initial release