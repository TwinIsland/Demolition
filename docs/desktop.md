# Desktop build

The game can be packaged as a native desktop app with [Tauri 2](https://tauri.app). Tauri wraps the same static web build in the operating system's own web view (WebView2 on Windows, WKWebView on macOS), so the installer stays a few megabytes plus the game assets and no browser engine is shipped.

The desktop shell lives in `src-tauri/`. It opens one window and exposes no native commands. The web build and the GitHub Pages deployment do not depend on it.

## What to install

| Platform | Needed |
| --- | --- |
| Both | Node.js 22 and `npm install` in the repository; the [Rust toolchain](https://rustup.rs) (stable) |
| Windows | Microsoft C++ Build Tools ("Desktop development with C++"). WebView2 is part of Windows 10 (1803 and later) and Windows 11; on older systems the installer downloads it |
| macOS | Xcode Command Line Tools: `xcode-select --install` |

## Commands

```sh
npm run dev:desktop     # the game in a native window, with Vite hot reload
npm run build:desktop   # release build and installers
```

`build:desktop` runs the type check and `vite build` into `.desktop-build/`, compiles the shell and bundles it. Output is under `src-tauri/target/release/bundle/`:

| Built on | Output |
| --- | --- |
| Windows | `nsis/Demolition_1.0.0_x64-setup.exe` and `msi/Demolition_1.0.0_x64_en-US.msi`; the bare program is `src-tauri/target/release/demolition.exe` |
| macOS | `macos/Demolition.app` and `dmg/Demolition_1.0.0_aarch64.dmg` (or `x64` on Intel) |

Each platform is built on that platform: Tauri does not cross-compile a Windows installer from macOS. Pushing a version tag (`git tag v1.0.1 && git push origin v1.0.1`) runs `.github/workflows/release-desktop.yml`, which builds both on GitHub Actions and attaches the installers to a GitHub Release. For a universal macOS app, run `rustup target add x86_64-apple-darwin` once and then `npm run build:desktop -- --target universal-apple-darwin`.

The first build downloads and compiles the Rust dependencies and takes several minutes; later builds take well under a minute.

## Notes

- The app is unsigned. Windows SmartScreen and macOS Gatekeeper warn on first launch; on macOS, right-click the app and choose Open. Signing needs a certificate, see the [Tauri distribution guide](https://tauri.app/distribute/).
- Icons in `src-tauri/icons/` are generated from `public/favicon.svg` with `npx tauri icon <1024px png>`.
- Window size, title and the app identifier are in `src-tauri/tauri.conf.json`. Keep `version` there and in `src-tauri/Cargo.toml` in step with `package.json`.
- Settings and saved skins use the web view's local storage, so they are separate from the browser version.
