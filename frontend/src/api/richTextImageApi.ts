import { request, unwrap } from './requestClient';
import { objectContract } from './responseContract';

const uploadContract = objectContract<{ url: string }>(['url']);

export function createRichTextImageUploader(modulePath: string) {
  return async function uploadRichTextImage(file: File) {
    const data = new FormData();
    data.append('file', file);
    const result = await unwrap<{ url: string }>(
      request.post(`${modulePath}/rich-text-images`, data),
      uploadContract
    );
    return result.url;
  };
}
