"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderDirectionEnum = exports.WhereOperatorEnum = exports.WhereLogicalOperatorEnum = void 0;
var WhereLogicalOperatorEnum;
(function (WhereLogicalOperatorEnum) {
    WhereLogicalOperatorEnum["AND"] = "$and";
    WhereLogicalOperatorEnum["OR"] = "$or";
})(WhereLogicalOperatorEnum || (exports.WhereLogicalOperatorEnum = WhereLogicalOperatorEnum = {}));
var WhereOperatorEnum;
(function (WhereOperatorEnum) {
    WhereOperatorEnum["EQ"] = "$eq";
    WhereOperatorEnum["NOT_EQ"] = "$ne";
    WhereOperatorEnum["GT"] = "$gt";
    WhereOperatorEnum["GT_OR_EQ"] = "$gte";
    WhereOperatorEnum["LT"] = "$lt";
    WhereOperatorEnum["LT_OR_EQ"] = "$lte";
    WhereOperatorEnum["IN"] = "$in";
    WhereOperatorEnum["NOT_IN"] = "$notIn";
    WhereOperatorEnum["LIKE"] = "$like";
    WhereOperatorEnum["NOT_LIKE"] = "$notLike";
    WhereOperatorEnum["ILIKE"] = "$iLike";
    WhereOperatorEnum["NOT_ILIKE"] = "$notIlike";
    WhereOperatorEnum["IS_NULL"] = "$isNull";
    WhereOperatorEnum["IS_NOT_NULL"] = "$isNotNull";
    WhereOperatorEnum["BETWEEN"] = "$between";
    WhereOperatorEnum["NOT_BETWEEN"] = "$notBetween";
    WhereOperatorEnum["IS_TRUE"] = "$isTrue";
    WhereOperatorEnum["IS_FALSE"] = "$isFalse";
})(WhereOperatorEnum || (exports.WhereOperatorEnum = WhereOperatorEnum = {}));
var OrderDirectionEnum;
(function (OrderDirectionEnum) {
    OrderDirectionEnum["ASC"] = "ASC";
    OrderDirectionEnum["DESC"] = "DESC";
})(OrderDirectionEnum || (exports.OrderDirectionEnum = OrderDirectionEnum = {}));
//# sourceMappingURL=types.js.map