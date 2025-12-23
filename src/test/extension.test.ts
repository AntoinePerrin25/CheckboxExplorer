import * as assert from 'assert';
import * as vscode from 'vscode';
import { extractVariableValue } from '../extension';

suite('Checkbox Display Extension Tests', () => {
	suite('extractVariableValue', () => {
		test('should extract numeric value', () => {
			const line = 'checkbox1 = 1 # [CB]: 1|0';
			const result = extractVariableValue(line);
			assert.strictEqual(result, '1');
		});

		test('should extract string value with quotes', () => {
			const line = 'file = "example.txt" # [CB]: "exam.txt"|"example.txt"';
			const result = extractVariableValue(line);
			assert.strictEqual(result, '"example.txt"');
		});

		test('should extract value with spaces', () => {
			const line = 'path = /home/user # [CB]: /tmp|/home/user';
			const result = extractVariableValue(line);
			assert.strictEqual(result, '/home/user');
		});

		test('should return null for line without checkbox', () => {
			const line = 'normalVariable = 42';
			const result = extractVariableValue(line);
			assert.strictEqual(result, null);
		});

		test('should handle boolean values', () => {
			const line = 'debug = True # [CB]: False|True';
			const result = extractVariableValue(line);
			assert.strictEqual(result, 'True');
		});

		test('should trim whitespace', () => {
			const line = 'value =   10   # [CB]: 5|10';
			const result = extractVariableValue(line);
			assert.strictEqual(result, '10');
		});
	});

	suite('Checkbox Pattern Matching', () => {
		test('should match standard checkbox pattern', () => {
			const line = 'var = 1 # [CB]: 0|1';
			const match = line.match(/#\s*\[CB\]:\s*([^|]+)\|([^\n]+)/);
			assert.ok(match);
			assert.strictEqual(match![1].trim(), '0');
			assert.strictEqual(match![2].trim(), '1');
		});

		test('should match checkbox with string values', () => {
			const line = 'file = "a.txt" # [CB]: "a.txt"|"b.txt"';
			const match = line.match(/#\s*\[CB\]:\s*([^|]+)\|([^\n]+)/);
			assert.ok(match);
			assert.strictEqual(match![1].trim(), '"a.txt"');
			assert.strictEqual(match![2].trim(), '"b.txt"');
		});

		test('should handle spaces around checkbox', () => {
			const line = 'x = 5  #  [CB]:  10|5';
			const match = line.match(/#\s*\[CB\]:\s*([^|]+)\|([^\n]+)/);
			assert.ok(match);
			assert.strictEqual(match![1].trim(), '10');
			assert.strictEqual(match![2].trim(), '5');
		});
	});

	suite('Extension Commands', () => {
		test('toggle command should be registered', async () => {
			const commands = await vscode.commands.getCommands(true);
			assert.ok(commands.includes('checkbox-display.toggleCheckbox'));
		});

		test('toggleCheckboxAtLine command should be registered', async () => {
			const commands = await vscode.commands.getCommands(true);
			assert.ok(commands.includes('checkbox-display.toggleCheckboxAtLine'));
		});
	});
});
