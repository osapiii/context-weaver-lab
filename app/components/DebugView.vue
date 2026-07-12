<template>
  <v-container fluid style="background-color: #0c0f36">
    <v-expansion-panels>
      <v-expansion-panel>
        <v-expansion-panel-title>
          <p class="font-weight-bold">設定情報を確認する</p>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-container fluid>
            <v-row
              v-for="(debugInfoList, key) in debugInfo.debugInfoForView"
              :key="key"
            >
              <p class="font-weight-bold">デバッグ情報 for {{ key }}</p>
              <v-divider />
              <!-- 現在の診断ロジック(state) | getSelectedContentItem -->
              <v-col
                v-for="debugItem in debugInfoList"
                :key="debugItem.key"
                cols="4"
              >
                <div>
                  <p class="font-weight-bold text-caption">
                    {{ debugItem.textLabel }} | {{ debugItem.key }}
                  </p>
                  <json-viewer
                    :value="debugItem.value"
                    :expand-depth="1"
                    copyable
                    boxed
                    sort
                  />
                </div>
              </v-col> </v-row
          ></v-container>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-container>
</template>

<script setup lang="ts">
const debugInfo = useDebugInfoStore();
</script>
