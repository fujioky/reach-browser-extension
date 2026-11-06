# Reach 扩展 1.2.0 验证

同一个安装包按解析后的 URL 主机名选择认证：`fujioky.com` 及其子域名使用 HTTPS 网页授权；其他地址保留自部署账号密码。没有生产版/演示版构建分叉，也没有手填授权码。

## 验证

- 69 项单元测试通过，`unit-tests.json` 保存完整结果；包括主机名仿冒、URL 用户信息/控制字符、HTTP 拒绝、PKCE、取消、拒绝及重试。
- TypeScript 检查、Chrome/Edge 与 Firefox 构建、压缩包生成通过。
- 使用真实 Chromium 150、独立浏览器配置加载未打包扩展；实际设置页、切换域名、无密码的 FUJIOKY 登录、原有自部署登录、返回设置和账户中心管理入口通过。`browser-ui.json` 与三张截图记录结果。
- 浏览器 UI 的成功回调使用隔离测试夹具；真实 Logto、VIP、设备/中央撤销的生产验收由 Reach 后端报告记录，不把模拟回调冒充真实授权。
- Firefox 同一代码已构建；尚未做 Firefox 实机验证或 AMO 签名。

Firefox 的声明增加 `authenticationInfo`，覆盖账号密码和设备令牌传输。依据 [Mozilla 官方数据类型说明](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)；保留原有 `browsingActivity`，没有增加站点读取权限。

## 管理边界

- 扩展设置中的退出：撤销本设备令牌并清除本机登录状态。
- Reach 后台/工作区：查看和撤销自己的单台设备。
- FUJIOKY 账户中心“会话与授权”：独立「Reach 浏览器扩展」应用，撤销后关联设备均不能继续访问，网页会话不受影响。
- 旧版手填授权码不再继续用于 FUJIOKY，需要通过新版扩展重新登录。
