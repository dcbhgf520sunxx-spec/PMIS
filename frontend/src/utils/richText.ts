const allowedTags = new Set([
  'A',
  'B',
  'BR',
  'CODE',
  'DIV',
  'EM',
  'I',
  'IMG',
  'LI',
  'OL',
  'P',
  'PRE',
  'S',
  'SPAN',
  'STRONG',
  'U',
  'UL'
]);

const allowedAttributes: Record<string, Set<string>> = {
  A: new Set(['href', 'target', 'rel']),
  IMG: new Set(['src', 'alt', 'width']),
  SPAN: new Set(['style'])
};

export function plainTextToHtml(text = '') {
  const container = document.createElement('div');
  container.textContent = text;
  return container.innerHTML.replace(/\n/g, '<br>');
}

export function sanitizeRichText(html = '') {
  if (!html) {
    return '';
  }

  const template = document.createElement('template');
  template.innerHTML = html;

  const sanitizeNode = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as HTMLElement;
    const tag = element.tagName;

    if (!allowedTags.has(tag)) {
      const children = Array.from(element.childNodes);
      element.replaceWith(...children);
      children.forEach(sanitizeNode);
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const allowed = allowedAttributes[tag]?.has(attribute.name);
      if (!allowed) {
        element.removeAttribute(attribute.name);
      }
    });

    if (tag === 'A') {
      const href = element.getAttribute('href') || '';
      if (!/^https?:\/\//i.test(href)) {
        element.removeAttribute('href');
      }
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noreferrer');
    }

    if (tag === 'IMG') {
      const src = element.getAttribute('src') || '';
      if (!/^data:image\//i.test(src) && !/^https?:\/\//i.test(src)) {
        element.remove();
        return;
      }
      const width = Number(element.getAttribute('width'));
      if (Number.isFinite(width) && width > 0) {
        element.setAttribute('width', String(Math.min(Math.max(width, 120), 960)));
      } else {
        element.removeAttribute('width');
      }
      element.setAttribute('alt', element.getAttribute('alt') || '图片');
    }

    if (tag === 'SPAN') {
      const style = element.getAttribute('style') || '';
      const safeStyle = style
        .split(';')
        .map((item) => item.trim())
        .filter((item) => /^(color|background-color|font-weight):/i.test(item))
        .join('; ');
      if (safeStyle) {
        element.setAttribute('style', safeStyle);
      } else {
        element.removeAttribute('style');
      }
    }

    Array.from(element.childNodes).forEach(sanitizeNode);
  };

  Array.from(template.content.childNodes).forEach(sanitizeNode);
  return template.innerHTML;
}

export function richTextToSummary(html = '') {
  if (!html) {
    return '';
  }

  const template = document.createElement('template');
  template.innerHTML = sanitizeRichText(html);
  const text = template.content.textContent?.replace(/\s+/g, ' ').trim() || '';
  const imageCount = template.content.querySelectorAll('img').length;
  if (imageCount > 0) {
    return text ? `${text} 〔图片〕` : '〔图片〕';
  }

  return text;
}

export function openRichTextImagePreview(src: string) {
  if (!src) {
    return;
  }

  const preview = window.open('', '_blank', 'noopener,noreferrer');
  if (!preview) {
    return;
  }

  preview.document.write(`
    <html>
      <head>
        <title>图片预览</title>
        <style>
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f172a; }
          img { max-width: 96vw; max-height: 96vh; object-fit: contain; background: #fff; }
        </style>
      </head>
      <body><img src="${src}" alt="图片预览" /></body>
    </html>
  `);
  preview.document.close();
}
