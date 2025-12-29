# Change Log

## 1.0.0

- Release
- Fixed a bug where Checkbox Explorer tried to read every file as a text file but crashes when it hits a binary file, now do not try to read them, along with temporary/.git folders/files

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