import { test } from './fixtures/page';
import { ProcessEditor } from './page-objects/process-editor';
import { empty, removeFromWorkspace } from './workspaces/workspace';
import { FileExplorer } from './page-objects/explorer-view';
import { linuxCondition } from './utils/skip';

test.describe('Create Project', () => {
  const projectName = 'testProject';
  const rootFolder = 'parent';

  test.beforeAll(async () => {
    removeFromWorkspace(empty, rootFolder);
  });

  test.afterAll(async () => {
    removeFromWorkspace(empty, rootFolder);
  });

  test('Add Project and execute init Process', async ({ pageFor }) => {
    test.skip(linuxCondition);
    const page = await pageFor(empty);
    const explorer = new FileExplorer(page);
    await explorer.addNestedProject(rootFolder, projectName);
    await explorer.hasDeployProjectStatusMessage();
    await explorer.hasStatusMessage('Finished: Create new Project', 60_000);
    await explorer.hasNoStatusMessage();

    const processEditor = new ProcessEditor(page, 'BusinessProcess.p.json');
    const start = processEditor.locatorForElementType('g.start\\:requestStart');
    const end = processEditor.locatorForElementType('g.end\\:taskEnd');
    await processEditor.startProcessAndAssertExecuted(start, end);
    await processEditor.closeAllTabs();
  });
});
