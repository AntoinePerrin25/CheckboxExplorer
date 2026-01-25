import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { extractVariableValue, getCommentSyntax, getCheckboxRegex, extractCheckboxValues, validateCheckboxValue, toggleCheckboxAtLine } from '../extension';

suite('Checkbox Display Extension Tests', () => {
	suite('getCommentSyntax', () => {
		test('should return # for python', () => {
			assert.strictEqual(getCommentSyntax('python'), '#');
		});

		test('should return // for javascript', () => {
			assert.strictEqual(getCommentSyntax('javascript'), '//');
		});

		test('should return // for typescript', () => {
			assert.strictEqual(getCommentSyntax('typescript'), '//');
		});

		test('should return // for c', () => {
			assert.strictEqual(getCommentSyntax('c'), '//');
		});

		test('should return // for cpp', () => {
			assert.strictEqual(getCommentSyntax('cpp'), '//');
		});

		test('should return // for java', () => {
			assert.strictEqual(getCommentSyntax('java'), '//');
		});

		test('should return # as default for unknown language', () => {
			assert.strictEqual(getCommentSyntax('unknown'), '#');
		});
	});

	suite('extractVariableValue', () => {
		test('should extract numeric value with # comment', () => {
			const line = 'checkbox1 = 1 # [CB]: 1|0';
			const result = extractVariableValue(line, '#');
			assert.strictEqual(result, '1');
		});

		test('should extract numeric value with // comment', () => {
			const line = 'int checkbox1 = 1; // [CB]: 1|0';
			const result = extractVariableValue(line, '//');
			assert.strictEqual(result, '1;');
		});

		test('should extract string value with quotes', () => {
			const line = 'file = "example.txt" # [CB]: "exam.txt"|"example.txt"';
			const result = extractVariableValue(line, '#');
			assert.strictEqual(result, '"example.txt"');
		});

		test('should extract value with spaces', () => {
			const line = 'path = /home/user # [CB]: /tmp|/home/user';
			const result = extractVariableValue(line, '#');
			assert.strictEqual(result, '/home/user');
		});

		test('should return null for line without checkbox', () => {
			const line = 'normalVariable = 42';
			const result = extractVariableValue(line, '#');
			assert.strictEqual(result, null);
		});

		test('should handle boolean values', () => {
			const line = 'debug = True # [CB]: False|True';
			const result = extractVariableValue(line, '#');
			assert.strictEqual(result, 'True');
		});

		test('should trim whitespace', () => {
			const line = 'value =   10   # [CB]: 5|10';
			const result = extractVariableValue(line, '#');
			assert.strictEqual(result, '10');
		});
	});

	suite('Checkbox Pattern Matching', () => {
		test('should match standard checkbox pattern with #', () => {
			const line = 'var = 1 # [CB]: 0|1';
			const regex = getCheckboxRegex('#');
			regex.lastIndex = 0;
			const match = regex.exec(line);
			assert.ok(match);
			const values = extractCheckboxValues(match!);
			assert.deepStrictEqual(values, ['0', '1']);
		});

		test('should match checkbox with // comment', () => {
			const line = 'int var = 1; // [CB]: 0|1';
			const regex = getCheckboxRegex('//');
			regex.lastIndex = 0;
			const match = regex.exec(line);
			assert.ok(match);
			const values = extractCheckboxValues(match!);
			assert.deepStrictEqual(values, ['0', '1']);
		});

		test('should match checkbox with string values', () => {
			const line = 'file = "a.txt" # [CB]: "a.txt"|"b.txt"';
			const regex = getCheckboxRegex('#');
			regex.lastIndex = 0;
			const match = regex.exec(line);
			assert.ok(match);
			const values = extractCheckboxValues(match!);
			assert.deepStrictEqual(values, ['"a.txt"', '"b.txt"']);
		});

		test('should handle spaces around checkbox', () => {
			const line = 'x = 5  #  [CB]:  10|5';
			const regex = getCheckboxRegex('#');
			regex.lastIndex = 0;
			const match = regex.exec(line);
			assert.ok(match);
			const values = extractCheckboxValues(match!);
			assert.deepStrictEqual(values, ['10', '5']);
		});
	});

	suite('Multi-language Support', () => {
		test('should detect Python checkbox', () => {
			const line = 'enabled = True # [CB]: False|True';
			const regex = getCheckboxRegex('#');
			regex.lastIndex = 0;
			assert.ok(regex.exec(line));
		});

		test('should detect JavaScript checkbox', () => {
			const line = 'const enabled = true; // [CB]: false|true';
			const regex = getCheckboxRegex('//');
			regex.lastIndex = 0;
			assert.ok(regex.exec(line));
		});

		test('should detect C++ checkbox', () => {
			const line = 'bool enabled = true; // [CB]: false|true';
			const regex = getCheckboxRegex('//');
			regex.lastIndex = 0;
			assert.ok(regex.exec(line));
		});
	});

	suite('Carousel (3+ values)', () => {
		test('should extract values from checkbox pattern', () => {
			const line = 'mode = two # [CB]: one|two|three';
			const regex = getCheckboxRegex('#');
			regex.lastIndex = 0;
			const match = regex.exec(line);
			assert.ok(match);
			const values = extractCheckboxValues(match!);
			assert.deepStrictEqual(values, ['one', 'two', 'three']);
		});

		test('should extract current variable value for carousel', () => {
			const line = 'mode = two # [CB]: one|two|three';
			const result = extractVariableValue(line, '#');
			assert.strictEqual(result, 'two');
		});

		test('should handle spaces and quoted values', () => {
			const line = 'file = "b.txt" # [CB]: "a.txt" | "b.txt" | "c.txt"';
			const regex = getCheckboxRegex('#');
			regex.lastIndex = 0;
			const match = regex.exec(line);
			assert.ok(match);
			const values = extractCheckboxValues(match!);
			assert.deepStrictEqual(values, ['"a.txt"', '"b.txt"', '"c.txt"']);
		});
	});

	suite('Value Validation', () => {
		test('should validate correct value in carousel', () => {
			const line = 'mode = two # [CB]: one|two|three';
			const validation = validateCheckboxValue(line, '#');
			assert.strictEqual(validation.isValid, true);
		});

		test('should detect invalid value in carousel', () => {
			const line = 'mode = invalid # [CB]: one|two|three';
			const validation = validateCheckboxValue(line, '#');
			assert.strictEqual(validation.isValid, false);
			assert.ok(validation.errorMessage?.includes('invalid'));
			assert.ok(validation.errorMessage?.includes('one, two, three'));
		});

		test('should pass validation for binary checkbox with valid value', () => {
			const line = 'enabled = true # [CB]: false|true';
			const validation = validateCheckboxValue(line, '#');
			assert.strictEqual(validation.isValid, true);
		});

		test('should fail validation for binary checkbox with invalid value', () => {
			const line = 'enabled = maybe # [CB]: false|true';
			const validation = validateCheckboxValue(line, '#');
			assert.strictEqual(validation.isValid, false);
			assert.ok(validation.errorMessage?.includes('maybe'));
		});

		test('should pass validation for line without checkbox', () => {
			const line = 'normalVariable = 42';
			const validation = validateCheckboxValue(line, '#');
			assert.strictEqual(validation.isValid, true);
		});

		test('should pass validation for line without variable value', () => {
			const line = '# [CB]: one|two|three';
			const validation = validateCheckboxValue(line, '#');
			assert.strictEqual(validation.isValid, true);
		});
	});

	suite('Auto-save (Configuration)', () => {
		test('should have autoSave config option', async () => {
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const autoSave = config.get<boolean>('autoSave');
			// Config should either have a default or be undefined (which defaults to false)
			assert.ok(autoSave !== undefined || config.get('autoSave') === false);
		});

		test('should default autoSave to false', async () => {
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const autoSave = config.get<boolean>('autoSave', false);
			assert.strictEqual(autoSave, false);
		});

		test('should have validateValues config option', async () => {
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const validateValues = config.get<boolean>('validateValues');
			assert.ok(validateValues !== undefined || config.get('validateValues') === true);
		});

		test('should default validateValues to true', async () => {
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const validateValues = config.get<boolean>('validateValues', true);
			assert.strictEqual(validateValues, true);
		});
	});

	suite('Feature 2: Color Configuration', () => {
		test('should have checkedColor config option', async () => {
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const color = config.get<string>('checkedColor');
			assert.ok(color !== undefined || config.get('checkedColor') === '#4CAF50');
		});

		test('should default checkedColor to green', async () => {
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const color = config.get<string>('checkedColor', '#4CAF50');
			assert.strictEqual(color, '#4CAF50');
		});

		test('should have uncheckedColor config option', async () => {
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const color = config.get<string>('uncheckedColor');
			assert.ok(color !== undefined || config.get('uncheckedColor') === '#757575');
		});

		test('should default uncheckedColor to gray', async () => {
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const color = config.get<string>('uncheckedColor', '#757575');
			assert.strictEqual(color, '#757575');
		});

		test('should have carouselColor config option', async () => {
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const color = config.get<string>('carouselColor');
			assert.ok(color !== undefined || config.get('carouselColor') === '#FF9800');
		});

		test('should default carouselColor to orange', async () => {
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const color = config.get<string>('carouselColor', '#FF9800');
			assert.strictEqual(color, '#FF9800');
		});
	});

	suite('Extension Commands', () => {
		test('toggle command should be registered', async () => {
			const commands = await vscode.commands.getCommands(true);
			// Some commands may register slightly after activation; retry a few times to avoid flakiness
			async function exists(cmd: string) {
				for (let i = 0; i < 5; i++) {
					const cmds = await vscode.commands.getCommands(true);
					if (cmds.includes(cmd)) {return true;}
					await new Promise(r => setTimeout(r, 100));
				}
				return false;
			}

			const ok1 = await exists('checkbox-display.toggleCheckbox');
			const ok2 = await exists('checkbox-display.toggleCheckboxAtLine');
			assert.ok(ok1 || ok2);
		});

		test('toggleCheckboxAtLine command should be registered', async () => {
			const commands = await vscode.commands.getCommands(true);
			assert.ok(commands.includes('checkbox-display.toggleCheckboxAtLine'));
		});

		test('setSortMode command should be registered', async () => {
			const commands = await vscode.commands.getCommands(true);
			assert.ok(commands.includes('checkbox-display.setSortMode'));
		});

		test('goToCheckbox command should be registered', async () => {
			const commands = await vscode.commands.getCommands(true);
			assert.ok(commands.includes('checkbox-display.goToCheckbox'));
		});

		test('searchCheckboxes command should be registered', async () => {
			const commands = await vscode.commands.getCommands(true);
			assert.ok(commands.includes('checkbox-display.searchCheckboxes'));
		});

		test('clearSearch command should be registered', async () => {
			const commands = await vscode.commands.getCommands(true);
			assert.ok(commands.includes('checkbox-display.clearSearch'));
		});

		test('refreshExplorer command should be registered', async () => {
			const commands = await vscode.commands.getCommands(true);
			assert.ok(commands.includes('checkbox-display.refreshExplorer'));
		});

		test('insertSnippet command should be registered', async () => {
			const commands = await vscode.commands.getCommands(true);
			assert.ok(commands.includes('checkbox-display.insertSnippet'));
		});

		test('setCheckboxValue command should be registered', async () => {
			const commands = await vscode.commands.getCommands(true);
			assert.ok(commands.includes('checkbox-display.setCheckboxValue'));
		});

		test('toggleFromExplorer command should be registered', async () => {
			const commands = await vscode.commands.getCommands(true);
			assert.ok(commands.includes('checkbox-display.toggleFromExplorer'));
		});
	});

	suite('Additional Configuration Options', () => {
		test('should have showCodeLens config option', async () => {
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const showCodeLens = config.get<boolean>('showCodeLens');
			assert.ok(showCodeLens !== undefined);
		});

		test('should default showCodeLens to true', async () => {
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const showCodeLens = config.get<boolean>('showCodeLens', true);
			assert.strictEqual(showCodeLens, true);
		});

		test('should have sortMode config option', async () => {
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const sortMode = config.get<string>('sortMode');
			assert.ok(sortMode !== undefined || config.get('sortMode') === 'Alphabetical');
		});

		test('should default sortMode to Alphabetical', async () => {
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const sortMode = config.get<string>('sortMode', 'Alphabetical');
			assert.strictEqual(sortMode, 'Alphabetical');
		});

		test('should have searchCaseSensitive config option', async () => {
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const searchCaseSensitive = config.get<string>('searchCaseSensitive');
			assert.ok(searchCaseSensitive !== undefined || config.get('searchCaseSensitive') === 'Case Insensitive');
		});

		test('should default searchCaseSensitive to Case Insensitive', async () => {
			const config = vscode.workspace.getConfiguration('checkbox-display');
			const searchCaseSensitive = config.get<string>('searchCaseSensitive', 'Case Insensitive');
			assert.strictEqual(searchCaseSensitive, 'Case Insensitive');
		});
	});

	suite('Edge Cases and Error Handling', () => {
		test('should handle empty line', () => {
			const line = '';
			const result = extractVariableValue(line, '#');
			assert.strictEqual(result, null);
		});

		test('should handle line with only comment', () => {
			const line = '# This is just a comment';
			const result = extractVariableValue(line, '#');
			assert.strictEqual(result, null);
		});

		test('should handle line with CB but no values', () => {
			const line = 'x = 1 # [CB]:';
			const regex = getCheckboxRegex('#');
			regex.lastIndex = 0;
			const match = regex.exec(line);
			// Should not match or return empty values
			if (match) {
				const values = extractCheckboxValues(match);
				assert.ok(values.length === 0 || values[0] === '');
			}
		});

		test('should handle special characters in values', () => {
			const line = 'path = /tmp # [CB]: /tmp|/home/user|/var/log';
			const regex = getCheckboxRegex('#');
			regex.lastIndex = 0;
			const match = regex.exec(line);
			assert.ok(match);
			const values = extractCheckboxValues(match!);
			assert.deepStrictEqual(values, ['/tmp', '/home/user', '/var/log']);
		});

		test('should handle numeric values', () => {
			const line = 'count = 100 # [CB]: 10|50|100|500';
			const regex = getCheckboxRegex('#');
			regex.lastIndex = 0;
			const match = regex.exec(line);
			assert.ok(match);
			const values = extractCheckboxValues(match!);
			assert.deepStrictEqual(values, ['10', '50', '100', '500']);
		});

		test('should handle single value checkbox', () => {
			const line = 'single = only # [CB]: only';
			const regex = getCheckboxRegex('#');
			regex.lastIndex = 0;
			const match = regex.exec(line);
			assert.ok(match);
			const values = extractCheckboxValues(match!);
			assert.deepStrictEqual(values, ['only']);
		});

		test('should handle many values (10+)', () => {
			const line = 'level = 5 # [CB]: 1|2|3|4|5|6|7|8|9|10';
			const regex = getCheckboxRegex('#');
			regex.lastIndex = 0;
			const match = regex.exec(line);
			assert.ok(match);
			const values = extractCheckboxValues(match!);
			assert.strictEqual(values.length, 10);
			assert.deepStrictEqual(values, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
		});

		test('should handle values with equals sign', () => {
			const line = 'expr = a=b # [CB]: a=b|c=d';
			const result = extractVariableValue(line, '#');
			assert.strictEqual(result, 'a=b');
		});

		test('should handle unicode values', () => {
			const line = 'emoji = 🔴 # [CB]: 🔴|🟢|🟡';
			const regex = getCheckboxRegex('#');
			regex.lastIndex = 0;
			const match = regex.exec(line);
			assert.ok(match);
			const values = extractCheckboxValues(match!);
			assert.deepStrictEqual(values, ['🔴', '🟢', '🟡']);
		});

		test('should validate unicode value correctly', () => {
			const line = 'emoji = 🔴 # [CB]: 🔴|🟢|🟡';
			const validation = validateCheckboxValue(line, '#');
			assert.strictEqual(validation.isValid, true);
		});
	});

	suite('toggleCheckboxAtLine Export', () => {
		test('toggleCheckboxAtLine function should be exported', () => {
			assert.ok(typeof toggleCheckboxAtLine === 'function');
		});
	});

	suite('Integration Tests with Real Files', () => {
		let tempDir: string;
		let createdFiles: string[] = [];

		// Helper to create a temp file with content
		async function createTempFile(filename: string, content: string): Promise<string> {
			const filePath = path.join(tempDir, filename);
			await fs.promises.writeFile(filePath, content, 'utf8');
			createdFiles.push(filePath);
			return filePath;
		}

		// Helper to wait for extension to process
		async function waitForProcessing(ms: number = 600): Promise<void> {
			await new Promise(resolve => setTimeout(resolve, ms));
		}

		suiteSetup(async () => {
			// Create a temp directory for test files
			tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'checkbox-test-'));
		});

		suiteTeardown(async () => {
			// Clean up temp files
			for (const file of createdFiles) {
				try {
					await fs.promises.unlink(file);
				} catch (e) {
					// Ignore cleanup errors
				}
			}
			try {
				await fs.promises.rmdir(tempDir);
			} catch (e) {
				// Ignore cleanup errors
			}
		});

		suite('Python File Support', () => {
			test('should detect checkbox in Python file', async () => {
				const content = 'debug = True # [CB]: False|True\n';
				const filePath = await createTempFile('test_python.py', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const commentSyntax = getCommentSyntax(doc.languageId);
				
				assert.strictEqual(commentSyntax, '#');
				
				const lineText = doc.lineAt(0).text;
				const regex = getCheckboxRegex(commentSyntax);
				regex.lastIndex = 0;
				const match = regex.exec(lineText);
				
				assert.ok(match, 'Checkbox pattern should be detected in Python file');
				const values = extractCheckboxValues(match!);
				assert.deepStrictEqual(values, ['False', 'True']);
			});

			test('should extract correct value from Python checkbox', async () => {
				const content = 'mode = "dev" # [CB]: "dev"|"prod"|"test"\n';
				const filePath = await createTempFile('test_python_mode.py', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const lineText = doc.lineAt(0).text;
				const value = extractVariableValue(lineText, '#');
				
				assert.strictEqual(value, '"dev"');
			});
		});

		suite('JavaScript/TypeScript File Support', () => {
			test('should detect checkbox in JavaScript file', async () => {
				const content = 'const DEBUG = true; // [CB]: false|true\n';
				const filePath = await createTempFile('test_js.js', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const commentSyntax = getCommentSyntax(doc.languageId);
				
				assert.strictEqual(commentSyntax, '//');
				
				const lineText = doc.lineAt(0).text;
				const regex = getCheckboxRegex(commentSyntax);
				regex.lastIndex = 0;
				const match = regex.exec(lineText);
				
				assert.ok(match, 'Checkbox pattern should be detected in JS file');
				const values = extractCheckboxValues(match!);
				assert.deepStrictEqual(values, ['false', 'true']);
			});

			test('should detect checkbox in TypeScript file', async () => {
				const content = 'const level: number = 2; // [CB]: 1|2|3\n';
				const filePath = await createTempFile('test_ts.ts', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const commentSyntax = getCommentSyntax(doc.languageId);
				
				assert.strictEqual(commentSyntax, '//');
				
				const lineText = doc.lineAt(0).text;
				const regex = getCheckboxRegex(commentSyntax);
				regex.lastIndex = 0;
				const match = regex.exec(lineText);
				
				assert.ok(match, 'Checkbox pattern should be detected in TS file');
				const values = extractCheckboxValues(match!);
				assert.deepStrictEqual(values, ['1', '2', '3']);
			});
		});

		suite('C/C++ File Support', () => {
			test('should detect checkbox in C file', async () => {
				const content = 'int debug = 1; // [CB]: 0|1\n';
				const filePath = await createTempFile('test_c.c', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const commentSyntax = getCommentSyntax(doc.languageId);
				
				assert.strictEqual(commentSyntax, '//');
				
				const lineText = doc.lineAt(0).text;
				const regex = getCheckboxRegex(commentSyntax);
				regex.lastIndex = 0;
				const match = regex.exec(lineText);
				
				assert.ok(match, 'Checkbox pattern should be detected in C file');
				const values = extractCheckboxValues(match!);
				assert.deepStrictEqual(values, ['0', '1']);
			});

			test('should detect checkbox in C++ file', async () => {
				const content = 'bool verbose = true; // [CB]: false|true\n';
				const filePath = await createTempFile('test_cpp.cpp', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const commentSyntax = getCommentSyntax(doc.languageId);
				
				assert.strictEqual(commentSyntax, '//');
				
				const lineText = doc.lineAt(0).text;
				const regex = getCheckboxRegex(commentSyntax);
				regex.lastIndex = 0;
				const match = regex.exec(lineText);
				
				assert.ok(match, 'Checkbox pattern should be detected in C++ file');
			});
		});

		suite('Java File Support', () => {
			test('should detect checkbox in Java file', async () => {
				const content = 'int logLevel = 2; // [CB]: 0|1|2|3\n';
				const filePath = await createTempFile('Test.java', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const commentSyntax = getCommentSyntax(doc.languageId);
				
				assert.strictEqual(commentSyntax, '//');
				
				const lineText = doc.lineAt(0).text;
				const regex = getCheckboxRegex(commentSyntax);
				regex.lastIndex = 0;
				const match = regex.exec(lineText);
				
				assert.ok(match, 'Checkbox pattern should be detected in Java file');
				const values = extractCheckboxValues(match!);
				assert.deepStrictEqual(values, ['0', '1', '2', '3']);
			});
		});

		suite('Go File Support', () => {
			test('should detect checkbox in Go file', async () => {
				const content = 'var debug = true // [CB]: false|true\n';
				const filePath = await createTempFile('test.go', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const commentSyntax = getCommentSyntax(doc.languageId);
				
				assert.strictEqual(commentSyntax, '//');
				
				const lineText = doc.lineAt(0).text;
				const regex = getCheckboxRegex(commentSyntax);
				regex.lastIndex = 0;
				const match = regex.exec(lineText);
				
				assert.ok(match, 'Checkbox pattern should be detected in Go file');
			});
		});

		suite('Rust File Support', () => {
			test('should detect checkbox in Rust file', async () => {
				const content = 'let debug = true; // [CB]: false|true\n';
				const filePath = await createTempFile('test.rs', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const commentSyntax = getCommentSyntax(doc.languageId);
				
				assert.strictEqual(commentSyntax, '//');
				
				const lineText = doc.lineAt(0).text;
				const regex = getCheckboxRegex(commentSyntax);
				regex.lastIndex = 0;
				const match = regex.exec(lineText);
				
				assert.ok(match, 'Checkbox pattern should be detected in Rust file');
			});
		});

		suite('Ruby File Support', () => {
			test('should detect checkbox in Ruby file', async () => {
				const content = 'debug = true # [CB]: false|true\n';
				const filePath = await createTempFile('test.rb', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const commentSyntax = getCommentSyntax(doc.languageId);
				
				assert.strictEqual(commentSyntax, '#');
				
				const lineText = doc.lineAt(0).text;
				const regex = getCheckboxRegex(commentSyntax);
				regex.lastIndex = 0;
				const match = regex.exec(lineText);
				
				assert.ok(match, 'Checkbox pattern should be detected in Ruby file');
			});
		});

		suite('YAML File Support', () => {
			test('should detect checkbox in YAML file', async () => {
				const content = 'debug: true # [CB]: false|true\n';
				const filePath = await createTempFile('test.yaml', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const commentSyntax = getCommentSyntax(doc.languageId);
				
				assert.strictEqual(commentSyntax, '#');
				
				const lineText = doc.lineAt(0).text;
				const regex = getCheckboxRegex(commentSyntax);
				regex.lastIndex = 0;
				const match = regex.exec(lineText);
				
				assert.ok(match, 'Checkbox pattern should be detected in YAML file');
			});
		});

		suite('Shell Script File Support', () => {
			test('should detect checkbox in Shell script', async () => {
				const content = 'DEBUG=1 # [CB]: 0|1\n';
				const filePath = await createTempFile('test.sh', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const commentSyntax = getCommentSyntax(doc.languageId);
				
				assert.strictEqual(commentSyntax, '#');
				
				const lineText = doc.lineAt(0).text;
				const regex = getCheckboxRegex(commentSyntax);
				regex.lastIndex = 0;
				const match = regex.exec(lineText);
				
				assert.ok(match, 'Checkbox pattern should be detected in Shell script');
			});
		});

		suite('Multiple Checkboxes in One File', () => {
			test('should detect multiple checkboxes in file', async () => {
				const content = `# Configuration file
debug = True # [CB]: False|True
mode = "dev" # [CB]: "dev"|"prod"|"test"
level = 2 # [CB]: 1|2|3|4|5
`;
				const filePath = await createTempFile('multi_checkbox.py', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const commentSyntax = getCommentSyntax(doc.languageId);
				const regex = getCheckboxRegex(commentSyntax);
				
				let matchCount = 0;
				for (let i = 0; i < doc.lineCount; i++) {
					const lineText = doc.lineAt(i).text;
					regex.lastIndex = 0;
					if (regex.exec(lineText)) {
						matchCount++;
					}
				}
				
				assert.strictEqual(matchCount, 3, 'Should find 3 checkboxes in file');
			});
		});

		suite('Checkbox Validation with Real Files', () => {
			test('should validate correct value in real file', async () => {
				const content = 'mode = "prod" # [CB]: "dev"|"prod"|"test"\n';
				const filePath = await createTempFile('valid_checkbox.py', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const lineText = doc.lineAt(0).text;
				const validation = validateCheckboxValue(lineText, '#');
				
				assert.strictEqual(validation.isValid, true);
			});

			test('should detect invalid value in real file', async () => {
				const content = 'mode = "staging" # [CB]: "dev"|"prod"|"test"\n';
				const filePath = await createTempFile('invalid_checkbox.py', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const lineText = doc.lineAt(0).text;
				const validation = validateCheckboxValue(lineText, '#');
				
				assert.strictEqual(validation.isValid, false);
				assert.ok(validation.errorMessage?.includes('staging'));
			});
		});

		suite('Toggle Checkbox in Real File', () => {
			test('should toggle checkbox value in editor', async () => {
				const content = 'enabled = False # [CB]: False|True\n';
				const filePath = await createTempFile('toggle_test.py', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const editor = await vscode.window.showTextDocument(doc);
				
				// Toggle the checkbox
				const result = await toggleCheckboxAtLine(editor, 0);
				assert.ok(result, 'Toggle should succeed');
				
				// Wait for edit to apply
				await waitForProcessing(100);
				
				// Check the new value
				const newLineText = editor.document.lineAt(0).text;
				const newValue = extractVariableValue(newLineText, '#');
				
				assert.strictEqual(newValue, 'True', 'Value should toggle from False to True');
			});

			test('should cycle through carousel values', async () => {
				const content = 'level = 1 # [CB]: 1|2|3\n';
				const filePath = await createTempFile('carousel_test.py', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const editor = await vscode.window.showTextDocument(doc);
				
				// First toggle: 1 -> 2
				await toggleCheckboxAtLine(editor, 0);
				await waitForProcessing(100);
				let value = extractVariableValue(editor.document.lineAt(0).text, '#');
				assert.strictEqual(value, '2');
				
				// Second toggle: 2 -> 3
				await toggleCheckboxAtLine(editor, 0);
				await waitForProcessing(100);
				value = extractVariableValue(editor.document.lineAt(0).text, '#');
				assert.strictEqual(value, '3');
				
				// Third toggle: 3 -> 1 (wrap around)
				await toggleCheckboxAtLine(editor, 0);
				await waitForProcessing(100);
				value = extractVariableValue(editor.document.lineAt(0).text, '#');
				assert.strictEqual(value, '1');
			});
		});

		suite('File Modification Detection', () => {
			test('should detect checkbox added to file', async () => {
				// Start with no checkbox
				const content = 'debug = True\n';
				const filePath = await createTempFile('modify_test.py', content);
				
				const doc = await vscode.workspace.openTextDocument(filePath);
				const editor = await vscode.window.showTextDocument(doc);
				
				// Initially no checkbox
				const regex = getCheckboxRegex('#');
				regex.lastIndex = 0;
				let match = regex.exec(doc.lineAt(0).text);
				assert.ok(!match, 'Should have no checkbox initially');
				
				// Add checkbox pattern
				const newContent = 'debug = True # [CB]: False|True\n';
				const edit = new vscode.WorkspaceEdit();
				edit.replace(doc.uri, new vscode.Range(0, 0, 0, doc.lineAt(0).text.length), newContent.trim());
				await vscode.workspace.applyEdit(edit);
				
				await waitForProcessing(100);
				
				// Now should have checkbox
				regex.lastIndex = 0;
				match = regex.exec(editor.document.lineAt(0).text);
				assert.ok(match, 'Should detect checkbox after modification');
			});
		});
	});
});
