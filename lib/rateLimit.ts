const requestStore = new Map<string, number[]>();

export function isRateLimited(key: string, maxRequests: number, windowMs: number) {
  const now = Date.now();
  const timestamps = requestStore.get(key) ?? [];
  const valid = timestamps.filter((timestamp) => now - timestamp < windowMs);

  if (valid.length >= maxRequests) {
    requestStore.set(key, valid);
    return true;
  }

  valid.push(now);
  requestStore.set(key, valid);
  return false;
}
