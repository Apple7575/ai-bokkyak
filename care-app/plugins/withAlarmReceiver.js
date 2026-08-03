// care-app/plugins/withAlarmReceiver.js
// config-plugin: Android BroadcastReceiver + HeadlessJsTaskService 주입
// BOOT_COMPLETED / TIME_SET / TIMEZONE_CHANGED 수신 → AlarmResync HeadlessJS 태스크 실행.
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Kotlin 파일의 package 선언은 앱의 android.package와 반드시 같아야 한다.
// 매니페스트에 `.AlarmBootReceiver`(상대 이름)로 등록하므로 android.package 기준으로
// 클래스를 찾는다. 하드코딩하면 패키지명을 바꾼 순간 부팅 시 ClassNotFoundException.
const receiverKt = (pkg) => `package ${pkg}
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

const serviceKt = (pkg) => `package ${pkg}
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class AlarmResyncService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    return HeadlessJsTaskConfig("AlarmResync", Arguments.createMap(), 30000, true)
  }
}
`;

module.exports = function withAlarmReceiver(config) {
  // 1) 네이티브 소스 파일 작성 (Kotlin) — 경로·package 모두 android.package 기준
  config = withDangerousMod(config, ["android", async (cfg) => {
    const pkg = cfg.android?.package;
    if (!pkg) throw new Error("withAlarmReceiver: app.json의 android.package가 필요합니다.");
    const pkgDir = path.join(
      cfg.modRequest.platformProjectRoot,
      "app/src/main/java",
      ...pkg.split(".")
    );
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, "AlarmBootReceiver.kt"), receiverKt(pkg));
    fs.writeFileSync(path.join(pkgDir, "AlarmResyncService.kt"), serviceKt(pkg));
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

    // 풀스크린 알람이 잠금/꺼진 화면에서도 화면을 켜고 잠금화면 위에 뜨도록
    // MainActivity에 showWhenLocked + turnScreenOn 속성 부여(API 27+).
    app.activity = app.activity || [];
    const mainAct = app.activity.find((a) => a.$["android:name"] === ".MainActivity");
    if (mainAct) {
      mainAct.$["android:showWhenLocked"] = "true";
      mainAct.$["android:turnScreenOn"] = "true";
    }

    return cfg;
  });

  return config;
};
