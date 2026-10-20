export function slugifyModelName(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '-');
}
