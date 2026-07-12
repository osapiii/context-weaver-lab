<script setup lang="ts">
//#region composables
const actionIcons = useActionIcons();
const businessIcons = useBusinessIcons();
//#endregion composables

const links = [
  [
    {
      label: "Profile",
      avatar: {
        src: "https://avatars.githubusercontent.com/u/739984?v=4",
      },
      badge: 100,
    },
    {
      label: "Installation",
      icon: businessIcons.dashboard,
      to: "/getting-started/installation",
    },
    {
      label: "Vertical Navigation",
      icon: businessIcons.analytics,
      to: "/getting-started/installation",
    },
    {
      label: "Command Palette",
      icon: actionIcons.search,
      to: "/components/command-palette",
    },
  ],
  [
    {
      label: "Examples",
      icon: actionIcons.info,
    },
    {
      label: "Help",
      icon: actionIcons.info,
    },
  ],
];

const ui = /* ui */ {
  size: "text-2xl",
};
</script>

<template>
  <UVerticalNavigation :links="links" :ui="ui" />
</template>
