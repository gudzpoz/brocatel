import assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { activate, setTestContent } from './helper';
// import * as myExtension from '../../extension';

suite('Web Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');
	suiteTeardown(() => {
		vscode.window.showInformationMessage('All tests done!');
	});

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('Markdown default completion', async () => {
		const uri = vscode.Uri.file('/tmp/test.md');
  	await activate(uri, true);
		await setTestContent('[](#)\n# heading');
	  await testCompletion(uri, new vscode.Position(0, 4), {
      items: [
        { label: 'heading', kind: vscode.CompletionItemKind.Text },
      ]
    });
	});
});

async function testCompletion(
  docUri: vscode.Uri,
  position: vscode.Position,
  expectedCompletionList: vscode.CompletionList
) {
  // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
  const actualCompletionList = (await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    docUri,
    position
  )) as vscode.CompletionList;

  assert.ok(actualCompletionList.items.length >= expectedCompletionList.items.length);
  expectedCompletionList.items.forEach((expectedItem, i) => {
    const actualItem = actualCompletionList.items[i];
    assert.equal(actualItem.label, expectedItem.label);
    assert.equal(actualItem.kind, expectedItem.kind);
  });
}
