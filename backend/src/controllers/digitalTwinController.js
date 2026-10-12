const service = require('../services/digitalTwinService');
const { ok, fail } = require('../utils/response');
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
