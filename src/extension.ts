import * as vscode from 'vscode';

let checkedDecorationType: vscode.TextEditorDecorationType;
let uncheckedDecorationType: vscode.TextEditorDecorationType;

// Circled number characters for carousel display (①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳)
const circledNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
const decorationMap: Map<number, vscode.TextEditorDecorationType> = new Map();

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
	return new RegExp(`${escaped}\\s*\\[CB\\]:\\s*([^|]+(?:\\|[^|\\n]+)*)`, 'g');
}

export function extractCheckboxValues(match: RegExpExecArray): string[] {
	const valuesString = match[1];
	return valuesString.split('|').map(v => v.trim());
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

export function validateCheckboxValue(lineText: string, commentSyntax: string = '#'): { isValid: boolean; errorMessage?: string } {
	const varValue = extractVariableValue(lineText, commentSyntax);
	if (!varValue) {
		return { isValid: true }; // No variable, no validation needed
	}

	const checkboxRegex = getCheckboxRegex(commentSyntax);
	checkboxRegex.lastIndex = 0;
	const cbMatch = checkboxRegex.exec(lineText);
	
	if (!cbMatch) {
		return { isValid: true }; // No checkbox pattern, no validation needed
	}

	const values = extractCheckboxValues(cbMatch);
	const isValid = values.includes(varValue);

	if (!isValid) {
		return {
			isValid: false,
			errorMessage: `Variable value "${varValue}" does not match any carousel value (${values.join(', ')})`
		};
	}

	return { isValid: true };
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
				const values = extractCheckboxValues(cbMatch);
				const isChecked = varValue === values[0];
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
	// Get colors from configuration
	const config = vscode.workspace.getConfiguration('checkbox-display');
	const checkedColor = config.get<string>('checkedColor', '#4CAF50');
	const uncheckedColor = config.get<string>('uncheckedColor', '#757575');
	const carouselColor = config.get<string>('carouselColor', '#FF9800');

	// Create diagnostics collection for value validation
	const diagnosticsCollection = vscode.languages.createDiagnosticCollection('checkbox-display');
	context.subscriptions.push(diagnosticsCollection);

	checkedDecorationType = vscode.window.createTextEditorDecorationType({
		before: {
			contentText: '☑ ',
			color: checkedColor,
			fontWeight: 'bold',
			textDecoration: 'none;'
		},
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
	});

	uncheckedDecorationType = vscode.window.createTextEditorDecorationType({
		before: {
			contentText: '☐ ',
			color: uncheckedColor,
			fontWeight: 'bold',
			textDecoration: 'none;'
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

	// Create decoration types for circled numbers (1-20)
	for (let i = 0; i < circledNumbers.length; i++) {
		const decorType = vscode.window.createTextEditorDecorationType({
			before: {
				contentText: circledNumbers[i] + ' ',
				color: carouselColor,
				fontWeight: 'bold'
			},
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
		});
		decorationMap.set(i, decorType);
		context.subscriptions.push(decorType);
	}

	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			updateDecorations(editor);
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration('checkbox-display')) {
			// Recreate decorations with new colors
			checkedDecorationType.dispose();
			uncheckedDecorationType.dispose();
			decorationMap.forEach(dec => dec.dispose());
			decorationMap.clear();

			const newConfig = vscode.workspace.getConfiguration('checkbox-display');
			const newCheckedColor = newConfig.get<string>('checkedColor', '#4CAF50');
			const newUncheckedColor = newConfig.get<string>('uncheckedColor', '#757575');
			const newCarouselColor = newConfig.get<string>('carouselColor', '#FF9800');

			checkedDecorationType = vscode.window.createTextEditorDecorationType({
				before: {
					contentText: '☑ ',
					color: newCheckedColor,
					fontWeight: 'bold',
					textDecoration: 'none;'
				},
				rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
			});

			uncheckedDecorationType = vscode.window.createTextEditorDecorationType({
				before: {
					contentText: '☐ ',
					color: newUncheckedColor,
					fontWeight: 'bold',
					textDecoration: 'none;'
				},
				rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
			});

			for (let i = 0; i < circledNumbers.length; i++) {
				const decorType = vscode.window.createTextEditorDecorationType({
					before: {
						contentText: circledNumbers[i] + ' ',
						color: newCarouselColor,
						fontWeight: 'bold'
					},
					rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
				});
				decorationMap.set(i, decorType);
				context.subscriptions.push(decorType);
			}

			// Refresh all visible editors
			vscode.window.visibleTextEditors.forEach(editor => {
				updateDecorations(editor);
			});
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		const editor = vscode.window.activeTextEditor;
		if (editor && event.document === editor.document) {
			updateDecorations(editor);
			updateDiagnostics(editor.document, diagnosticsCollection);
			codeLensProvider.refresh();
		}
	}, null, context.subscriptions);

	if (vscode.window.activeTextEditor) {
		updateDecorations(vscode.window.activeTextEditor);
		updateDiagnostics(vscode.window.activeTextEditor.document, diagnosticsCollection);
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

	// Update diagnostics when a document is opened
	vscode.workspace.onDidOpenTextDocument(document => {
		updateDiagnostics(document, diagnosticsCollection);
	}, null, context.subscriptions);
}

export function toggleCheckboxAtLine(editor: vscode.TextEditor, lineNumber: number) {
	const line = editor.document.lineAt(lineNumber);
	const lineText = line.text;
	const commentSyntax = getCommentSyntax(editor.document.languageId);
	const escapedComment = escapeRegex(commentSyntax);

	const cbRegex = new RegExp(`${escapedComment}\\s*\\[CB\\]:\\s*([^|]+(?:\\|[^|\\n]+)*)`);
	const varRegex = new RegExp(`(.*)=\\s*(.+?)\\s*(${escapedComment}\\s*\\[CB\\]:\\s*)([^|]+(?:\\|[^|\\n]+)*)`);
	
	const cbMatch = lineText.match(cbRegex);
	const varMatch = lineText.match(varRegex);
	
	if (cbMatch && varMatch) {
		const beforeEquals = varMatch[1];
		const currentValue = varMatch[2].trim();
		const cbPrefix = varMatch[3];
		const valuesString = varMatch[4];
		const values = valuesString.split('|').map(v => v.trim());
		
		let newValue = values[0];
		const currentIndex = values.indexOf(currentValue);
		
		if (currentIndex !== -1 && currentIndex < values.length - 1) {
			newValue = values[currentIndex + 1];
		} else {
			newValue = values[0];
		}
		
		const newText = `${beforeEquals}= ${newValue} ${cbPrefix}${valuesString}`;

		editor.edit(editBuilder => {
			editBuilder.replace(line.range, newText);
		}).then(() => {
			// Auto-save if enabled
			const autoSave = vscode.workspace.getConfiguration('checkbox-display').get<boolean>('autoSave', false);
			if (autoSave) {
				editor.document.save();
			}
		});
	}
}

function updateDiagnostics(document: vscode.TextDocument, diagnosticsCollection: vscode.DiagnosticCollection) {
	const validateValues = vscode.workspace.getConfiguration('checkbox-display').get<boolean>('validateValues', true);
	
	if (!validateValues) {
		diagnosticsCollection.set(document.uri, []);
		return;
	}

	const diagnostics: vscode.Diagnostic[] = [];
	const commentSyntax = getCommentSyntax(document.languageId);
	const checkboxRegex = getCheckboxRegex(commentSyntax);

	for (let i = 0; i < document.lineCount; i++) {
		const lineText = document.lineAt(i).text;
		checkboxRegex.lastIndex = 0;
		const cbMatch = checkboxRegex.exec(lineText);
		
		if (cbMatch) {
			const validation = validateCheckboxValue(lineText, commentSyntax);
			if (!validation.isValid && validation.errorMessage) {
				const varValue = extractVariableValue(lineText, commentSyntax);
				if (varValue) {
					const varIndex = lineText.indexOf(varValue);
					if (varIndex !== -1) {
						const range = new vscode.Range(i, varIndex, i, varIndex + varValue.length);
						const diagnostic = new vscode.Diagnostic(
							range,
							validation.errorMessage,
							vscode.DiagnosticSeverity.Warning
						);
						diagnostic.source = 'checkbox-display';
						diagnostics.push(diagnostic);
					}
				}
			}
		}
	}

	diagnosticsCollection.set(document.uri, diagnostics);
}

function updateDecorations(editor: vscode.TextEditor) {
	const checkedDecorations: vscode.DecorationOptions[] = [];
	const uncheckedDecorations: vscode.DecorationOptions[] = [];
	const carouselDecorations: Map<number, vscode.DecorationOptions[]> = new Map();
	const commentSyntax = getCommentSyntax(editor.document.languageId);
	const checkboxRegex = getCheckboxRegex(commentSyntax);

	// Initialize carousel decoration maps
	for (let i = 0; i < circledNumbers.length; i++) {
		carouselDecorations.set(i, []);
	}

	for (let i = 0; i < editor.document.lineCount; i++) {
		const lineText = editor.document.lineAt(i).text;
		checkboxRegex.lastIndex = 0;
		const cbMatch = checkboxRegex.exec(lineText);
		
		if (cbMatch) {
			const varValue = extractVariableValue(lineText, commentSyntax);
			const values = extractCheckboxValues(cbMatch);
			const cbPattern = `${commentSyntax} [CB]:`;
			const cbIndex = lineText.indexOf(cbPattern);
			
			if (cbIndex !== -1 && varValue) {
				const startPos = new vscode.Position(i, cbIndex);
				const endPos = new vscode.Position(i, cbIndex + cbMatch[0].length);
				const decoration: vscode.DecorationOptions = { 
					range: new vscode.Range(startPos, endPos),
					hoverMessage: new vscode.MarkdownString(`**Values:** ${values.join(' → ')}\n\n**Current:** ${varValue}`)
				};

				// For binary (2 values): use ☑/☐
				if (values.length === 2) {
					if (varValue === values[0]) {
						checkedDecorations.push(decoration);
					} else {
						uncheckedDecorations.push(decoration);
					}
				}
				// For carousel (3+ values): use circled numbers
				else if (values.length > 2) {
					const currentIndex = values.indexOf(varValue);
					if (currentIndex !== -1 && currentIndex < circledNumbers.length) {
						const decorList = carouselDecorations.get(currentIndex);
						if (decorList) {
							decorList.push(decoration);
						}
					}
				}
			}
		}
	}

	// Apply binary decorations
	editor.setDecorations(checkedDecorationType, checkedDecorations);
	editor.setDecorations(uncheckedDecorationType, uncheckedDecorations);

	// Apply carousel decorations
	for (let i = 0; i < circledNumbers.length; i++) {
		const decorType = decorationMap.get(i);
		const decorations = carouselDecorations.get(i);
		if (decorType && decorations) {
			editor.setDecorations(decorType, decorations);
		}
	}
}

export function deactivate() {
	if (checkedDecorationType) {
		checkedDecorationType.dispose();
	}
	if (uncheckedDecorationType) {
		uncheckedDecorationType.dispose();
	}
}
