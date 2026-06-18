import { computed, inject, provide, type ComputedRef } from "vue";
import {
  ADMIN_PAGE_CONTAINER_KEY,
  type AdminPageContainerOverride,
  type AdminPageContainerVariant,
} from "@composables/useAdminViewport";

export function provideAdminPageContainerOverride(
  getter: () => AdminPageContainerOverride | undefined
): void {
  provide(ADMIN_PAGE_CONTAINER_KEY, computed(getter));
}

export function useAdminPageContainerOverride():
  | ComputedRef<AdminPageContainerOverride | undefined>
  | undefined {
  return inject(ADMIN_PAGE_CONTAINER_KEY, undefined);
}

export function resolveAdminPageContainerVariant(options: {
  metaVariant?: AdminPageContainerVariant;
  routeFallback?: AdminPageContainerVariant;
  override?: AdminPageContainerOverride;
}): AdminPageContainerVariant {
  if (options.override?.variant) return options.override.variant;
  if (options.metaVariant) return options.metaVariant;
  return options.routeFallback ?? "default";
}

export function resolveAdminPageFillHeight(options: {
  metaFillHeight?: boolean;
  routeFallback?: boolean;
  override?: AdminPageContainerOverride;
}): boolean {
  if (options.override?.fillHeight !== undefined) {
    return options.override.fillHeight;
  }
  if (options.metaFillHeight !== undefined) return options.metaFillHeight;
  return options.routeFallback ?? false;
}
