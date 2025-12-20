import { QueryBuilder } from '../lib/query-builder';
import { WhereOperatorEnum } from '../lib/types';


describe('QueryBuilder - Where Conditions', () => {
    let queryBuilder: QueryBuilder;

    beforeEach(() => {
        queryBuilder = new QueryBuilder({});
    });

    it('should add where conditions', () => {
        queryBuilder.where('age', 25);
        expect(queryBuilder.toObject(true).where).toEqual({ age: { $eq: 25 } });
    });

    it('should add or where conditions', () => {
        queryBuilder.orWhere('age', 25);
        expect(queryBuilder.toObject(true).where).toEqual({ $or: [{ age: { $eq: 25 } }] });
    });

    it('should add where conditions with a function', () => {
        queryBuilder.where((builder) => {
            builder.where('age', 25);
            builder.orWhere('name', 'John');
        });

        expect(queryBuilder.toObject(true).where).toEqual({
            age: { $eq: 25 },
            $or: [{ name: { $eq: 'John' } }],
        });
    });

    it('should add or where conditions with a function', () => {
        queryBuilder.orWhere((builder) => {
            builder.where('age', 25);
            builder.orWhere('name', 'John');
        });

        expect(queryBuilder.toObject(true).where).toEqual({
            $or: [
                {
                    age: { $eq: 25 },
                    $or: [{ name: { $eq: 'John' } }],
                },
            ],
        });
    });

    it('should handle complex where conditions with multiple nested functions', () => {
        queryBuilder.where((builder) => {
            builder.where('age', 25);
            builder.orWhere((innerBuilder) => {
                innerBuilder.where('name', 'John');
                innerBuilder.where('status', 'active');
            });
            builder.where('country', 'USA');
        });

        expect(queryBuilder.toObject(true).where).toEqual({
            age: { $eq: 25 },
            $or: [
                {
                    name: { $eq: 'John' },
                    status: { $eq: 'active' },
                },
            ],
            country: { $eq: 'USA' },
        });
    });

    it('should handle complex or where conditions with multiple nested functions', () => {
        queryBuilder.orWhere((builder) => {
            builder.where('age', 25);
            builder.orWhere((innerBuilder) => {
                innerBuilder.where('name', 'John');
                innerBuilder.orWhere('status', 'active');
            });
            builder.orWhere('country', 'USA');
        });

        expect(queryBuilder.toObject(true).where).toEqual({
            $or: [
                {
                    age: { $eq: 25 },
                    $or: [
                        {
                            name: { $eq: 'John' },
                            $or: [{ status: { $eq: 'active' } }],
                        },
                        { country: { $eq: 'USA' } },
                    ],
                },
            ],
        });
    });

    it('should handle empty where conditions', () => {
        queryBuilder.where(() => {
            // Do nothing
        });

        expect(queryBuilder.toObject(true).where).toEqual(undefined);
    });

    it('should handle single condition without nesting', () => {
        queryBuilder.where('age', 30);

        expect(queryBuilder.toObject(true).where).toEqual({
            age: { $eq: 30 },
        });
    });

    it('should handle multiple conditions with different operators', () => {
        queryBuilder.where((builder) => {
            builder.where('age', 30);
            builder.where('salary', WhereOperatorEnum.GT, 50000);
            builder.orWhere('status', 'employed');
        });

        expect(queryBuilder.toObject(true).where).toEqual({
            age: { $eq: 30 },
            salary: { $gt: 50000 },
            $or: [{ status: { $eq: 'employed' } }],
        });
    });

    it('should handle nested orWhere with multiple conditions', () => {
        queryBuilder.orWhere((builder) => {
            builder.where('age', 30);
            builder.orWhere((innerBuilder) => {
                innerBuilder.where('name', 'Alice');
                innerBuilder.orWhere('city', 'New York');
            });
        });

        expect(queryBuilder.toObject(true).where).toEqual({
            $or: [
                {
                    age: { $eq: 30 },
                    $or: [
                        {
                            name: { $eq: 'Alice' },
                            $or: [{ city: { $eq: 'New York' } }],
                        },
                    ],
                },
            ],
        });
    });

    it('should handle complex conditions with mixed operators', () => {
        queryBuilder.where((builder) => {
            builder.where('age', { $gte: 18 });
            builder.orWhere((innerBuilder) => {
                innerBuilder.where('name', 'Bob');
                innerBuilder.where('status', { $ne: 'inactive' });
            });
            builder.where('country', { $in: ['USA', 'Canada'] });
        });

        expect(queryBuilder.toObject(true).where).toEqual({
            age: { $gte: 18 },
            $or: [
                {
                    name: { $eq: 'Bob' },
                    status: { $ne: 'inactive' },
                },
            ],
            country: { $in: ['USA', 'Canada'] },
        });
    });
});
