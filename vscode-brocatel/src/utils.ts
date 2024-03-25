export type TextLine = {
  text: string;
  tags: true | Record<string, string>;
};

export type SelectLine = {
  select: {
    key: number;
    option: TextLine;
  }[];
};

export type StoryLine = TextLine | SelectLine;

export function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log('vscode-brocatel:', ...args);
}

export function error(...args: any[]) {
  // eslint-disable-next-line no-console
  console.error('vscode-brocatel:', ...args);
}
