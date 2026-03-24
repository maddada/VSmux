# Bundled zellij

These binaries are downloaded from the official `zellij-org/zellij` release assets.

Release: v0.44.0
Assets:
- darwin-arm64: zellij-no-web-aarch64-apple-darwin.tar.gz
- darwin-x64: zellij-no-web-x86_64-apple-darwin.tar.gz
- linux-arm64: zellij-no-web-aarch64-unknown-linux-musl.tar.gz
- linux-x64: zellij-no-web-x86_64-unknown-linux-musl.tar.gz
- win32-x64: zellij-no-web-x86_64-pc-windows-msvc.zip

Rebuild with:
node ./scripts/rebuild-bundled-zellij.mjs v0.44.0
