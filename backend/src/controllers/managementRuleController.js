const managementRuleService = require('../services/managementRuleService');

async function listManagementRules(req, res, next) {
  try {
    const rules = await managementRuleService.listManagementRules(
      req.user.cuentaGanaderaId,
      req.query
    );

    res.json({
      data: rules,
      total: rules.length
    });
  } catch (err) {
    next(err);
  }
}

async function getManagementRuleById(req, res, next) {
  try {
    const rule = await managementRuleService.getManagementRuleById(
      Number(req.params.id),
      req.user.cuentaGanaderaId
    );

    res.json(rule);
  } catch (err) {
    next(err);
  }
}

async function createManagementRule(req, res, next) {
  try {
    const rule = await managementRuleService.createManagementRule(
      req.body,
      req.user.cuentaGanaderaId
    );

    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
}

async function updateManagementRule(req, res, next) {
  try {
    const rule = await managementRuleService.updateManagementRule(
      Number(req.params.id),
      req.body,
      req.user.cuentaGanaderaId
    );

    res.json(rule);
  } catch (err) {
    next(err);
  }
}

async function deleteManagementRule(req, res, next) {
  try {
    const result = await managementRuleService.deleteManagementRule(
      Number(req.params.id),
      req.user.cuentaGanaderaId
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listManagementRules,
  getManagementRuleById,
  createManagementRule,
  updateManagementRule,
  deleteManagementRule
};
