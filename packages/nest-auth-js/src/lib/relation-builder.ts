import { RelationObject, RelationObjectValue, RelationOptions } from './types';


export class RelationBuilder {

    private relations: RelationObject = {};

    constructor(relations?: RelationOptions | string) {
        if (relations) {
            const relationOptions = typeof relations === 'string' ? JSON.parse(relations) : relations;
            this.setRelations(relationOptions);
        }
    }

    setRelations(relations: RelationOptions): this {
        if (relations) {
            if (Array.isArray(relations)) {
                relations.forEach(relation => {
                    this.add(relation);
                });
            } else if (typeof relations === 'string') {
                this.add(relations);
            } else {
                this.relations = relations;
            }
        }
        return this;
    }

    clear(): this {
        this.relations = {};
        return this;
    }

    add(relation: string, select?: string[], where?: Record<string, any>): this {
        if (!select && !where) {
            this.relations[relation] = true;
        } else {
            const obj: any = {};
            if (select) {
                obj.select = select;
            }
            if (where) {
                obj.where = where;
            }
            this.relations[relation] = obj;
        }
        return this;
    }

    remove(relation: string): this {
        delete this.relations[relation];
        return this;
    }

    hasRelations(): boolean {
        return Object.keys(this.relations).length > 0;
    }

    toObject(): RelationObject {
        return this.relations;
    }

    toJson(): string {
        return JSON.stringify(this.relations);
    }

}
