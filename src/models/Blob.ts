export class Blob {
    private id: string;
    private data: string;

    constructor(id: string, data: string) {
        this.id = id;
        this.data = data;
    }

    getData(): string {
        return this.data;
    }
}
