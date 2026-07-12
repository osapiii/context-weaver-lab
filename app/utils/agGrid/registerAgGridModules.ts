import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";

let registered = false;

/** AG Grid Community モジュールを一度だけ登録する */
export function registerAgGridModules(): void {
  if (registered) return;
  ModuleRegistry.registerModules([AllCommunityModule]);
  registered = true;
}
