# reach-browser-extension

简体中文 · [English](./README.en.md)

[Reach](https://github.com/fujioky/reach) 的浏览器扩展（Chrome / Edge / Firefox）：在 X 帖子或 YouTube 视频页一键生成 Reach 分享链接，链接自动复制到剪贴板。不用再打开后台、粘贴链接、等抓取、再复制。

| | |
| --- | --- |
| ![弹窗](docs/screenshots/popup.png) | ![设置](docs/screenshots/options.png) |
| 弹窗：当前帖子、访问控制与密码、这条帖子的分享，其余收在历史记录里 | 设置：管理员账号登录、默认分享设置 |

## 功能

- **三种入口。** 在帖子页点扩展图标或按 `Alt+Shift+S`，弹窗已经填好当前页面，回车即可；在时间线里的帖子链接上右键「用 Reach 分享此链接」，不用打开帖子；也可以在弹窗里粘贴任意 X / YouTube 链接。
- **访问控制。** 有效期（不限 / 1 天 / 7 天 / 30 天）、最多打开次数、阅后即焚。设置页里的默认值给右键分享用，弹窗里可以逐次调整。独立访客数、精确到期时间等更细的限制，在 Reach 后台对这条链接编辑。
- **访问密码。** 可选「系统密码」（Reach 系统设置里的统一密码）或「单独密码」。和 Reach 后台一致，密码设在**镜像**上而不是单条链接上：同一条帖子已有的分享链接也会一起需要这个密码。选「不设置」不会改动镜像已有的密码；沿用的镜像本来就有密码时，结果里会提示。设了单独密码时，结果里可以一键复制密码。
- **不重复抓取。** 同一条帖子已经在 Reach 里镜像过，就直接在那份镜像上新建一条分享链接：秒回，也不会再存一份图片。要更新内容，到后台对那份镜像「重新抓取」。
- **历史记录。** 分享记录保存在扩展本地（重启浏览器也在）。弹窗里先显示输入框中这条帖子最近的分享——默认就是当前页面，x.com / twitter.com、youtu.be / watch 等不同写法都能认出来；其余分享收在「历史记录」里，点开查看，可以清空。
- **后台完成。** 抓取一条新帖子可能要几十秒。弹窗随时可以关，分享在扩展后台继续跑，工具栏图标显示进行中的数量；完成后复制链接，弹窗没开着就发一条系统通知（点通知打开后台的镜像详情页）。

## 前提

需要 Reach 部署了扩展接口（`/api/extension/*`，见下文），并且跑过对应的数据库迁移（`api_tokens` 表）。

## 安装

扩展没有上架商店，需要自行构建。要求 Node.js 22+。

```bash
git clone https://github.com/fujioky/reach-browser-extension.git
cd reach-browser-extension
npm install
npm run build            # Chrome / Edge → .output/chrome-mv3
npm run build:firefox    # Firefox       → .output/firefox-mv3
```

- **Chrome / Edge：** 打开 `chrome://extensions`（Edge 为 `edge://extensions`），打开「开发者模式」，「加载已解压的扩展程序」，选择 `.output/chrome-mv3`。
- **Firefox：** 正式版 Firefox 只能安装签过名的扩展。`npm run zip:firefox` 打出 zip，到 [addons.mozilla.org](https://addons.mozilla.org/developers/) 以「不公开（自行分发）」提交签名后安装。只是试用的话，可以在 `about:debugging` →「此 Firefox」→「临时载入附加组件」选择 `.output/firefox-mv3/manifest.json`，重启浏览器后失效。

## 登录

打开扩展设置（弹窗右上角齿轮），填入 Reach 地址和管理员账号密码。

密码只用这一次：Reach 验证通过后签发一个这个浏览器专用的令牌，扩展只保存令牌（`storage.local`，不随浏览器账号同步）。Reach 后台「系统 → 浏览器扩展」列出所有登录过的扩展及最近使用时间，可以逐个撤销；扩展里「退出登录」也会同时作废服务端的令牌。令牌被撤销后，下一次分享会提示重新登录。

## 工作方式

- **分享在后台跑，弹窗只负责显示。** 弹窗一失去焦点就会被浏览器关掉，没法承载要等几十秒的请求。弹窗和右键菜单只把链接交给后台（Chrome 的 service worker / Firefox 的 event page），任务状态写进分享历史（`storage.local`），弹窗订阅它来渲染。后台重启时仍标记为「进行中」的任务一定已经中断，会被标成失败并提示重试。
- **接口流式返回。** `POST /api/extension/share` 以 NDJSON 返回：抓取、转存图片、生成链接各阶段一行，最后一行 `done`。Chrome 会终止一个 30 秒内收不到 fetch 响应的扩展 service worker，而新帖子的抓取经常超过 30 秒；流式响应让响应头立即返回。没有 `done` 就结束的流按失败处理（函数超时就是这个样子）。
- **保活。** 有任务进行时，后台每 20 秒写一次 `storage.session`：Chrome 在任何扩展 API 调用时重置空闲计时，Firefox 在收到扩展事件（这次写入触发的 `storage.onChanged`）时重置。实测去掉这一步，70 秒的分享会在中途被 Chrome 终止。
- **剪贴板。** Chrome 的 service worker 没有 `navigator.clipboard`，文本交给一个 offscreen document 用 `execCommand('copy')` 写入（offscreen document 无法获得焦点，异步剪贴板 API 在那里也不可用）。Firefox 的 event page 有 DOM，凭 `clipboardWrite` 权限直接写。
- **跨域。** 扩展不申请 Reach 站点的主机权限，接口对所有来源开放 CORS。这是安全的，因为这些接口从不读取 Cookie：请求要么带令牌，要么（登录时）带密码本身。

## 权限

| 权限 | 用途 |
| --- | --- |
| `activeTab` | 点图标或按快捷键时读取当前标签页的地址，用来预填弹窗 |
| `contextMenus` | 帖子链接和帖子页上的右键菜单 |
| `storage` | 登录信息、默认设置、分享历史 |
| `clipboardWrite` | 自动复制分享链接 |
| `notifications` | 弹窗关闭时通知分享结果 |
| `offscreen`（仅 Chrome） | 在 service worker 之外写剪贴板 |

扩展不收集任何数据：只把你要分享的链接（以及登录时的账号密码）发给你自己填写的 Reach 地址，不访问其他服务。

## 接口

扩展只调用 Reach 的以下接口，实现见 Reach 仓库 `app/api/extension/`。

```
POST   /api/extension/session   { username, password, name }  → { token, username }
GET    /api/extension/session   Authorization: Bearer <token>  → { username }
DELETE /api/extension/session   Authorization: Bearer <token>  → 204（撤销该令牌）
POST   /api/extension/share     Authorization: Bearer <token>
       { url, accessControl: { expiresAt, maxViews, burnAfterRead },
         password?: { mode: "inherit" } | { mode: "custom", value } }
       → NDJSON：
         {"type":"stage","phase":"fetching"}
         {"type":"stage","phase":"images","done":0,"total":2}
         {"type":"stage","phase":"saving"}
         {"type":"done","ok":true,"shareUrl":"…","adminUrl":"…","title":"…","reused":false,"fetchedAt":"…","passwordMode":"custom","warnings":[]}
       或 {"type":"done","ok":false,"error":"内容不存在或已删除"}
```

`password` 写到这条帖子的镜像上（影响它的所有链接），不传则保持镜像原有设置；`passwordMode` 是分享后镜像的密码状态。未设置系统密码时 `inherit` 会被拒绝。令牌失效时各接口返回 401，扩展据此退出登录。

## 开发

基于 [WXT](https://wxt.dev) + React + Tailwind CSS 4。

```bash
npm run dev             # 带热更新启动一个装好扩展的 Chrome
npm run dev:firefox
npm test                # Vitest（WXT 的 fake-browser）
npm run typecheck
npm run zip             # 打包 Chrome 版 zip
npm run zip:firefox     # Firefox 版 zip + 源码 zip（AMO 审核需要）
```

```
entrypoints/
  background.ts       分享任务、右键菜单、通知、保活
  popup/              弹窗
  options/            设置页（登录、默认分享设置）
  offscreen/          Chrome 专用：写剪贴板
utils/
  api.ts              Reach 接口客户端（含 NDJSON 读取）
  jobs.ts             分享历史、帖子链接识别、可分享页面的匹配规则
  access.ts           访问控制预设与访问密码
  settings.ts         登录信息与默认设置
  clipboard.ts        后台写剪贴板（Chrome / Firefox 两条路径）
components/           弹窗与设置页共用的组件
```
