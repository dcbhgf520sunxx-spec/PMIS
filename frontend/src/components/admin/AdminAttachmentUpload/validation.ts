export type AttachmentValidationOptions = {
  accept?: string;
  maxSize?: number;
};

function matchesAcceptToken(file: File, token: string) {
  const normalized = token.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith('.')) return file.name.toLowerCase().endsWith(normalized);
  if (normalized.endsWith('/*')) return file.type.toLowerCase().startsWith(normalized.slice(0, -1));
  return file.type.toLowerCase() === normalized;
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
