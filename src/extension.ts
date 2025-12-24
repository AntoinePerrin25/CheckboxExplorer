import * as vscode from 'vscode';

let checkedDecorationType: vscode.TextEditorDecorationType;
let uncheckedDecorationType: vscode.TextEditorDecorationType;

export function getCommentSyntax(languageId: string): string {
	const commentMap: { [key: string]: string } = {
		'python': '#',
		'ruby': '#',
		'perl': '#',
		'r': '#',
		'yaml': '#',
		'bash': '#',
		'shell': '#',
		'powershell': '#',
		'javascript': '//',
		'typescript': '//',
		'java': '//',
		'c': '//',
		'cpp': '//',
		'csharp': '//',
		'go': '//',
		'rust': '//',
		'swift': '//',
		'kotlin': '//',
		'php': '//',
		'dart': '//',
	};
	return commentMap[languageId] || '#';
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getCheckboxRegex(commentSyntax: string): RegExp {
	const escaped = escapeRegex(commentSyntax);
	return new RegExp(`${escaped}\\s*\\[CB\\]:\\s*([^|]+)\\|([^\\n]+)`, 'g');
}

export function extractVariableValue(lineText: string, commentSyntax: string = '#'): string | null {
	const escaped = escapeRegex(commentSyntax);
	const regex = new RegExp(`=\\s*(.+?)\\s*${escaped}\\s*\\[CB\\]:`);
	const varMatch = lineText.match(regex);
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
		const showCodeLens = vscode.workspace.getConfiguration('checkbox-display').get<boolean>('showCodeLens', true);
		
		if (!showCodeLens) {
			return [];
		}

		const codeLenses: vscode.CodeLens[] = [];
		const commentSyntax = getCommentSyntax(document.languageId);
		const checkboxRegex = getCheckboxRegex(commentSyntax);
		
		for (let i = 0; i < document.lineCount; i++) {
			const lineText = document.lineAt(i).text;
			checkboxRegex.lastIndex = 0;
			const cbMatch = checkboxRegex.exec(lineText);
			
			if (cbMatch) {
				const range = new vscode.Range(i, 0, i, 0);
				const varValue = extractVariableValue(lineText, commentSyntax);
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
		[
			{ scheme: 'file' },
			{ scheme: 'vscode-notebook-cell' }
		],
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

	const insertSnippetCommand = vscode.commands.registerCommand('checkbox-display.insertSnippet', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		const commentSyntax = getCommentSyntax(editor.document.languageId);
		const snippet = new vscode.SnippetString(`${commentSyntax} [CB]: ${'${1:value1}'}|${'${2:value2}'}`);
		editor.insertSnippet(snippet, editor.selection.start);
	});

	context.subscriptions.push(toggleCommand);
	context.subscriptions.push(insertSnippetCommand);
	context.subscriptions.push(toggleAtLineCommand);
	context.subscriptions.push(codeLensProviderDisposable);
	context.subscriptions.push(checkedDecorationType);
	context.subscriptions.push(uncheckedDecorationType);
}

export function toggleCheckboxAtLine(editor: vscode.TextEditor, lineNumber: number) {
	const line = editor.document.lineAt(lineNumber);
	const lineText = line.text;
	const commentSyntax = getCommentSyntax(editor.document.languageId);
	const escapedComment = escapeRegex(commentSyntax);

	const cbRegex = new RegExp(`${escapedComment}\\s*\\[CB\\]:\\s*([^|]+)\\|([^\\n]+)`);
	const varRegex = new RegExp(`(.*)=\\s*(.+?)\\s*(${escapedComment}\\s*\\[CB\\]:\\s*)([^|]+)\\|([^\\n]+)`);
	
	const cbMatch = lineText.match(cbRegex);
	const varMatch = lineText.match(varRegex);
	
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
	const commentSyntax = getCommentSyntax(editor.document.languageId);
	const checkboxRegex = getCheckboxRegex(commentSyntax);

	for (let i = 0; i < editor.document.lineCount; i++) {
		const lineText = editor.document.lineAt(i).text;
		checkboxRegex.lastIndex = 0;
		const cbMatch = checkboxRegex.exec(lineText);
		
		if (cbMatch) {
			const varValue = extractVariableValue(lineText, commentSyntax);
			const val1 = cbMatch[1].trim();
			const cbPattern = `${commentSyntax} [CB]:`;
			const cbIndex = lineText.indexOf(cbPattern);
			
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
