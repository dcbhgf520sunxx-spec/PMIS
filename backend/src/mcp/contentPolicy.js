const sanitizeHtml = require('sanitize-html')

const RICH_TEXT_FIELDS = new Set([
  'description',
  'problem_desc',
  'result_desc',
  'old_value',
  'new_value',
])

function replaceInlineImages(value, replacement = '〔图片尚未迁移〕') {
  return String(value || '').replace(
    /<img\b[^>]*\bsrc\s*=\s*(["'])data:image\/[^"']+\1[^>]*>/gi,
    replacement
  )
}

function summarizeRichText(value) {
  const source = replaceInlineImages(value, '<img alt="图片">')
  const imageCount = (source.match(/<img\b/gi) || []).length
  const text = sanitizeHtml(source, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim()
  return imageCount > 0
    ? `${text ? `${text} ` : ''}〔图片〕`
    : text
}

function normalizeString(value, field, summary) {
  if (summary && (RICH_TEXT_FIELDS.has(field) || /<[^>]+>/.test(value))) {
    return summarizeRichText(value)
  }
  return replaceInlineImages(value)
}

function normalizeMcpQueryContent(value, { summary = false } = {}, field = '') {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeMcpQueryContent(item, { summary }, field))
  }
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? normalizeString(value, field, summary) : value
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    normalizeMcpQueryContent(item, { summary }, key),
  ]))
}

module.exports = {
  normalizeMcpQueryContent,
  replaceInlineImages,
  summarizeRichText,
}
