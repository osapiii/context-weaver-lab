import log from "@utils/logger";
import { ZodError } from "zod";
import type { NodeProps } from "@vue-flow/core";
import { vueFlowNodeZodObject } from "@models/vueFlow";
import {
  editTargetNodeType,
  vueFlowController,
  selectedVueFlowNode,
  editModalIsOpen,
} from "./DiagnosisAnswerPageConfig.vue";

//#endregion ui-config
//#region method
export const openNodeEditModal = (params: {
  nodeType: "questionnaire" | "section" | "welcome" | "profile" | "logicRule";
  targetNode: NodeProps;
}) => {
  log("INFO", "openNodeEditModal triggered! 🔥");
  const globalError = useGlobalErrorStore();
  try {
    log("INFO", "openNodeEditModal params is...", params);
    // モーダルのNodeタイプを設定
    editTargetNodeType.value = params.nodeType;
    // クリックされたNodeのIDを取得
    const selectedNodeId = params.targetNode.id;
    // id=selectedNodeIdのNodeを取得 & vueFlowNodeZodObjectの型にパース
    const node = vueFlowController.vueFlowNodes.find(
      (node) => node.id === selectedNodeId
    );
    const parsedNode = vueFlowNodeZodObject.parse(node);
    log("INFO", "parsedNode is...", parsedNode);
    // 選択中のNodeとして指定
    selectedVueFlowNode.value = parsedNode;
    vueFlowController.currentVueFlowNode = parsedNode;
    // 選択中のNodeを現在の診断Nodeとして設定
    vueFlowController.setVueFlowNodeAsCurrentDiagnosisNode({
      node: selectedVueFlowNode.value,
    });
    // モーダルを開く
    editModalIsOpen.value = true;
  } catch (error) {
    if (error instanceof ZodError) {
      error.errors.forEach((err) => {
        log("ERROR", "Zod validation error:", err);
      });
    } else {
      log("ERROR", "Unexpected error:", error);
      alert("エラーが発生しました");
    }
    globalError.createNewGlobalError({});
  }
};
