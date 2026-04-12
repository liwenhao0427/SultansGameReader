'use strict';

/**
 * Windows 打包后手动写入 exe 图标。
 * 目的：绕过 electron-builder 在当前环境下解压 winCodeSign 失败的问题，
 * 确保最终产物的主程序图标稳定使用项目内的 app-icon.ico。
 */

const fs = require('fs');
const path = require('path');
const rcedit = require('rcedit');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const exePath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.exe`,
  );
  const iconPath = path.join(__dirname, 'app-icon.ico');

  if (!fs.existsSync(exePath)) {
    throw new Error(`afterPack 未找到可执行文件：${exePath}`);
  }

  if (!fs.existsSync(iconPath)) {
    throw new Error(`afterPack 未找到图标文件：${iconPath}`);
  }

  await rcedit(exePath, {
    icon: iconPath,
  });
};
