/**
 * deck-structures/index.js
 * =========================
 *
 * `getDeckStructure(id)` / `listDeckStructures()` を export し、
 * build-deck.js や print-deck-structure.js から参照する。
 *
 * ## 用語整理
 *
 *   - **deckStructure** … デッキ全体の "型紙"。header / body.chapters / footer の
 *                         並びと枚数ルールを Zod schema で機械強制する。
 *                         例: learning-deck / news-summary / proposal-deck。
 *   - **slideTemplate** … 1 スライドの型 (ENO-04 / LIST-1 / DIAGRAM-3 等)。
 *                         schemas/templates/ 側で扱う別概念。混同注意。
 *
 *
 * 旧 plan.json で `doc.deck_structure: "mypedia"` / `"decision-guide"` を指定した
 * 場合は `lib/structure-qa.js` の `validateDeckStructure()` が StructQA-00 fatal
 * + 置き換え候補 (learning-deck / proposal-deck) を案内する。
 *
 * 新しい deckStructure を足す手順は
 * `references/alt-modes/deckstructure-add-mode.md` を参照。
 */

'use strict';

const learningDeck = require('./learning-deck');
const newsSummary = require('./news-summary');
const proposalDeck = require('./proposal-deck');
const caseStudyDeck = require('./case-study-deck');

const DECK_STRUCTURES = {
  'learning-deck':   learningDeck,
  'news-summary':    newsSummary,
  'proposal-deck':   proposalDeck,
  'case-study-deck': caseStudyDeck,
};

/**
 * `validateDeckStructure(deckJson)` 側でこのテーブルを参照し、
 * StructQA-00 fatal として置き換え候補ごと案内する。
 */
const REMOVED_DECK_STRUCTURES = {
  'mypedia':
    'Unknown deckStructure "mypedia". This was removed in v9.25. ' +
    'Use "learning-deck" instead (Wikipedia 的多角概観も学習デッキで十分扱えます)。',
  'decision-guide':
    'Unknown deckStructure "decision-guide". This was removed in v9.25. ' +
    'Use "learning-deck" or "proposal-deck" instead ' +
    '(中立な意思決定材料の整理は learning-deck、立場を持って 1 案を提案するなら proposal-deck)。',
};

/**
 * deckStructure id から定義オブジェクトを取得。未登録なら null。
 * @param {string} id
 * @returns {object|null}
 */
function getDeckStructure(id) {
  return DECK_STRUCTURES[id] || null;
}

/**
 * 登録済 deckStructure の id 一覧を返す。
 * @returns {string[]}
 */
function listDeckStructures() {
  return Object.keys(DECK_STRUCTURES);
}

/**
 * @returns {string[]}
 */
function listRemovedDeckStructures() {
  return Object.keys(REMOVED_DECK_STRUCTURES);
}

/**
 * @param {string} id
 * @returns {boolean}
 */
function isRemovedDeckStructure(id) {
  return Object.prototype.hasOwnProperty.call(REMOVED_DECK_STRUCTURES, id);
}

/**
 * 削除済 deckStructure に対する案内メッセージを返す。未該当なら null。
 * @param {string} id
 * @returns {string|null}
 */
function getRemovedDeckStructureMessage(id) {
  return REMOVED_DECK_STRUCTURES[id] || null;
}

module.exports = {
  DECK_STRUCTURES,
  REMOVED_DECK_STRUCTURES,
  getDeckStructure,
  listDeckStructures,
  listRemovedDeckStructures,
  isRemovedDeckStructure,
  getRemovedDeckStructureMessage,
};
