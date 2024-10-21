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
        //this.timestamp = new Date();
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

    getTimestamp(): string {
        const now = new Date();
        const timestamp = Math.floor(now.getTime() / 1000); // Convert milliseconds to seconds

        // Get timezone offset in minutes
        const offsetMinutes = now.getTimezoneOffset();

        // Calculate hours and minutes for the offset
        const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
        const offsetRemainingMinutes = Math.abs(offsetMinutes) % 60;

        // Format the offset with leading zeroes if needed
        const formattedOffset = `${offsetMinutes > 0 ? "-" : "+"}${String(
            offsetHours
        ).padStart(2, "0")}${String(offsetRemainingMinutes).padStart(2, "0")}`;

        // Combine timestamp with offset
        const formattedTime = `${timestamp} ${formattedOffset}`;
        //console.log(formattedTime);
        return formattedTime;
    }

    getMessage(): string {
        return this.message;
    }

    createCommitHash() {
        const commitInfo = [];
        commitInfo.push(`tree ${this.treeHash}`);
        if (this.parent !== "") commitInfo.push(`parent ${this.parent}`);

        const timestamp = this.getTimestamp();

        commitInfo.push(
            `author ${this.author.getUsername()} <${this.author.getEmail()}> ${timestamp}`
        );
        commitInfo.push(
            `committer ${this.author.getUsername()} <${this.author.getEmail()}> ${timestamp}`
        );
        commitInfo.push(``);
        commitInfo.push(this.message);
        commitInfo.push(``);

        const rawFileContent = Buffer.from(commitInfo.join("\n"), "utf-8");
        /*const header = Buffer.from(`commit ${rawFileContent.length}\0`);
        const store = Buffer.concat([header, rawFileContent]);

        const SHA = crypto.createHash("sha1").update(store).digest("hex");
        */

        return SHA;
    }
}
