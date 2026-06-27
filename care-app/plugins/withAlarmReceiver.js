// care-app/plugins/withAlarmReceiver.js
// config-plugin: Android BroadcastReceiver + HeadlessJsTaskService 주입
// BOOT_COMPLETED / TIME_SET / TIMEZONE_CHANGED 수신 → AlarmResync HeadlessJS 태스크 실행.
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const RECEIVER_KT = `package com.shawn777.careapp
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService

class AlarmBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    try {
      val service = Intent(context, AlarmResyncService::class.java)
      context.startService(service)
      HeadlessJsTaskService.acquireWakeLockNow(context)
    } catch (e: Exception) {
      // Android 8+ 백그라운드 startService 제한 등으로 실패 가능.
      // 앱 실행 시 resyncAllAlarms 폴백이 있으므로 크래시만 막고 조용히 실패.
      android.util.Log.w("AlarmBootReceiver", "resync start failed: \${e.message}")
    }
  }
}
`;

const SERVICE_KT = `package com.shawn777.careapp
import android.content.Intent
import android.os.Bundle
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class AlarmResyncService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent): HeadlessJsTaskConfig {
    return HeadlessJsTaskConfig("AlarmResync", Bundle(), 30000, true)
  }
}
`;

module.exports = function withAlarmReceiver(config) {
  // 1) 네이티브 소스 파일 작성 (Kotlin)
  config = withDangerousMod(config, ["android", async (cfg) => {
    const pkgDir = path.join(cfg.modRequest.platformProjectRoot, "app/src/main/java/com/shawn777/careapp");
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, "AlarmBootReceiver.kt"), RECEIVER_KT);
    fs.writeFileSync(path.join(pkgDir, "AlarmResyncService.kt"), SERVICE_KT);
    return cfg;
  }]);

  // 2) AndroidManifest.xml: 권한 + 리시버 + 서비스 추가
  config = withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    const manifest = cfg.modResults.manifest;

    // RECEIVE_BOOT_COMPLETED 권한 (중복 방지)
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    if (!manifest["uses-permission"].some((p) => p.$["android:name"] === "android.permission.RECEIVE_BOOT_COMPLETED")) {
      manifest["uses-permission"].push({ $: { "android:name": "android.permission.RECEIVE_BOOT_COMPLETED" } });
    }

    // AlarmResyncService (HeadlessJsTaskService 구현체) — 중복 방지
    app.service = app.service || [];
    if (!app.service.some((s) => s.$["android:name"] === ".AlarmResyncService")) {
      app.service.push({ $: { "android:name": ".AlarmResyncService", "android:exported": "false" } });
    }

    // AlarmBootReceiver (BOOT/TIME/TIMEZONE/DATE intent 수신) — 중복 방지
    app.receiver = app.receiver || [];
    if (!app.receiver.some((r) => r.$["android:name"] === ".AlarmBootReceiver")) {
      app.receiver.push({
        $: { "android:name": ".AlarmBootReceiver", "android:exported": "true" },
        "intent-filter": [{
          action: [
            { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
            { $: { "android:name": "android.intent.action.QUICKBOOT_POWERON" } },
            { $: { "android:name": "android.intent.action.TIME_SET" } },
            { $: { "android:name": "android.intent.action.TIMEZONE_CHANGED" } },
            { $: { "android:name": "android.intent.action.DATE_CHANGED" } },
          ],
        }],
      });
    }

    return cfg;
  });

  return config;
};
