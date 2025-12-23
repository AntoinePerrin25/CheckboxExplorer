import * as vscode from 'vscode';

const CHECKBOX_REGEX = /#\s*\[CB\]:\s*([^|]+)\|([^\n]+)/g;

let checkedDecorationType: vscode.TextEditorDecorationType;
let uncheckedDecorationType: vscode.TextEditorDecorationType;

export function extractVariableValue(lineText: string): string | null {
	const varMatch = lineText.match(/=\s*(.+?)\s*#\s*\[CB\]:/);
	if (varMatch) {
		return varMatch[1].trim();
	}
	return null;
}

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

export function activate(context: vscode.ExtensionContext) {
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

	const codeLensProvider = new CheckboxCodeLensProvider();
	const codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
		{ scheme: 'file' },
		codeLensProvider
	);

	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			updateDecorations(editor);
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		const editor = vscode.window.activeTextEditor;
		if (editor && event.document === editor.document) {
			updateDecorations(editor);
			codeLensProvider.refresh();
		}
	}, null, context.subscriptions);

	if (vscode.window.activeTextEditor) {
		updateDecorations(vscode.window.activeTextEditor);
	}
	const toggleAtLineCommand = vscode.commands.registerCommand('checkbox-display.toggleCheckboxAtLine', (line: number) => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		toggleCheckboxAtLine(editor, line);
	});

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

export function toggleCheckboxAtLine(editor: vscode.TextEditor, lineNumber: number) {
	const line = editor.document.lineAt(lineNumber);
	const lineText = line.text;

	const cbMatch = lineText.match(/#\s*\[CB\]:\s*([^|]+)\|([^\n]+)/);
	const varMatch = lineText.match(/(.*)=\s*(.+?)\s*(#\s*\[CB\]:\s*)([^|]+)\|([^\n]+)/);
	
	if (cbMatch && varMatch) {
		const beforeEquals = varMatch[1];
		const currentValue = varMatch[2].trim();
		const cbPrefix = varMatch[3];
		const val1 = varMatch[4].trim();
		const val2 = varMatch[5].trim();
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

	for (let i = 0; i < editor.document.lineCount; i++) {
		const lineText = editor.document.lineAt(i).text;
		const cbMatch = lineText.match(/#\s*\[CB\]:\s*([^|]+)\|([^\n]+)/);
		
		if (cbMatch) {
			const varValue = extractVariableValue(lineText);
			const val1 = cbMatch[1].trim();
			const cbIndex = lineText.indexOf('# [CB]:');
			
			if (cbIndex !== -1 && varValue) {
				const startPos = new vscode.Position(i, cbIndex);
				const endPos = new vscode.Position(i, cbIndex + cbMatch[0].length);
				const decoration = { range: new vscode.Range(startPos, endPos) };

				if (varValue === val1) {
					checkedDecorations.push(decoration);
				} else {
					uncheckedDecorations.push(decoration);
				}
			}
		}
	}

	editor.setDecorations(checkedDecorationType, checkedDecorations);
	editor.setDecorations(uncheckedDecorationType, uncheckedDecorations);
}

export function deactivate() {
	if (checkedDecorationType) {
		checkedDecorationType.dispose();
	}
	if (uncheckedDecorationType) {
		uncheckedDecorationType.dispose();
	}
}
