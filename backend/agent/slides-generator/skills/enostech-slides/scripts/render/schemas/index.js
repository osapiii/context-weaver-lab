/**
 */
'use strict';

const common = require('./common');
const tpl = require('./templates');
const diag = require('./diagrams');
const scene = require('./scenes');
const chart = require('./charts');

const AllRegistry = {
  ...tpl.TemplateSchemaRegistry,
  ...diag.DiagramSchemaRegistry,
  ...scene.SceneSchemaRegistry,
  ...chart.ChartSchemaRegistry,
};

/**
 * テンプレ ID から schema を引く。未登録なら null。
 */
function getSchema(templateId) {
  return AllRegistry[templateId] || null;
}

/**
 * slide JSON を template_id でディスパッチして safeParse。
 * 未登録テンプレは「スキップ」として扱い (段階導入のため)、null を返す。
 *
 * @returns {{ ok: boolean, data?: object, error?: TemplateValidationError, skipped?: boolean }}
 */
function validateSlideByTemplateId(slideJson) {
  const tid = slideJson.template_id;
  const schema = getSchema(tid);
  if (!schema) {
    return { ok: true, skipped: true, data: slideJson };
  }
  const parsed = schema.safeParse(slideJson);
  if (!parsed.success) {
    const err = new common.TemplateValidationError(tid, slideJson.id || '?', parsed.error);
    return { ok: false, error: err };
  }
  return { ok: true, data: parsed.data };
}

module.exports = {
  ...common,
  ...tpl,
  ...diag,
  ...scene,
  ...chart,
  AllRegistry,
  getSchema,
  validateSlideByTemplateId,
};
