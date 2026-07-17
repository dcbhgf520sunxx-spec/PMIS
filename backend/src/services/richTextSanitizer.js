const sanitizeHtml = require('sanitize-html')

const allowedTags = [
  'a', 'b', 'br', 'code', 'div', 'em', 'i', 'img', 'li', 'ol', 'p', 'pre',
  's', 'span', 'strong', 'u', 'ul'
]

function sanitizeRichText(value = '') {
  return sanitizeHtml(String(value), {
    allowedTags,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width'],
      span: ['style']
    },
    allowedSchemes: ['http', 'https'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowProtocolRelative: false,
    allowedStyles: {
      span: {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,.%]+\)$/i, /^[a-z]+$/i],
        'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,.%]+\)$/i, /^[a-z]+$/i],
        'font-weight': [/^(normal|bold|[1-9]00)$/i]
      }
    },
    transformTags: {
      a: (tagName, attributes) => {
        const href = attributes.href || ''
        if (!/^https?:\/\//i.test(href)) delete attributes.href
        return { tagName, attribs: { ...attributes, target: '_blank', rel: 'noreferrer' } }
      },
      img: (tagName, attributes) => {
        const width = Number(attributes.width)
        if (Number.isFinite(width) && width > 0) {
          attributes.width = String(Math.min(Math.max(width, 120), 960))
        } else {
          delete attributes.width
        }
        attributes.alt = attributes.alt || '图片'
        return { tagName, attribs: attributes }
      }
    },
    exclusiveFilter: (frame) => frame.tag === 'img'
      && !/^data:image\//i.test(frame.attribs.src || '')
      && !/^https?:\/\//i.test(frame.attribs.src || '')
  })
}

module.exports = { sanitizeRichText }
