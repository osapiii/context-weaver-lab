/**
 * Google Drive Cloud Run microservices (storyvault-dev / us-central1).
 *
 * Workflows architecture (post drive-sync-workflows-architecture plan):
 *   - drive-to-gcs-sync: Drive → GCS mirror + 動作確認 / プレビュー
 *     • POST /scan/test-connection
 *     • POST /scan/list-folder
 *     • POST /mirror/diff
 *     • POST /mirror/apply-batch
 *     • POST /mirror/remove-batch
 *   - gcs-to-filespace-register: GCS mirror → FileSpace 登録 (Workflows 専用)
 *   - google-drive-workflow-kicker: trigger → Workflows execution
 *
 * 旧 google-drive-sync / google-drive-scan サービスは廃止 (Workflows へ移行).
 * 再デプロイで URL が変わった場合は backend/microservice/driveToGcsSync/deploy.sh
 * の出力でここだけ更新する。
 */

/**
 * Drive → GCS Sync microservice. FE から呼ぶ `/scan/*` 系 (動作確認 / 列挙) を
 * このサービスから直接叩く。`/mirror/*` 系は Workflows のみが叩く。
 */
export const DRIVE_TO_GCS_SYNC_SERVICE_URL =
  "https://drive-to-gcs-sync-mdgjayj74q-uc.a.run.app";

/**
 * Google Drive Workflow Kicker. 通常は Firebase Functions trigger からのみ叩く
 * (`/kick`) が、UI からは debug 用に `/inspect-input` を叩いて Workflows の
 * input artifact (GCS YAML) を取得する。
 */
export const GOOGLE_DRIVE_WORKFLOW_KICKER_URL =
  "https://google-drive-workflow-kicker-mdgjayj74q-uc.a.run.app";
