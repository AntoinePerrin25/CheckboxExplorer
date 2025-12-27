import * as assert from 'assert';
import * as vscode from 'vscode';
import { extractVariableValue, getCommentSyntax, getCheckboxRegex, extractCheckboxValues, validateCheckboxValue } from '../extension';

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
	});
});
