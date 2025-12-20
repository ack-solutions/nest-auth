export interface QueryBuilderOptions {
    [key: string]: any;
    select?: string[] | string;
    relations?: RelationOptions | string;
    where?: WhereOptions | string;
    order?: Record<string, OrderDirectionEnum> | string;
    skip?: number;
    take?: number;
    withDeleted?: boolean;
    onlyDeleted?: boolean;
}

export enum WhereLogicalOperatorEnum {
    AND = '$and',
    OR = '$or',
}

export enum WhereOperatorEnum {
    EQ = '$eq',
    NOT_EQ = '$ne',
    GT = '$gt',
    GT_OR_EQ = '$gte',
    LT = '$lt',
    LT_OR_EQ = '$lte',
    IN = '$in',
    NOT_IN = '$notIn',
    LIKE = '$like',
    NOT_LIKE = '$notLike',
    ILIKE = '$iLike',
    NOT_ILIKE = '$notIlike',
    IS_NULL = '$isNull',
    IS_NOT_NULL = '$isNotNull',
    BETWEEN = '$between',
    NOT_BETWEEN = '$notBetween',
    IS_TRUE = '$isTrue',
    IS_FALSE = '$isFalse',
}

export enum OrderDirectionEnum {
    ASC = 'ASC',
    DESC = 'DESC',
}

export type WhereObject = {
    [key: string]: any;
    $and?: WhereObject | WhereObject[];
    $or?: WhereObject | WhereObject[];
};

export type WhereOptions = WhereObject | WhereObject[];


export type RelationObjectValue = {
    select?: string[];
    where?: WhereObject | WhereObject[];
    joinType?: 'left' | 'inner';
};

export type RelationObject = Record<string, RelationObjectValue | boolean>;

export type RelationOptions = string | string[] | RelationObject;
