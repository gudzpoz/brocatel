declare module 'fengari';
declare module 'fengari-interop';
declare module 'remark-join-cjk-lines';

declare module '*.lua?raw' {
  const content: string;
  export default content;
}
