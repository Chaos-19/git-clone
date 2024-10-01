export class Workspace {
    private files: string[] = [];

    constructor() {}

    addFile(file: string): void {
        this.files.push(file);
    }

    getFile(fileName: string): string | undefined {
        return this.files.find(file => file === fileName);
    }
}
