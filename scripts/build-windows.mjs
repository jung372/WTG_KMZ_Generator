import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build, Platform, Arch } from 'electron-builder';
// NSIS normally executes a temporary bootstrap EXE to write its uninstaller.
// Use electron-builder's own binary reader instead, so building never runs that EXE.
// This is the same extraction path used by upstream on macOS; no security settings are changed.
const require = createRequire(import.meta.url);
const builderVersion = require('electron-builder/package.json').version;
if (builderVersion !== '26.18.0') throw new Error('Revalidate NSIS extraction adapter before changing electron-builder version.');
const { WineVmManager } = require('app-builder-lib/out/vm/WineVm.js');
const { UninstallerReader } = require('app-builder-lib/out/targets/nsis/nsisUtil.js');
const originalExec = WineVmManager.prototype.exec;
const version = require('../package.json').version;
const expected = resolve(`program/WTG-KMZ-Generator-Setup-${version}-x64.exe`);
WineVmManager.prototype.exec = async function (file, args, options, log) {
  if (process.platform === 'win32' && resolve(file) === expected && (!args || args.length === 0)) {
    await UninstallerReader.exec(file, file.slice(0, -3) + '__uninstaller.exe');
    console.log('  • extracted NSIS uninstaller without executing build bootstrap');
    return '';
  }
  return originalExec.call(this, file, args, options, log);
};
try { await build({ targets: Platform.WINDOWS.createTarget(['nsis', 'portable'], Arch.x64), config: 'electron-builder.yml', publish: 'never', prepackaged: process.argv.includes('--prepackaged') ? resolve('program/win-unpacked') : undefined }); }
finally { WineVmManager.prototype.exec = originalExec; }
