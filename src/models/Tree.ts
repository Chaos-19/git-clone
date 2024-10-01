import { Entry } from "./Entry";

export class Tree {
    private id: string;
    private entries: Entry[] = [];

    constructor(id: string) {
        this.id = id;
    }

    addEntry(entry: Entry): void {
        this.entries.push(entry);
    }

    getEntries(): Entry[] {
        return this.entries;
    }
}
