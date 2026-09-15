declare const __BUILD_TIME__: string;

/** Small on-screen build stamp so a stale cached bundle is visible on device. */
export const BUILD_LABEL = (() => {
  const date = new Date(
    typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : NaN,
  );
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `Build ${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
  );
})();
