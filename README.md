# Checkbox Display

Checkbox Display is a VS Code extension that detects and renders interactive checkbox patterns in source files and notebooks.

## Features

- Interactive checkboxes for variables and config-like lines (binary and carousel values).
- Supports many languages and Jupyter Notebooks; comment style is detected automatically.
- Clickable CodeLens "Click to toggle" for toggling values, plus keyboard shortcut and command palette support.
- Decorations show ☐/☑ for binary values and circled numbers for carousel entries.
- Value validation diagnostics to warn when a variable's value doesn't match defined carousel options.
- Configurable colors and autosave on toggle.
- Project Sidebar (Checkbox explorer) with search and case-sensitivity option.

## How it works

Write a line with a trailing `[CB]:` specifier listing the two (or more) allowed values separated by `|`:

```python
myFlag = True # [CB]: True|False
mode = "staging" # [CB]: "dev"|"staging"|"prod"
```
```c
bool myFlag = True; # [CB]: True;|False;
char mode[] = "prod"; # [CB]: "dev";|"staging";|"prod";
```
![C sample](assets/screen_sample.png)
- For binary pairs the extension shows ☑/☐ and toggles between the two values.
- From 3 to 20 values it shows a circled index and cycles through the listed values.

Snippets are available (type `cb` or `checkbox`) to insert a pattern quickly.

## Commands & Shortcuts

- `Toggle Checkbox` — toggles the checkbox under the cursor (Command Palette).
- Default shortcut: `Cmd+Shift+C` (macOS) / `Ctrl+Shift+C` (Windows/Linux).

## Configuration

Settings (contributions in `package.json`):

- `checkbox-display.checkedColor`: color for checked decoration.
- `checkbox-display.uncheckedColor`: color for unchecked decoration.
- `checkbox-display.carouselColor`: color for carousel indicator.
- `checkbox-display.autoSave` (boolean, default: `false`): save file automatically after toggle.
- `checkbox-display.sidebarCaseSensitive` (boolean): case sensitivity in the Checkbox explorer.

## Development

1. Clone the repository and open it in VS Code.
2. Install dependencies:

```bash
npm install
```

3. Run in debug: press `F5` to open an Extension Development Host.
4. Run tests:

```bash
npm test
```

## Release notes

See [CHANGELOG.md](CHANGELOG.md) for details of changes in each release.