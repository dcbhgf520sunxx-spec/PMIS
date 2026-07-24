export type AttachmentValidationOptions = {
  accept?: string;
  maxSize?: number;
};

export const ADMIN_ATTACHMENT_IMAGE_FORMATS = [
  'JPG',
  'JPEG',
  'PNG',
  'GIF',
  'WEBP',
  'BMP',
  'SVG',
  'AVIF',
  'HEIC'
] as const;

const IMAGE_EXTENSION_MIME_TYPES: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  heic: 'image/heic',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp'
};

const IMAGE_MIME_TYPE_ALIASES: Record<string, string> = {
  'image/pjpeg': 'image/jpeg',
  'image/x-bmp': 'image/bmp',
  'image/x-ms-bmp': 'image/bmp',
  'image/x-png': 'image/png'
};

function normalizeMimeType(type: string) {
  const normalized = type.trim().toLowerCase();
  return IMAGE_MIME_TYPE_ALIASES[normalized] || normalized;
}

function fileImageMimeType(file: File) {
  const extension = file.name.toLowerCase().split('.').pop() || '';
  return IMAGE_EXTENSION_MIME_TYPES[extension];
}

function matchesAcceptToken(file: File, token: string) {
  const normalized = token.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith('.')) return file.name.toLowerCase().endsWith(normalized);
  const declaredType = normalizeMimeType(file.type);
  const inferredImageType = fileImageMimeType(file);
  if (normalized.endsWith('/*')) {
    const prefix = normalized.slice(0, -1);
    return declaredType.startsWith(prefix) || Boolean(inferredImageType?.startsWith(prefix));
  }
  const acceptedType = normalizeMimeType(normalized);
  return declaredType === acceptedType || inferredImageType === acceptedType;
}

export function matchesAttachmentAccept(file: File, accept?: string) {
  if (!accept) return true;
  return accept.split(',').some((token) => matchesAcceptToken(file, token));
}

export function formatAttachmentSize(size?: number) {
  if (size === undefined || !Number.isFinite(size)) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function validateAttachmentFile(file: File, options: AttachmentValidationOptions) {
  if (options.maxSize !== undefined && file.size > options.maxSize) {
    return `文件大小不能超过 ${formatAttachmentSize(options.maxSize)}`;
  }
  if (options.accept && !matchesAttachmentAccept(file, options.accept)) {
    return '不支持该文件格式';
  }
  return null;
}
