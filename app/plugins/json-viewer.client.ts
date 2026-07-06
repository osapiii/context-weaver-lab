/**
 * vue3-json-viewerプラグイン
 *
 * Nuxt 3でvue3-json-viewerをグローバルに登録
 * https://www.npmjs.com/package/vue3-json-viewer
 */
import JsonViewer from "vue3-json-viewer";
import "vue3-json-viewer/dist/vue3-json-viewer.css";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(JsonViewer);
});
