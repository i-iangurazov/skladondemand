export const normalizeHandle = (handle?: string | null) => {
  if (!handle) return null;
  let value = handle.trim();
  if (!value) return null;
  value = value.replace(/^\/+|\/+$/g, '');
  if (value.startsWith('collections/')) {
    value = value.slice('collections/'.length);
  }
  if (value.startsWith('collection/')) {
    value = value.slice('collection/'.length);
  }
  return value || null;
};
