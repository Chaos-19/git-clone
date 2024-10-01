import { Author } from "./Author";

export class Commit {
    private id: string;
    private parent: Commit | null;
    private author: Author;
    private timestamp: Date;
    private message: string;

    constructor(
        id: string,
        parent: Commit | null,
        author: Author,
        message: string
    ) {
        this.id = id;
        this.parent = parent;
        this.author = author;
        this.timestamp = new Date();
        this.message = message;
    }

    getId(): string {
        return this.id;
    }

    getParent(): Commit | null {
        return this.parent;
    }

    getAuthor(): Author {
        return this.author;
    }

    getTimestamp(): Date {
        return this.timestamp;
    }

    getMessage(): string {
        return this.message;
    }
}
