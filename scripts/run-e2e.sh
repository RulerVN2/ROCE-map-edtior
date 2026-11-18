#!/bin/sh
# Chạy thử toàn bộ chương trình dưới màn hình ảo rồi đọc lại world bằng thư viện độc lập.
set -e
cd "$(dirname "$0")/.."
rm -rf out/e2e out/e2e-saves && mkdir -p out/e2e-saves out/e2e/structures && cp test/fixtures/hut.schem out/e2e/structures/
MMB_TEST_SCRIPT=scripts/e2e.js MMB_TEST_PROJECT=$PWD/out/e2e/test.mcmap MMB_TEST_SCHEM_DIR=$PWD/out/e2e/structures MMB_TEST_JAR=$PWD/test/fixtures/fake-mc.jar \
MMB_TEST_EXPORT_DIR=$PWD/out/e2e-saves MMB_TEST_OUT=out/e2e \
  timeout 300 xvfb-run -a -s "-screen 0 1400x900x24" npx electron . --no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader 2>&1 \
  | grep -v -E "dbus|NODE_OPTION|deprecated|^$" || true
test -f out/e2e/probe.json || { echo "E2E THẤT BẠI"; exit 1; }
python3 scripts/verify-export.py out/e2e/probe.json
