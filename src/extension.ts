// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// Regex to match checkbox patterns like: variable = value # [CB]: value1|value2
// Accepts any values, not just 0|1
const CHECKBOX_REGEX = /#\s*\[CB\]:\s*([^|]+)\|([^\n]+)/g;

// Decoration types for checked and unchecked checkboxes
let checkedDecorationType: vscode.TextEditorDecorationType;
let uncheckedDecorationType: vscode.TextEditorDecorationType;

// Helper function to extract variable value from line
function extractVariableValue(lineText: string): string | null {
	// Match patterns like: variable = value # [CB]:...
	// Captures anything between = and # [CB]:
	const varMatch = lineText.match(/=\s*(.+?)\s*#\s*\[CB\]:/);
	if (varMatch) {
		return varMatch[1].trim();
	}
	return null;
}

// CodeLens Provider for clickable checkboxes
class CheckboxCodeLensProvider implements vscode.CodeLensProvider {
	private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

	public refresh(): void {
		this._onDidChangeCodeLenses.fire();
	}

	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
		const codeLenses: vscode.CodeLens[] = [];
		
		for (let i = 0; i < document.lineCount; i++) {
			const lineText = document.lineAt(i).text;
			const cbMatch = lineText.match(/#\s*\[CB\]:\s*([^|]+)\|([^\n]+)/);
			
			if (cbMatch) {
				const range = new vscode.Range(i, 0, i, 0);
				const varValue = extractVariableValue(lineText);
				const val1 = cbMatch[1].trim();
				const val2 = cbMatch[2].trim();
				
				// Determine checkbox state based on variable value matching first value
				const isChecked = varValue === val1;
				const icon = isChecked ? '☑' : '☐';
				const title = `${icon} Click to toggle`;
				
				codeLenses.push(new vscode.CodeLens(range, {
					title: title,
					command: 'checkbox-display.toggleCheckboxAtLine',
					arguments: [i]
				}));
			}
		}

		return codeLenses;
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('Checkbox Display extension is now active!');

	// Create decoration types
	checkedDecorationType = vscode.window.createTextEditorDecorationType({
		before: {
			contentText: '☑ ',
			color: '#4CAF50',
			fontWeight: 'bold',
			textDecoration: 'none; cursor: pointer;'
		},
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
	});

	uncheckedDecorationType = vscode.window.createTextEditorDecorationType({
		before: {
			contentText: '☐ ',
			color: '#757575',
			fontWeight: 'bold',
			textDecoration: 'none; cursor: pointer;'
		},
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
	});

	// Register CodeLens Provider
	const codeLensProvider = new CheckboxCodeLensProvider();
	const codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
		{ scheme: 'file' },
		codeLensProvider
	);

	// Update decorations on active editor change
	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			updateDecorations(editor);
		}
	}, null, context.subscriptions);

	// Update decorations on text document change
	vscode.workspace.onDidChangeTextDocument(event => {
		const editor = vscode.window.activeTextEditor;
		if (editor && event.document === editor.document) {
			updateDecorations(editor);
			codeLensProvider.refresh();
		}
	}, null, context.subscriptions);

	// Update decorations on the initial active editor
	if (vscode.window.activeTextEditor) {
		updateDecorations(vscode.window.activeTextEditor);
	}

	// Command to toggle checkbox at specific line
	const toggleAtLineCommand = vscode.commands.registerCommand('checkbox-display.toggleCheckboxAtLine', (line: number) => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		toggleCheckboxAtLine(editor, line);
	});

	// Command to toggle checkbox state at cursor position
	const toggleCommand = vscode.commands.registerCommand('checkbox-display.toggleCheckbox', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const position = editor.selection.active;
		toggleCheckboxAtLine(editor, position.line);
	});

	context.subscriptions.push(toggleCommand);
	context.subscriptions.push(toggleAtLineCommand);
	context.subscriptions.push(codeLensProviderDisposable);
	context.subscriptions.push(checkedDecorationType);
	context.subscriptions.push(uncheckedDecorationType);
}

function toggleCheckboxAtLine(editor: vscode.TextEditor, lineNumber: number) {
	const line = editor.document.lineAt(lineNumber);
	const lineText = line.text;

	// Find checkbox and variable value on the line
	const cbMatch = lineText.match(/#\s*\[CB\]:\s*([^|]+)\|([^\n]+)/);
	const varMatch = lineText.match(/(.*)=\s*(.+?)\s*(#\s*\[CB\]:\s*)([^|]+)\|([^\n]+)/);
	
	if (cbMatch && varMatch) {
		const beforeEquals = varMatch[1]; // Everything before =
		const currentValue = varMatch[2].trim(); // Current variable value
		const cbPrefix = varMatch[3]; // The " # [CB]: " part
		const val1 = varMatch[4].trim(); // First value in checkbox (checked state)
		const val2 = varMatch[5].trim(); // Second value in checkbox (unchecked state)
		
		// Toggle: swap variable value between val1 and val2
		// Do NOT swap the values in the comment - they stay fixed
		const newValue = currentValue === val1 ? val2 : val1;
		const newText = `${beforeEquals}= ${newValue} ${cbPrefix}${val1}|${val2}`;

		editor.edit(editBuilder => {
			editBuilder.replace(line.range, newText);
		});
	}
}

function updateDecorations(editor: vscode.TextEditor) {
	const checkedDecorations: vscode.DecorationOptions[] = [];
	const uncheckedDecorations: vscode.DecorationOptions[] = [];

	// Process each line in the document
	for (let i = 0; i < editor.document.lineCount; i++) {
		const lineText = editor.document.lineAt(i).text;
		const cbMatch = lineText.match(/#\s*\[CB\]:\s*([^|]+)\|([^\n]+)/);
		
		if (cbMatch) {
			const varValue = extractVariableValue(lineText);
			const val1 = cbMatch[1].trim();
			const val2 = cbMatch[2].trim();
			const cbIndex = lineText.indexOf('# [CB]:');
			
			console.log(`Line ${i}: varValue="${varValue}", val1="${val1}", val2="${val2}"`);
			
			if (cbIndex !== -1 && varValue) {
				const startPos = new vscode.Position(i, cbIndex);
				const endPos = new vscode.Position(i, cbIndex + cbMatch[0].length);
				const decoration = { range: new vscode.Range(startPos, endPos) };

				// Checkbox is checked if variable value matches first value
				if (varValue === val1) {
					console.log(`  -> CHECKED (varValue === val1)`);
					checkedDecorations.push(decoration);
				} else {
					console.log(`  -> UNCHECKED (varValue !== val1)`);
					uncheckedDecorations.push(decoration);
				}
			}
		}
	}

	editor.setDecorations(checkedDecorationType, checkedDecorations);
	editor.setDecorations(uncheckedDecorationType, uncheckedDecorations);
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (checkedDecorationType) {
		checkedDecorationType.dispose();
	}
	if (uncheckedDecorationType) {
		uncheckedDecorationType.dispose();
	}
}
