import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// Chrome / Edge build: `npm run build` → .output/chrome-mv3
// Firefox build:       `npm run build:firefox` → .output/firefox-mv3
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: false,
  manifestVersion: 3,
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: ({ browser }) => ({
    name: 'Reach 快捷分享',
    description: '在 X / YouTube 页面一键生成 Reach 分享链接',
    permissions: [
      'storage',
      'activeTab',
      'contextMenus',
      'notifications',
      'clipboardWrite',
      // Chrome's service worker has no clipboard; it copies through an
      // offscreen document. Firefox's event page can write directly.
      ...(browser === 'firefox' ? [] : ['offscreen']),
    ],
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+S' },
      },
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'reach-share@fujioky.com',
              // data_collection_permissions below needs 140.
              strict_min_version: '140.0',
              // The URL being shared is sent to the Reach server the user configures.
              data_collection_permissions: { required: ['browsingActivity'] },
            },
            gecko_android: { strict_min_version: '142.0' },
          },
        }
      : { minimum_chrome_version: '116' }),
  }),
});
