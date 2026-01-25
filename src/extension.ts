import * as vscode from 'vscode';
import * as fs from 'fs';

let checkedDecorationType: vscode.TextEditorDecorationType;
let uncheckedDecorationType: vscode.TextEditorDecorationType;

// Circled number characters for carousel display (①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳)
const circledNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
const decorationMap: Map<number, vscode.TextEditorDecorationType> = new Map();

// Type for checkbox tree items
interface CheckboxItem {
	type: 'file' | 'checkbox' | 'value';
	filePath?: string;
	fileName?: string;
	lineNumber?: number;
	varName?: string;
	varValue?: string;
	checkboxValues?: string[];
	displayValue?: string; // For value items, the value to display
}

class CheckboxTreeDataProvider implements vscode.TreeDataProvider<CheckboxItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<CheckboxItem | undefined | null | void> = new vscode.EventEmitter<CheckboxItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<CheckboxItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private searchFilter: { query: string; caseSensitive: boolean; useRegex: boolean } = { query: '', caseSensitive: false, useRegex: false };
	private fileCache: Map<string, { checkboxes: CheckboxItem[], timestamp: number }> = new Map();
	private filesWithCheckboxesCache: { items: CheckboxItem[], timestamp: number } | null = null;
	private readonly FILES_CACHE_TTL = 30000;
	private readonly FILE_CACHE_TTL = 10000;

	private sortMode: 'Alphabetical' | 'Last Modified' | 'None' = 'Alphabetical';

	private refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingRefreshFiles: Set<string> = new Set();

	setSortMode(mode: 'Alphabetical' | 'Last Modified' | 'None') {
		this.sortMode = mode;
		this.invalidateAllCaches();
		this.refresh();
	}

	private invalidateAllCaches() {
		this.fileCache.clear();
		this.filesWithCheckboxesCache = null;
	}

	refresh(): void {
		this.invalidateAllCaches();
		this._onDidChangeTreeData.fire();
	}

	refreshFileDebounced(filePath: string): void {
		this.pendingRefreshFiles.add(filePath);
		
		if (this.refreshDebounceTimer) {
			clearTimeout(this.refreshDebounceTimer);
		}
		
		this.refreshDebounceTimer = setTimeout(() => {
			for (const fp of this.pendingRefreshFiles) {
				this.fileCache.delete(fp);
			}
			this.filesWithCheckboxesCache = null;
			this.pendingRefreshFiles.clear();
			this._onDidChangeTreeData.fire(undefined);
		}, 500);
	}

	refreshFile(filePath: string): void {
		this.refreshFileDebounced(filePath);
	}

	refreshCheckbox(filePath: string, lineNumber: number): void {
		this.refreshFileDebounced(filePath);
	}

	setSearchFilter(query: string, caseSensitive: boolean, useRegex: boolean): void {
		this.searchFilter = { query, caseSensitive, useRegex };
		this.invalidateAllCaches();
		this.refresh();
	}

	private matchesFilter(varName: string): boolean {
		const { query, caseSensitive, useRegex } = this.searchFilter;
		if (!query) { return true; }

		try {
			if (useRegex) {
				const flags = caseSensitive ? 'g' : 'gi';
				const regex = new RegExp(query, flags);
				return regex.test(varName);
			} else {
				const searchStr = caseSensitive ? varName : varName.toLowerCase();
				const queryStr = caseSensitive ? query : query.toLowerCase();
				return searchStr.includes(queryStr);
			}
		} catch (e) {
			return false;
		}
	}

	async getChildren(element?: CheckboxItem): Promise<CheckboxItem[]> {
		if (!element) {
			return this.getCheckboxFiles();
		} else if (element.type === 'file') {
			return this.getCheckboxesInFile(element.filePath!);
		} else if (element.type === 'checkbox') {
			const values = element.checkboxValues || [];
			return values.map((value) => ({
				type: 'value' as const,
				filePath: element.filePath!,
				lineNumber: element.lineNumber!,
				varName: element.varName!,
				varValue: element.varValue,
				checkboxValues: values,
				displayValue: value
			}));
		}
		return [];
	}

	private async getCheckboxFiles(): Promise<CheckboxItem[]> {
		const now = Date.now();
		if (this.filesWithCheckboxesCache && (now - this.filesWithCheckboxesCache.timestamp) < this.FILES_CACHE_TTL) {
			return this.applySorting(this.filesWithCheckboxesCache.items);
		}

		const excludePattern = '**/{.git,node_modules,out,dist,.vscode-test,build,coverage,__pycache__,.pytest_cache}/**';
		const includePattern = '**/*.{py,js,ts,c,cpp,h,hpp,java,go,rs,rb,php,swift,kt,cs,yaml,yml,sh,bash,ps1,r,dart}';
		
		const files = await vscode.workspace.findFiles(includePattern, excludePattern, 500);
		const fileMap = new Map<string, CheckboxItem>();

		const BATCH_SIZE = 20;
		for (let i = 0; i < files.length; i += BATCH_SIZE) {
			const batch = files.slice(i, i + BATCH_SIZE);
			await Promise.all(batch.map(async (file) => {
				try {
					const content = await fs.promises.readFile(file.fsPath, 'utf8');
					if (content.includes('[CB]:')) {
						fileMap.set(file.fsPath, {
							type: 'file',
							filePath: file.fsPath,
							fileName: file.path.split('/').pop()
						});
					}
				} catch (error) {
					// Skip files that cannot be read
				}
			}));
		}

		const items = Array.from(fileMap.values());
		this.filesWithCheckboxesCache = { items, timestamp: now };
		return this.applySorting(items);
	}

	private async applySorting(items: CheckboxItem[]): Promise<CheckboxItem[]> {
		if (this.sortMode === 'Alphabetical') {
			return [...items].sort((a, b) => (a.fileName || '').localeCompare(b.fileName || ''));
		} else if (this.sortMode === 'Last Modified') {
			const mapped = await Promise.all(items.map(async (item) => {
				const mtime = await fs.promises.stat(item.filePath!).then((s: fs.Stats) => s.mtimeMs).catch(() => 0);
				return { item, mtime };
			}));
			mapped.sort((a, b) => b.mtime - a.mtime);
			return mapped.map(m => m.item);
		}
		return items;
	}

	private async getCheckboxesInFile(filePath: string): Promise<CheckboxItem[]> {
		const cached = this.fileCache.get(filePath);
		const now = Date.now();
		if (cached && (now - cached.timestamp) < this.FILE_CACHE_TTL) {
			return cached.checkboxes;
		}

		try {
			const document = await vscode.workspace.openTextDocument(filePath);
			const checkboxes = this.findCheckboxesInDocument(document);
			this.fileCache.set(filePath, { checkboxes, timestamp: now });
			return checkboxes;
		} catch (e) {
			return [];
		}
	}

	private findCheckboxesInDocument(document: vscode.TextDocument): CheckboxItem[] {
		const checkboxes: CheckboxItem[] = [];
		const commentSyntax = getCommentSyntax(document.languageId);
		const checkboxRegex = getCheckboxRegex(commentSyntax);
		const escapedComment = escapeRegex(commentSyntax);
		const varNameRegex = new RegExp(`(.*)=\\s*(.+?)\\s*(${escapedComment}\\s*\\[CB\\]:)`);

		for (let i = 0; i < document.lineCount; i++) {
			const lineText = document.lineAt(i).text;
			checkboxRegex.lastIndex = 0;
			const cbMatch = checkboxRegex.exec(lineText);

			if (cbMatch) {
				const varValue = extractVariableValue(lineText, commentSyntax);
				const values = extractCheckboxValues(cbMatch);
				const varNameMatch = lineText.match(varNameRegex);
				const varName = varNameMatch ? varNameMatch[1].trim() : '(unnamed)';

				if (this.matchesFilter(varName)) {
					checkboxes.push({
						type: 'checkbox',
						filePath: document.uri.fsPath,
						lineNumber: i,
						varName: varName,
						varValue: varValue || undefined,
						checkboxValues: values
					});
				}
			}
		}

		return checkboxes;
	}

	getTreeItem(element: CheckboxItem): vscode.TreeItem {
		if (element.type === 'file') {
			return new vscode.TreeItem(
				element.fileName!,
				vscode.TreeItemCollapsibleState.Collapsed
			);
		} else if (element.type === 'checkbox') {
			const values = element.checkboxValues || [];
			const currentValue = element.varValue;
			const isChecked = currentValue === values[0];
			const icon = isChecked ? '☑' : '☐';

			const label = `${icon} ${element.varName} = ${currentValue}`;

			const item = new vscode.TreeItem(
				label,
				vscode.TreeItemCollapsibleState.Expanded
			);

			item.description = `Line ${(element.lineNumber || 0) + 1}`;
			item.contextValue = 'checkbox';

			item.command = {
				command: 'checkbox-display.goToCheckbox',
				title: 'Go to Checkbox',
				arguments: [element.filePath, element.lineNumber]
			};

			return item;
		} else if (element.type === 'value') {
			const isSelected = element.displayValue === element.varValue;
			const icon = isSelected ? '✓' : ' ';

			const item = new vscode.TreeItem(
				`${icon} ${element.displayValue}`,
				vscode.TreeItemCollapsibleState.None
			);

			item.contextValue = 'value';
			item.command = {
				command: 'checkbox-display.setCheckboxValue',
				title: 'Set Value',
				arguments: [element.filePath, element.lineNumber, element.displayValue]
			};

			return item;
		} else {
			return new vscode.TreeItem('Unknown');
		}
	}
}

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
	// Match: = <value> [optional ;] <whitespace> <comment> [CB]:
	const regex = new RegExp(`=\\s*(.+?)?\\s*${escaped}\\s*\\[CB\\]:`);
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

	// Create Checkbox Explorer tree view
	const checkboxTreeProvider = new CheckboxTreeDataProvider();
		// Initialize sort mode from settings
	const initialSort = vscode.workspace.getConfiguration('checkbox-display').get<string>('sortMode', 'Alphabetical') as 'Alphabetical' | 'Last Modified' | 'None';
	checkboxTreeProvider.setSortMode(initialSort);
	
	// Command to change sort mode
	const setSortModeCommand = vscode.commands.registerCommand('checkbox-display.setSortMode', async () => {
		const choice = await vscode.window.showQuickPick(['Alphabetical', 'Last Modified', 'None'], { placeHolder: 'Select sort mode for Checkbox Explorer' });
		if (choice) {
			await vscode.workspace.getConfiguration('checkbox-display').update('sortMode', choice, vscode.ConfigurationTarget.Global);
			checkboxTreeProvider.setSortMode(choice as any);
		}
	});
	context.subscriptions.push(setSortModeCommand);
	const treeView = vscode.window.createTreeView('checkbox-explorer', {
		treeDataProvider: checkboxTreeProvider,
		showCollapseAll: true,
		canSelectMany: false
	});
	context.subscriptions.push(treeView);

	// Register command to go to checkbox
	const goToCheckboxCommand = vscode.commands.registerCommand('checkbox-display.goToCheckbox', async (filePath?: string, lineNumber?: number) => {
		// If called without parameters, do nothing (must be called with context from tree)
		if (filePath === undefined || lineNumber === undefined) {
			return;
		}
		
		const document = await vscode.workspace.openTextDocument(filePath);
		const editor = await vscode.window.showTextDocument(document);
		const line = editor.document.lineAt(lineNumber);
		editor.selection = new vscode.Selection(line.range.start, line.range.start);
		editor.revealRange(line.range, vscode.TextEditorRevealType.InCenter);
	});
	context.subscriptions.push(goToCheckboxCommand);

	// Register command to toggle from explorer
	const toggleFromExplorerCommand = vscode.commands.registerCommand('checkbox-display.toggleFromExplorer', async (item: any) => {
		if (item.type === 'checkbox') {
			const editor = await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(item.filePath));
			// Wait for the edit to complete, then refresh the specific checkbox in the tree
			await toggleCheckboxAtLine(editor, item.lineNumber);
			checkboxTreeProvider.refreshCheckbox(item.filePath, item.lineNumber);
		}
	});
	context.subscriptions.push(toggleFromExplorerCommand);

	// Add search functionality to tree view
	const searchCommand = vscode.commands.registerCommand('checkbox-display.searchCheckboxes', async () => {
		const query = await vscode.window.showInputBox({
			placeHolder: 'Search checkboxes (supports regex with ^... syntax)',
			prompt: 'Enter variable name to search'
		});

		if (query !== undefined) {
			// Get search case sensitivity setting
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const searchCaseSensitive = config.get<string>('searchCaseSensitive', 'Case Insensitive');
			
			let isCaseSensitive = searchCaseSensitive === 'Case Sensitive';
			
			// If set to "Prompt", ask the user
			if (searchCaseSensitive === 'Prompt') {
				const caseSensitiveChoice = await vscode.window.showQuickPick(
					[{ label: 'Case Sensitive', picked: false }, { label: 'Case Insensitive', picked: true }],
					{ placeHolder: 'Choose search mode' }
				);
				isCaseSensitive = caseSensitiveChoice?.label === 'Case Sensitive';
			}
			
			const useRegex = query.startsWith('^') || query.includes('[');
			
			checkboxTreeProvider.setSearchFilter(query, isCaseSensitive, useRegex);
			treeView.title = `Checkbox Explorer (${query})`;
		}
	});
	context.subscriptions.push(searchCommand);

	// Clear search
	const clearSearchCommand = vscode.commands.registerCommand('checkbox-display.clearSearch', () => {
		checkboxTreeProvider.setSearchFilter('', false, false);
		treeView.title = 'Checkbox Explorer';
	});
	context.subscriptions.push(clearSearchCommand);

	// Command to refresh Checkbox Explorer
	const refreshExplorerCommand = vscode.commands.registerCommand('checkbox-display.refreshExplorer', () => {
		checkboxTreeProvider.refresh();
	});
	context.subscriptions.push(refreshExplorerCommand);

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
		// Update decorations if the document is visible in an editor
		const editor = vscode.window.visibleTextEditors.find(e => e.document === event.document) || vscode.window.activeTextEditor;
		if (editor) {
			updateDecorations(editor);
		}

		// Always update diagnostics and codelenses for the changed document
		updateDiagnostics(event.document, diagnosticsCollection);
		codeLensProvider.refresh();

		// Refresh the tree for this file so new checkboxes are detected
		try {
			checkboxTreeProvider.refreshFile(event.document.uri.fsPath);
		} catch (e) {
			// Fallback to full refresh if anything goes wrong
			checkboxTreeProvider.refresh();
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

	const setCheckboxValueCommand = vscode.commands.registerCommand('checkbox-display.setCheckboxValue', async (filePath: string, lineNumber: number, newValue: string) => {
		const document = await vscode.workspace.openTextDocument(filePath);
		const editor = await vscode.window.showTextDocument(document);
		
		const line = editor.document.lineAt(lineNumber);
		const lineText = line.text;
		const commentSyntax = getCommentSyntax(editor.document.languageId);
		const escapedComment = escapeRegex(commentSyntax);
		const varRegex = new RegExp(`(.*)=\\s*(.+?)\\s*(${escapedComment}\\s*\\[CB\\]:\\s*)([^|]+(?:\\|[^|\\n]+)*)`);
		//const varRegex = new RegExp(`(.*)=\\s*(.+?);?\\s*(${escapedComment}\\s*\\[CB\\]:\\s*)([^|]+(?:\\|[^|\\n]+)*)`);
		const varMatch = lineText.match(varRegex);
		
		if (varMatch) {
			const beforeEquals = varMatch[1];
			const cbPrefix = varMatch[3];
			const valuesString = varMatch[4];
			const newText = `${beforeEquals}= ${newValue} ${cbPrefix}${valuesString}`;

			editor.edit(editBuilder => {
				editBuilder.replace(line.range, newText);
			}).then(() => {
				const autoSave = vscode.workspace.getConfiguration('checkbox-display').get<boolean>('autoSave', false);
				if (autoSave) {
					editor.document.save();
				}
				// Only refresh the specific checkbox, not the entire tree
				checkboxTreeProvider.refreshCheckbox(filePath, lineNumber);
			});
		}
	});

	context.subscriptions.push(toggleCommand);
	context.subscriptions.push(insertSnippetCommand);
	context.subscriptions.push(toggleAtLineCommand);
	context.subscriptions.push(setCheckboxValueCommand);
	context.subscriptions.push(codeLensProviderDisposable);
	context.subscriptions.push(checkedDecorationType);
	context.subscriptions.push(uncheckedDecorationType);

	// Update diagnostics when a document is opened
	vscode.workspace.onDidOpenTextDocument(document => {
		updateDiagnostics(document, diagnosticsCollection);
	}, null, context.subscriptions);
}

export function toggleCheckboxAtLine(editor: vscode.TextEditor, lineNumber: number): Thenable<boolean> {
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

		return editor.edit(editBuilder => {
			editBuilder.replace(line.range, newText);
		}).then(result => {
			// Auto-save if enabled
			const autoSave = vscode.workspace.getConfiguration('checkbox-display').get<boolean>('autoSave', false);
			if (autoSave) {
				editor.document.save();
			}
			return result;
		});
	}
	return Promise.resolve(false);
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
