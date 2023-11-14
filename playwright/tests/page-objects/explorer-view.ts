import { Page, expect, Locator } from '@playwright/test';
import { View, ViewData } from './view';

export abstract class ExplorerView extends View {
  constructor(private viewName: string, page: Page) {
    const data: ViewData = {
      tabSelector: `div.pane-header:has-text("${viewName}")`,
      viewSelector: ''
    };
    super(data, page);
  }

  override get viewLocator(): Locator {
    return this.page.getByRole('tree', { name: this.viewName });
  }

  async isHidden(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await expect(this.tabLocator).toBeHidden();
  }

  async openView(): Promise<void> {
    if (!(await this.page.locator(`${this.data.tabSelector}.expanded`).isVisible())) {
      await this.tabLocator.click();
    }
    await expect(this.viewLocator).toBeVisible();
  }

  async closeView(): Promise<void> {
    if (await this.page.locator(`${this.data.tabSelector}.expanded`).isVisible()) {
      await this.tabLocator.click();
    }
    await expect(this.viewLocator).toBeHidden();
  }

  async hasNode(name: string): Promise<void> {
    const node = this.viewLocator.getByText(name);
    await expect(node).toBeVisible();
  }

  async hasNoNode(name: string): Promise<void> {
    const node = this.viewLocator.getByText(name);
    await expect(node).not.toBeAttached();
  }

  async clickAction(title: string): Promise<void> {
    const actionLocator = this.page.getByRole('button', { name: title, exact: true });
    await expect(actionLocator).toBeVisible();
    await actionLocator.click();
  }

  async selectNode(name: string): Promise<void> {
    await this.viewLocator.getByText(name).click();
    await this.isSelected(name);
  }

  async isSelected(name: string): Promise<void> {
    const selected = this.viewLocator.locator('.monaco-list-row.selected');
    await expect(selected).toContainText(name);
  }
}

export class ProjectExplorerView extends ExplorerView {
  constructor(page: Page) {
    super('Axon Ivy Projects', page);
  }

  async isWelcomeViewVisible(): Promise<void> {
    await expect(this.page.locator('.welcome-view-content')).toBeVisible();
  }

  async addProject(projectName: string): Promise<void> {
    await this.clickAction('Project');
    await this.provideUserInput(projectName);
    await this.provideUserInput();
    await this.provideUserInput();
    await this.provideUserInput();
  }

  async addProcess(
    projectName: string,
    processName: string,
    kind: 'Business Process' | 'Callable Sub Process' | 'Web Service Process'
  ): Promise<void> {
    await this.selectNode(projectName);
    await this.executeCommand('Ivy Project Explorer: ' + kind);
    await this.provideUserInput(processName);
  }
}

export class OutlineExplorerView extends ExplorerView {
  constructor(page: Page) {
    super('Process Outline', page);
  }

  async doubleClickExpandable(name: string): Promise<void> {
    await this.viewLocator.getByText(name).dblclick();
  }
}
