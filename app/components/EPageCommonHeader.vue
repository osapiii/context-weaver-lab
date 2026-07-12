<script setup lang="ts"></script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2">
    <div class="justify-self-start place-self-center">
      <!-- <div class="text-xl font-bold">診断の一覧</div> -->
      <slot name="left" />
    </div>

    <div class="mb-2 justify-self-end">
      <slot name="right" />
    </div>
  </div>
  <EDivider class="mb-3" />
</template>
