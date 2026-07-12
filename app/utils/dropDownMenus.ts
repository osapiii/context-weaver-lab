const TRASH_ICON = "material-symbols:delete";
const DUPLICATE_ICON = "material-symbols:content-copy";

const dropdownMenu = {
  archiveAndDuplicate: [
    [
      {
        label: "アーカイブ",
        slot: "archive",
        icon: TRASH_ICON,
      },
    ],
    [
      {
        label: "複製",
        slot: "duplicate",
        icon: DUPLICATE_ICON,
      },
    ],
  ],
  deleteAndRollback: [
    [
      {
        label: "削除",
        slot: "delete",
        icon: DUPLICATE_ICON,
      },
      {
        label: "下書きに戻す",
        slot: "undo",
        icon: DUPLICATE_ICON,
      },
    ],
  ],
  deleteOnly: [
    [
      {
        label: "削除",
        slot: "delete",
        icon: DUPLICATE_ICON,
      },
    ],
  ],

  duplicateOnly: [
    [
      {
        label: "複製",
        slot: "duplicate",
        icon: DUPLICATE_ICON,
      },
    ],
  ],
};

export default dropdownMenu;
