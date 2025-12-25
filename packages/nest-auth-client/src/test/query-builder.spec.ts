import { QueryBuilder } from '../lib/query-builder';
import { OrderDirectionEnum } from '../lib/types';


describe('QueryBuilder', () => {
    let queryBuilder: QueryBuilder;

    beforeEach(() => {
        queryBuilder = new QueryBuilder({});
    });

    it('should set options', () => {
        const options = { select: ['name', 'age'] };
        queryBuilder.setOptions(options);
        expect(queryBuilder.toObject(true).select).toEqual(options.select);
    });

    it('should merge options shallowly', () => {
        queryBuilder.setOptions({ select: ['name'] });
        queryBuilder.mergeOptions({ select: ['age'] });
        expect(queryBuilder.toObject(true).select).toEqual(['age']);
    });

    it('should merge options deeply', () => {
        queryBuilder.setOptions({ where: { age: { $gt: 18 } } });
        queryBuilder.mergeOptions({ where: { name: { $eq: 'John' } } }, true);
        expect(queryBuilder.toObject(true).where).toEqual({
            age: { $gt: 18 },
            name: { $eq: 'John' },
        });
    });

    it('should add select fields', () => {
        queryBuilder.addSelect('name');
        queryBuilder.addSelect(['age', 'email']);
        expect(queryBuilder.toObject(true).select).toEqual([
            'name',
            'age',
            'email',
        ]);
    });

    it('should remove select fields', () => {
        queryBuilder.addSelect([
            'name',
            'age',
            'email',
        ]);
        queryBuilder.removeSelect('age');
        expect(queryBuilder.toObject(true).select).toEqual(['name', 'email']);
    });

    it('should add and remove relations as array of objects', () => {
        queryBuilder.addRelation('profile', ['id', 'bio']);
        queryBuilder.addRelation('posts', ['title', 'content']);

        const relations = queryBuilder.toObject(true).relations;
        expect(relations).toEqual(
            expect.objectContaining({
                profile: { select: ['id', 'bio'] },
                posts: { select: ['title', 'content'] },
            }),
        );

        queryBuilder.removeRelation('profile');
        const updatedRelations = queryBuilder.toObject(true).relations;
        expect(updatedRelations).toEqual(
            expect.objectContaining({
                posts: { select: ['title', 'content'] },
            }),
        );
        expect(updatedRelations).not.toEqual(
            expect.objectContaining({ profile: true }),
        );
    });

    it('should handle null or empty relations', () => {
        queryBuilder.addRelation('profile');
        expect(queryBuilder.toObject(true).relations).not.toEqual(undefined);

        queryBuilder.addRelation('profile');
        queryBuilder.removeRelation('profile');
        expect(queryBuilder.toObject(true).relations).toEqual(undefined);
    });

    it('should add and remove relations as array of strings', () => {
        queryBuilder.addRelation('profile');
        queryBuilder.addRelation('posts');

        const relations = queryBuilder.toObject(true).relations;
        expect(relations).toEqual(
            expect.objectContaining({ profile: true, posts: true }),
        );

        queryBuilder.removeRelation('profile');
        const updatedRelations = queryBuilder.toObject(true).relations;
        expect(updatedRelations).toEqual(
            expect.objectContaining({ posts: true }),
        );
        expect(updatedRelations).not.toEqual(
            expect.objectContaining({ profile: true }),
        );
    });

    it('should add where conditions', () => {
        queryBuilder.where('age', 25);
        expect(queryBuilder.toObject(true).where).toEqual({ age: { $eq: 25 } });
    });

    it('should handle empty where conditions', () => {
        queryBuilder.where(() => {
            // Do nothing
        });
        expect(queryBuilder.toObject(true).where).toEqual(undefined);
    });

    it('should add order', () => {
        queryBuilder.addOrder('name', OrderDirectionEnum.ASC);
        expect(queryBuilder.toObject(true).order).toEqual({ name: OrderDirectionEnum.ASC });
    });

    it('should remove order', () => {
        queryBuilder.addOrder('name', OrderDirectionEnum.ASC);
        queryBuilder.removeOrder('name');
        expect(queryBuilder.toObject(true).order).toEqual(undefined);
    });

    it('should set skip and take', () => {
        queryBuilder.setSkip(10);
        queryBuilder.setTake(5);
        expect(queryBuilder.toObject(true).skip).toBe(10);
        expect(queryBuilder.toObject(true).take).toBe(5);
    });

    it('should convert to JSON', () => {
        queryBuilder.setOptions({ select: ['name'] });
        const json = queryBuilder.toJson();
        expect(json).toBe(JSON.stringify(queryBuilder.toObject(true)));
    });
});
