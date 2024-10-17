import { Author } from "./Author";
import crypto from "crypto";

export class Commit {
    private treeHash: string;
    private id: string;

    private parent: string | null;
    private author: Author;
    private timestamp: Date;
    private message: string;

    constructor(
        treeHash: string,
        id: string,
        parent: string | null,
        author: Author,
        message: string
    ) {
        this.id = id;
        this.treeHash = treeHash;
        this.parent = parent;
        this.author = author;
        this.timestamp = new Date();
        this.message = message;
    }

    getId(): string {
        return this.id;
    }

    /*setParent(): void {
      const parentCommit = this.fs
        this.parent;
    }*/
    getParent(): string {
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

    createCommitHash() {
        const commitInfo = [];
        commitInfo.push(`tree ${this.treeHash}`);
        if (this.parent !== "") commitInfo.push(`parent ${this.parent}`);
        commitInfo.push(
            `author ${this.author.getUsername()} <${this.author.getEmail()}> 1729164823 +0300`
        );
        commitInfo.push(
            `committer ${this.author.getUsername()} <${this.author.getEmail()}> 1729164823 +0300`
        );
        commitInfo.push(``);
        commitInfo.push(this.message);
        commitInfo.push(``);

        console.log(commitInfo.join("\n"));
        const rawFileContent = Buffer.from(commitInfo.join("\n"), "utf-8");
        const header = Buffer.from(`commit ${rawFileContent.length}\0`);
        const store = Buffer.concat([header, rawFileContent]);

        const SHA = crypto.createHash("sha1").update(store).digest("hex");
        return SHA;
    }
}
