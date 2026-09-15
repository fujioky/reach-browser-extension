// Clipboard writes from the background, where the share finishes.
//
// Firefox runs the background as an event page, which has a document and — with
// the clipboardWrite permission — may write without a user gesture. Chrome's
// service worker has no navigator.clipboard at all, so the text goes to an
// offscreen document; that document can never be focused, which rules out the
// async Clipboard API there too, leaving execCommand('copy').

import { browser } from '#imports';

export interface CopyMessage {
  type: 'offscreen-copy';
  text: string;
}

let queue: Promise<unknown> = Promise.resolve();

/** Resolves true when the text reached the clipboard. Copies run one at a time. */
export function copyToClipboard(text: string): Promise<boolean> {
  const run = queue.then(() => write(text)).catch(() => false);
  queue = run;
  return run;
}

async function write(text: string): Promise<boolean> {
  if (import.meta.env.FIREFOX) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  if (!(await browser.offscreen.hasDocument())) {
    await browser.offscreen.createDocument({
      url: '/offscreen.html',
      reasons: ['CLIPBOARD'],
      justification: 'Copy the share link Reach just created',
    });
  }
  const message: CopyMessage = { type: 'offscreen-copy', text };
  return (await browser.runtime.sendMessage(message)) === true;
}
