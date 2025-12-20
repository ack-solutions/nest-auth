import { RelationBuilder } from './relation-builder';
import { QueryBuilderOptions, OrderDirectionEnum } from './types';
import { deepMerge } from './utils';
import { WhereBuilder, WhereBuilderCondition } from './where-builder';


export class QueryBuilder {

    private options: QueryBuilderOptions = {};

    private whereBuilder: WhereBuilder = new WhereBuilder();

    private relationBuilder: RelationBuilder = new RelationBuilder();

    constructor(options?: QueryBuilderOptions) {
        if (options) {
            this.setOptions(options);
        }
    }

    setOptions(options: QueryBuilderOptions): this {
        this.options = options;
        this.whereBuilder = new WhereBuilder(options.where);
        this.relationBuilder = new RelationBuilder(options.relations);
        return this;
    }

    mergeOptions(options: QueryBuilderOptions, deep = false): this {
        let updatedOptions = {};
        if (deep) {
            updatedOptions = deepMerge(this.options, options);
        } else {
            updatedOptions = {
                ...this.options,
                ...options,
            };
        }
        this.setOptions(updatedOptions);
        return this;
    }

    addSelect(fields: string | string[]): this {
        // Ensure select is always an array
        if (!this.options.select || typeof this.options.select === 'string') {
            this.options.select = [];
        }
        if (Array.isArray(fields)) {
            this.options.select.push(...fields);
        } else {
            this.options.select.push(fields);
        }
        return this;
    }

    removeSelect(fields: string | string[]): this {
        // Ensure select is an array before filtering
        if (this.options.select && Array.isArray(this.options.select)) {
            if (Array.isArray(fields)) {
                this.options.select = this.options.select.filter(field => !fields.includes(field));
            } else {
                this.options.select = this.options.select.filter(field => field !== fields);
            }
        }
        return this;
    }

    addRelation(relation: string, select?: string[], where?: Record<string, any>): this {
        this.relationBuilder.add(relation, select, where);
        return this;
    }

    removeRelation(relation: string): this {
        this.relationBuilder.remove(relation);
        return this;
    }

    where(...args: WhereBuilderCondition): this {
        this.whereBuilder.where(...args);
        return this;
    }

    andWhere(...args: WhereBuilderCondition): this {
        this.whereBuilder.andWhere(...args);
        return this;
    }

    orWhere(...args: WhereBuilderCondition): this {
        this.whereBuilder.orWhere(...args);
        return this;
    }

    addOrder(orderBy: string, order: OrderDirectionEnum): this {
        if (!this.options.order) {
            this.options.order = {};
        }
        this.options.order[orderBy] = order;
        return this;
    }

    removeOrder(orderBy: string): this {
        if (this.options.order) {
            delete this.options.order[orderBy];
        }
        return this;
    }

    setSkip(skip: number): this {
        this.options.skip = skip;
        return this;
    }

    setTake(take: number): this {
        this.options.take = take;
        return this;
    }

    setWithDeleted(withDeleted: boolean): this {
        this.options.withDeleted = withDeleted;
        return this;
    }

    setOnlyDeleted(onlyDeleted: boolean): this {
        this.options.onlyDeleted = onlyDeleted;
        return this;
    }

    set(key: string, value: any): this {
        this.options[key] = value;
        return this;
    }

    toObject(constrainToNestedObject = false) {
        const options = {
            ...this.options,
        };

        // Convert where conditions to JSON string
        if (this.whereBuilder.hasConditions()) {
            if (constrainToNestedObject) {
                options.where = this.whereBuilder.toObject();
            } else {
                options.where = JSON.stringify(this.whereBuilder.toObject());
            }
        } else {
            delete options.where;
        }

        // Convert relations to JSON string
        if (this.relationBuilder.hasRelations()) {
            if (constrainToNestedObject) {
                options.relations = this.relationBuilder.toObject();
            } else {
                options.relations = JSON.stringify(this.relationBuilder.toObject());
            }
        } else {
            delete options.relations;
        }

        // Convert order to JSON string if it exists
        if (options.order && Object.keys(options.order).length > 0) {
            if (constrainToNestedObject) {
                options.order = options.order;
            } else {
                options.order = JSON.stringify(options.order);
            }
        } else {
            delete options.order;
        }

        // Convert select to JSON string if it exists
        if (options.select && options.select.length > 0) {
            if (constrainToNestedObject) {
                options.select = options.select;
            } else {
                options.select = JSON.stringify(options.select);
            }
        } else {
            delete options.select;
        }

        return options;
    }

    toJson() {
        const obj = this.toObject(true);
        return JSON.stringify(obj);
    }

}
