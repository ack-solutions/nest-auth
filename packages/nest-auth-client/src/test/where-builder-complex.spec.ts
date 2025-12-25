import { WhereBuilder } from '../lib/where-builder';
import { WhereOperatorEnum } from '../lib/types';

describe('WhereBuilder - Complex Nested Structures', () => {
    let whereBuilder: WhereBuilder;

    beforeEach(() => {
        whereBuilder = new WhereBuilder();
    });

    it('should create complex nested where structure with mixed conditions', () => {
        // Target structure:
        // {
        //   customerId: { $in: ['cust_123', 'cust_456'] },
        //   $or: [
        //     { status: { $eq: 'pending' } },
        //     { status: { $eq: 'processing' } },
        //     {
        //       $and: [
        //         { total: { $gt: 1000 } },
        //         { tax: { $lte: 200 } },
        //       ],
        //     },
        //   ],
        // }

        whereBuilder
            .where('customerId', WhereOperatorEnum.IN, ['cust_123', 'cust_456'])
            .orWhere('status', WhereOperatorEnum.EQ, 'pending')
            .orWhere('status', WhereOperatorEnum.EQ, 'processing')
            .orWhere((builder) => {
                builder.where('total', WhereOperatorEnum.GT, 1000)
                    .where('tax', WhereOperatorEnum.LT_OR_EQ, 200);
            });

        const result = whereBuilder.toObject();

        expect(result).toEqual({
            customerId: { $in: ['cust_123', 'cust_456'] },
            $or: [
                { status: { $eq: 'pending' } },
                { status: { $eq: 'processing' } },
                {
                    total: { $gt: 1000 },
                    tax: { $lte: 200 },
                },
            ],
        });
    });

    it('should handle multiple field conditions with same logical operator', () => {
        whereBuilder
            .where('name', 'John')
            .orWhere('age', WhereOperatorEnum.GT, 18)
            .orWhere('status', 'active')
            .where('country', 'USA');

        const result = whereBuilder.toObject();

        expect(result).toEqual({
            name: { $eq: 'John' },
            country: { $eq: 'USA' },
            $or: [
                { age: { $gt: 18 } },
                { status: { $eq: 'active' } },
            ],
        });
    });

    it('should handle nested $and and $or conditions', () => {
        whereBuilder
            .where('userId', '123')
            .orWhere((builder) => {
                builder.where('role', 'admin')
                    .where('department', 'IT');
            })
            .orWhere((builder) => {
                builder.where('role', 'manager')
                    .where('level', WhereOperatorEnum.GT, 5);
            });

        const result = whereBuilder.toObject();

        expect(result).toEqual({
            userId: { $eq: '123' },
            $or: [
                {
                    role: { $eq: 'admin' },
                    department: { $eq: 'IT' },
                },
                {
                    role: { $eq: 'manager' },
                    level: { $gt: 5 },
                },
            ],
        });
    });

    it('should handle direct object conditions', () => {
        whereBuilder
            .where({
                name: { $eq: 'John' },
                age: { $gt: 18 },
            })
            .orWhere({
                status: { $eq: 'active' },
                verified: { $eq: true },
            });

        const result = whereBuilder.toObject();

        expect(result).toEqual({
            name: { $eq: 'John' },
            age: { $gt: 18 },
            $or: [
                {
                    status: { $eq: 'active' },
                    verified: { $eq: true },
                },
            ],
        });
    });

    it('should merge multiple $or conditions correctly', () => {
        whereBuilder
            .orWhere('category', 'tech')
            .orWhere('category', 'design')
            .where('published', true)
            .orWhere('priority', WhereOperatorEnum.GT, 5);

        const result = whereBuilder.toObject();

        expect(result).toEqual({
            published: { $eq: true },
            $or: [
                { category: { $eq: 'tech' } },
                { category: { $eq: 'design' } },
                { priority: { $gt: 5 } },
            ],
        });
    });

    it('should handle complex nested logical operations', () => {
        whereBuilder
            .where('companyId', '456')
            .orWhere((builder) => {
                builder.where('department', 'Sales')
                    .orWhere((innerBuilder) => {
                        innerBuilder.where('region', 'North')
                            .where('quota', WhereOperatorEnum.GT, 100000);
                    });
            })
            .where('active', true);

        const result = whereBuilder.toObject();

        expect(result).toEqual({
            companyId: { $eq: '456' },
            active: { $eq: true },
            $or: [
                {
                    department: { $eq: 'Sales' },
                    $or: [
                        {
                            region: { $eq: 'North' },
                            quota: { $gt: 100000 },
                        },
                    ],
                },
            ],
        });
    });
});
