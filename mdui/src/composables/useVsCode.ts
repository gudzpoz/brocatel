const api = acquireVsCodeApi ? acquireVsCodeApi() : null;

export default function useVsCode() {
  return api;
}
