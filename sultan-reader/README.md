# 苏丹的游戏剧情阅读器

本目录是桌面端阅读器工程，当前提供：

- 启动页配置游戏目录、资源目录、缓存目录
- 进入主阅读界面查看幕后、仪式与相关分支
- 启动页右上角可直接打开 GitHub 页面
- 启动页右上角可弹出捐赠二维码图片

## 常用命令

```bash
npm run dev
npm run pack:win
```

## 打包说明

`npm run pack:win` 会先构建前端，再使用 `electron-builder` 输出 Windows 目录版程序，产物目录为 `release/win-unpacked/`。

直接运行下面这个文件即可：

```text
release/win-unpacked/SultanReader.exe
```

之所以默认不再生成单文件便携版，是因为它的 NSIS 外层壳在部分 Windows 环境里容易被安全软件误报。

## 说明

- GitHub 链接会通过系统默认浏览器打开
- 捐赠图片已打包进应用内，不依赖外部路径
