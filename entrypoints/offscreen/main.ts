// Chrome's offscreen document for clipboard writes (see utils/clipboard.ts).

import { browser } from '#imports';

import type { CopyMessage } from '@/utils/clipboard';

browser.runtime.onMessage.addListener((message: CopyMessage, _sender, sendResponse) => {
  if (message?.type !== 'offscreen-copy') return;

  const textarea = document.createElement('textarea');
  textarea.value = message.text;
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();

  sendResponse(copied);
});
