function normalizeEarTag(value) {
  if (!value) return value;

  return String(value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

module.exports = normalizeEarTag;

