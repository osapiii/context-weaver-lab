/**
 *
 * 互換のため registry (deck-structures/index.js) には
 * REMOVED_DECK_STRUCTURES として登録されており、対応する deckStructure を
 * plan.json で指定すると validateDeckStructure() が StructQA-00 fatal で停止し、
 * 置き換え候補を案内します。
 *
 * Cowork からはこのファイル自体を物理削除できないため (Drive ミラー権限の制約)、
 * osanai さんが Finder / ターミナルから手動削除することを推奨:
 *   rm scripts/render/deck-structures/decision-guide.js
 */
'use strict';
throw new Error(
  'deck-structures/decision-guide.js: This deckStructure was removed in v9.25. ' +
  'See references/deck-structures/{mypedia,decision-guide}.md for replacement guidance.'
);
