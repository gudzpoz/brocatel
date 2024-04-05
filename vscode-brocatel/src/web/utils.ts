export function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log('vscode-brocatel:', ...args);
}

export function error(...args: any[]) {
  // eslint-disable-next-line no-console
  console.error('vscode-brocatel:', ...args);
}
