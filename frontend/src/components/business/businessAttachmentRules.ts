export const COMMON_ATTACHMENT_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.webp',
  '.pdf',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.md',
  '.zip',
] as const;

export const COMMON_ATTACHMENT_ACCEPT = COMMON_ATTACHMENT_EXTENSIONS.join(',');
export const COMMON_ATTACHMENT_MAX_SIZE = 20 * 1024 * 1024;
export const COMMON_ATTACHMENT_TYPE_HINT = '支持图片、PDF、Word、Excel、PPT、TXT、Markdown 和 ZIP';
