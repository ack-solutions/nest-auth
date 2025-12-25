import { RelationBuilder } from '../lib/relation-builder';


describe('RelationBuilder', () => {
    let relationBuilder: RelationBuilder;

    beforeEach(() => {
        relationBuilder = new RelationBuilder();
    });

    it('should handle empty relations', () => {
        // Initially, the relations should be empty
        expect(relationBuilder.toObject()).toEqual({});

        // Clear any relations if set
        relationBuilder.clear();
        expect(relationBuilder.toObject()).toEqual({});
    });

    it('should handle setting empty relations', () => {
        // Set empty relations
        relationBuilder.setRelations([]);
        expect(relationBuilder.toObject()).toEqual({});
    });

    it('should handle clearing relations', () => {
        // Add some relations and then clear them
        relationBuilder.setRelations(['relation1', 'relation2']);
        relationBuilder.clear();
        expect(relationBuilder.toObject()).toEqual({});
    });
});
