/** A reservation leaves the site this long after its end time. */
export const RESERVATION_EXPIRY_MS = 8 * 60 * 60 * 1000;

export function reservationExpiryCutoff(now = Date.now()) {
  return new Date(now - RESERVATION_EXPIRY_MS);
}
