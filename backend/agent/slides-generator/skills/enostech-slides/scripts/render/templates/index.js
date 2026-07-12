'use strict';
const CATEGORIES = ['section', 'list', 'compare', 'data', 'project', 'diagram', 'chart', 'visual', 'webpage', 'framing', 'free', 'code', 'qa'];
const TEMPLATE_REGISTRY = {};
for (const cat of CATEGORIES) {
  Object.assign(TEMPLATE_REGISTRY, require('./' + cat).registry);
}
module.exports = { TEMPLATE_REGISTRY, CATEGORIES };
