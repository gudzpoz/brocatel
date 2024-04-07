function isVsGlobalDefined() {
  try {
    return acquireVsCodeApi;
  } catch (e) {
    if (e instanceof ReferenceError) {
      return false;
    }
    throw e;
  }
}

const api = isVsGlobalDefined() ? acquireVsCodeApi() : null;

export default function useVsCode() {
  return api;
}
