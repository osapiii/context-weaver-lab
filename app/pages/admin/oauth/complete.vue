<template>
  <div>
    連携が完了しました。このウィンドウを閉じて、アプリケーションに戻ってください。
  </div>
</template>

<script lang="ts" setup>
import log from "@utils/logger";

//#region store
const slackIntegration = useSlackIntegrationStore();
//#endregion store

onMounted(async () => {
  const route = useRoute();
  const code = route.query.code;
  const organizationId = route.query.state;
  log("INFO", `mounted with code: ${code} and organization: ${organizationId}`);
  // 一時コードを使用してアクセストークンを取得

  // アクセストークンの取得
  const accessToken =
    await slackIntegration.exchangeTmpCodeWithSlackAccessToken({
      code: code,
      clientId: "3288876322150.7589385494418",
      clientSecret: "08e50ab2667cb9cc284c577ca38980d9",
      redirectUri: "https://localhost:3000/admin/oauth/complete",
    });
  // アクセストークンの保存
  await slackIntegration.syncSlackIntegrationToFirestore({
    organizationId: organizationId,
    accessToken: accessToken,
  });
});
</script>
<style scoped></style>
