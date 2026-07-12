import { defineStore } from "pinia";
import { datadogRum } from "@datadog/browser-rum";
import { datadogLogs } from "@datadog/browser-logs";
import log from "@utils/logger";

export const useDatadogStore = defineStore("datadog", {
  actions: {
    initializeDatadog(params: {
      userInfo: {
        userId: string;
        email: string;
        organizationId: string;
        organizationName: string;
        answerUserGroupId: string;
        contentType: string;
        contentId: string;
      };
    }) {
      const runtimeConfig = useRuntimeConfig();
      // Datadogの初期化
      datadogRum.init({
        applicationId: runtimeConfig.public.datadog.applicationId,
        clientToken: runtimeConfig.public.datadog.clientToken,
        site: runtimeConfig.public.datadog.site || "ap1.datadoghq.com",
        service:
          runtimeConfig.public.datadog.service || "storyvault-frontend",
        sessionSampleRate: 100,
        sessionReplaySampleRate: 100,
        trackResources: true,
        trackLongTasks: true,
        trackUserInteractions: true,
        enablePrivacyForActionName: false,
      });
      log("INFO", "DatadogRUM initialized🔥");
      // ユーザーのセットアップ
      datadogRum.setUser(params.userInfo);
      log("INFO", "Datadog UserInfo initialized", params.userInfo);
    },
    startCaptureSynthetics(
      userId: string,
      organizationId: string,
      organizationName: string,
      loggedInUserEmail: string,
      answerUserGroupId: string,
      answerUserGroupName: string,
      answerUserEmail: string
    ) {
      datadogRum.startSessionReplayRecording();
      datadogRum.setUser({
        id: userId,
        email: loggedInUserEmail,
        organization: {
          id: organizationId,
          name: organizationName,
        },
        answerUserGroup: {
          id: answerUserGroupId,
          name: answerUserGroupName,
          email: answerUserEmail,
        },
      });
    },
  },
});
