const service = require('../services/digitalTwinService');
const { generateSummary, generatePersonalSummary } = require('../services/digitalTwinAiSummary');
const { currentPersonalSnapshot } = require('../services/digitalTwinPersonalService');
const { ok, fail } = require('../utils/response');
function selectedPerson(req) {
    const id = req.query.personId;
    if (Object.keys(req.query).some(key => !['personId','startDate','endDate'].includes(key)) || (id !== undefined && (typeof id !== 'string' || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))))) {
        throw Object.assign(new Error('人员编号不正确'), { status: 400 });
    }
    return id || String(req.user.id);
}
exports.personal = async (req, res, next) => {
    try { return ok(res, await currentPersonalSnapshot(req.user.id, selectedPerson(req), { startDate:req.query.startDate, endDate:req.query.endDate })); }
    catch (error) { if (error.status) return fail(res, error.status, error.status, error.message); return next(error); }
};
exports.personalSummary = async (req, res, next) => {
    if (Object.keys(req.body || {}).some(key => key !== 'force')) return fail(res, 400, 400, '总结参数不正确');
    if (req.body?.force !== undefined && typeof req.body.force !== 'boolean') return fail(res, 400, 400, '重新生成参数不正确');
    try { return ok(res, await generatePersonalSummary(req.user.id, selectedPerson(req), { force: req.body?.force === true, startDate:req.query.startDate, endDate:req.query.endDate })); }
    catch (error) { if (error.status) return fail(res, error.status, error.status, error.message); return next(error); }
};
exports.products = async (req, res, next) => {
    try {
        return ok(res, await service.listProducts(req.user.id));
    }
    catch (error) {
        if (error.status)
            return fail(res, error.status, error.status, error.message);
        return next(error);
    }
};
exports.snapshot = async (req, res, next) => {
    if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id)))
        return fail(res, 400, 400, '产品编号不正确');
    try {
        return ok(res, await service.currentSnapshot(req.user.id, req.params.id));
    }
    catch (error) {
        if (error.status)
            return fail(res, error.status, error.status, error.message);
        return next(error);
    }
};
exports.aiSummary = async (req, res, next) => {
    if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id)))
        return fail(res, 400, 400, '产品编号不正确');
    if (req.body?.force !== undefined && typeof req.body.force !== 'boolean')
        return fail(res, 400, 400, '重新生成参数不正确');
    try {
        return ok(res, await generateSummary(req.user.id, req.params.id, { force: req.body?.force === true }));
    } catch (error) {
        if (error.status) return fail(res, error.status, error.status, error.message);
        return next(error);
    }
};
