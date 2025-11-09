const DEV_QUERY_KEYS = ['dev', 'debug'];

const queryHasDevFlag = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  return DEV_QUERY_KEYS.some((key) => params.has(key));
};

const envHasDevFlag = (): boolean => {
  if (typeof import.meta === 'undefined' || typeof import.meta.env === 'undefined') {
    return false;
  }
  const flag = (import.meta.env.VITE_DEV_MODE ?? import.meta.env.DEV_MODE ?? '').toString();
  if (!flag) {
    return false;
  }
  return flag.toLowerCase() === 'true';
};

export const isDevModeEnabled = (): boolean => envHasDevFlag() || queryHasDevFlag();
