<template>
  <div>
    <header />
    <main>
      <slot />
    </main>
  </div>
</template>
<script setup lang="ts">
defineOptions({
  name: "DefaultLayout",
});
</script>

<style></style>
