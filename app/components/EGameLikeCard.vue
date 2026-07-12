<script setup lang="ts">
import log from "@utils/logger";
import dropDownMenu from "@utils/dropDownMenus";

//#region reactive-data
const dropdownIsOpen = ref(false);
const isHovered = ref(false);
//#endregion reactive-data

//#region method
const openDropdown = () => {
  dropdownIsOpen.value = true;
};
//#endregion method

// #region emit
const emits = defineEmits(["delete", "duplicate", "archive", "click"]);

const emitDelete = () => {
  log("INFO", "emitDelete");
  emits("delete");
};

const emitArchive = () => {
  log("INFO", "emitArchive");
  emits("archive");
};

const emitDuplicate = () => {
  log("INFO", "emitDuplicate");
  emits("duplicate");
};

const handleClick = () => {
  emits("click");
};
// #endregion emit

//#region component-props
export interface Props {
  title: string;
  description?: string;
  imageUrl?: string | Promise<string>;
  /** 画像未設定・読み込み失敗時に image エリア中央へ表示 */
  placeholderIcon?: string;
  menuItemType?:
    | "archiveAndDuplicate"
    | "duplicateOnly"
    | "deleteAndRollback"
    | "deleteOnly";
  menuItemIsActive?: boolean;
  tooltipIsActive?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: "カードのタイトル",
  description: "",
  imageUrl: "",
  placeholderIcon: "i-heroicons-photo",
  menuItemType: "archiveAndDuplicate",
  menuItemIsActive: true,
  tooltipIsActive: true,
});
//#endregion component-props

//#region watch-computed
const imageLoadFailed = ref(false);

watch(
  () => props.imageUrl,
  () => {
    imageLoadFailed.value = false;
  }
);

const showImagePlaceholder = computed(
  () => !props.imageUrl || imageLoadFailed.value
);

const dropdown = computed(() => {
  if (props.menuItemType === "archiveAndDuplicate") {
    return dropDownMenu.archiveAndDuplicate;
  } else if (props.menuItemType === "duplicateOnly") {
    return dropDownMenu.duplicateOnly;
  } else if (props.menuItemType === "deleteAndRollback") {
    return dropDownMenu.deleteAndRollback;
  } else if (props.menuItemType === "deleteOnly") {
    return dropDownMenu.deleteOnly;
  } else {
    return dropDownMenu.archiveAndDuplicate;
  }
});
//#endregion watch-computed
</script>

<template>
  <div
    class="game-card relative cursor-pointer"
    @click="handleClick"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- 左上カスタムスロット -->
    <div class="absolute top-3 left-3 z-10">
      <slot name="customLeftCorner" />
    </div>

    <!-- Dropdownメニュー -->
    <div v-if="menuItemIsActive" class="absolute top-3 right-3 z-10">
      <UDropdown
        v-model:open="dropdownIsOpen"
        class="z-50"
        :items="dropdown"
        :ui="{ item: { disabled: 'cursor-text select-text' } }"
        :popper="{ placement: 'top-start' }"
      >
        <div class="game-menu-button" @click.stop="openDropdown">
          <UIcon name="i-heroicons-ellipsis-vertical-16-solid" />
        </div>
        <!-- アーカイブ操作 -->
        <template #archive="{ item }">
          <div
            class="text-error-600 text-left w-full h-full"
            @click.stop="emitArchive"
          >
            <UIcon :name="item.icon" class="flex-shrink-0 h-4 w-4 ms-auto" />
            <span class="text-xs"> アーカイブ </span>
          </div>
        </template>
        <!-- 削除操作 -->
        <template #delete="{ item }">
          <div
            class="text-error-600 text-left w-full h-full"
            @click.stop="emitDelete"
          >
            <UIcon :name="item.icon" class="flex-shrink-0 h-4 w-4 ms-auto" />
            <span class="text-xs"> 削除 </span>
          </div>
        </template>
        <!-- 複製操作 -->
        <template #duplicate="{ item }">
          <div class="text-left w-full h-full" @click.stop="emitDuplicate">
            <UIcon :name="item.icon" class="flex-shrink-0 h-4 w-4 ms-auto" />
            <span class="text-xs"> 複製 </span>
          </div>
        </template>
      </UDropdown>
    </div>

    <!-- 画像部分 -->
    <div class="game-card-image-wrapper">
      <NuxtImg
        v-if="!showImagePlaceholder"
        :src="imageUrl"
        width="300"
        height="169"
        fit="contain"
        class="game-card-image"
        referrerpolicy="no-referrer"
        @error="imageLoadFailed = true"
      />
      <div
        v-else
        class="game-card-placeholder flex h-full w-full items-center justify-center"
      >
        <UIcon :name="placeholderIcon" class="h-16 w-16 text-slate-400/90" />
      </div>
      <!-- グラデーションオーバーレイ -->
      <div class="game-card-overlay"/>
    </div>

    <!-- コンテンツ部分 -->
    <div class="game-card-content">
      <div class="game-card-title">
        <slot name="title">
          {{ title }}
        </slot>
      </div>
      <div v-if="description || $slots.body" class="game-card-body">
        <slot name="body">
          <p v-if="description" class="game-card-description">
            {{ description }}
          </p>
        </slot>
      </div>
      <div v-if="$slots.custom" class="game-card-custom">
        <slot name="custom" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ゲームライクなカード */
.game-card {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  box-shadow:
    0 4px 0 0 rgba(0, 0, 0, 0.1),
    0 6px 12px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  overflow: hidden;
  position: relative;
  will-change: transform, box-shadow, border-color;
  backface-visibility: hidden;
  transform: translateZ(0);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.game-card:hover {
  transform: translateY(-4px) scale(1.02) translateZ(0);
  box-shadow:
    0 6px 0 0 rgba(0, 0, 0, 0.12),
    0 10px 20px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  border-color: rgba(251, 191, 36, 0.4);
}

/* 画像部分 */
.game-card-image-wrapper {
  position: relative;
  width: 100%;
  height: 180px;
  overflow: hidden;
  background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
}

.game-card-placeholder {
  background: linear-gradient(145deg, #f1f5f9 0%, #e2e8f0 100%);
}

.game-card-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 12px;
  box-sizing: border-box;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  backface-visibility: hidden;
  transform: translateZ(0);
}

.game-card:hover .game-card-image {
  transform: scale(1.08) translateZ(0);
}

.game-card-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(0, 0, 0, 0.1) 50%,
    rgba(0, 0, 0, 0.3) 100%
  );
  pointer-events: none;
}

/* コンテンツ部分 */
.game-card-content {
  padding: 16px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
}

.game-card-title {
  font-size: 16px;
  font-weight: 800;
  color: #1e293b;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  margin-bottom: 8px;
  line-height: 1.4;
}

.game-card-body {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.game-card-description {
  margin-top: 4px;
}

.game-card-custom {
  margin-top: 8px;
}

/* メニューボタン */
.game-menu-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(248, 250, 252, 0.9) 100%
  );
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  box-shadow:
    0 2px 0 0 rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  color: #475569;
  will-change: transform, box-shadow;
  backface-visibility: hidden;
  transform: translateZ(0);
}

.game-menu-button:hover {
  background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
  border-color: rgba(251, 191, 36, 0.4);
  box-shadow:
    0 3px 0 0 rgba(0, 0, 0, 0.12),
    0 4px 8px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transform: translateY(-1px) translateZ(0);
}
</style>
