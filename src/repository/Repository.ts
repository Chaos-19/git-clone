import zlib from "zlib";
import crypto from "crypto";

import { Index } from "../models/Index";
import { Commit } from "../models/Commit";
import { Tree } from "../models/Tree";
import { Head } from "../models/Head";
import { Entry } from "../models/Entry";
import { Author } from "../models/Author";

import { FileAdapter, FsFileAdapter } from "../adapters/FsFileAdapter";

import { convertTimeToGit, getFileMode } from "../utils/utils";

export class Repository {
    private name: string;
    private description: string;
    private rootPath: string;

    private fs: FileAdapter;

    private commits: Commit[] = [];
    private index: Index;
    private head: Head;

    constructor(name: string, description: string, rootPath: string) {
        this.name = name;
        this.description = description;
        this.index = new Index();

        this.fs = FsFileAdapter.getInstace();
        this.head = new Head("refs/heads/main");
    }

    // Initialize repository
    init(): void {
        [".git", ".git/objects", ".git/refs"].forEach(dir => {
            const exist = this.fs.existsSync(dir);
            if (!exist)
                this.fs.mkdirSync(dir, {
                    recursive: true
                });
        });

        this.fs.writeFileSync(
            ".git/HADE",
            `ref: ${this.head.getCurrentRef()}\n`
        );

        console.log(`Repository ${this.name} initialized.`);
    }

    // Add files to the index
    add(file: string): void {
        try {
            let exist = this.fs.existsSync(file);

            if (!exist) return;

            const rawFileContent = this.fs.readFileSync(file);
            const header = Buffer.from(`blob ${this.fs.statSync(file).size}\0`);
            const store = Buffer.concat([header, rawFileContent]);

            const SHA = this.hashObject(file);

            const compressBlob = zlib.deflateSync(store);

            exist = this.fs.existsSync(`.git/objects/${SHA.slice(0, 2)}`);

            if (!exist)
                this.fs.mkdirSync(`.git/objects/${SHA.slice(0, 2)}`, {
                    recursive: true
                });

            const path = `.git/objects/${SHA.slice(0, 2)}/${SHA.slice(2)}`;

            this.fs.writeFileSync(path, compressBlob);

            const state = this.fs.statSync(path);

            const {
                dev, // Device ID
                ino, // Inode number
                mode, // File mode/permissions
                uid, // User ID of the file owner
                gid, // Group ID of the file owner
                size, // Size of the file in bytes
                ctimeMs, // Creation/change time in milliseconds
                mtimeMs // Modification time in milliseconds
            } = state;

            const { ctime_s, ctime_n, mtime_s, mtime_n } = convertTimeToGit({
                ctimeMs,
                mtimeMs
            });
            const newEntry = new Entry(
                ctime_s,
                ctime_n,
                mtime_s,
                mtime_n,
                dev,
                ino,
                getFileMode(mode),
                uid,
                gid,
                size,
                file.length,
                SHA,
                file
            );
            this.index.addEntry(newEntry);

            this.index.writeToIndexFile([newEntry.getWritebleEntry()]);

            console.log(`${file} added to index.`);
        } catch (error) {
            console.log(error);
        }
    }

    // Write index to tree
    writeTree(): Tree {
        const tree = new Tree(this.generateId());
        this.index.getEntries().forEach(entry => {
            tree.addEntry(entry);
        });
        console.log("Tree written from index.");
        return tree;
    }

    // Write index to disk
    writeIndex(): void {
        console.log("Index written to disk.");
    }

    // Read index from disk
    readIndex(): any {
        return this.index.readIndex();
    }

    // Commit logic
    commit(message: string): void {
        const newCommit = new Commit(
            this.generateId(),
            null,
            new Author(null, "chaos-19", "kalgetachew375@gmail.com"),
            message
        );
        this.commits.push(newCommit);
        console.log(`Commit created: ${message}`);
    }

    // Display commit log
    log(): void {
        this.commits.forEach(commit => {
            console.log(`${commit.getId()}: ${commit.getMessage()}`);
        });
    }

    // Checkout a specific commit
    checkout(commitId: string): void {
        console.log(`Checked out commit ${commitId}`);
    }

    // Hash file content (to simulate hash-object)
    hashObject(file: string): string {
        const rawFileDir = file;

        const rawFileContent = this.fs.readFileSync(rawFileDir);
        const header = Buffer.from(
            `blob ${this.fs.statSync(rawFileDir).size}\0`
        );
        const store = Buffer.concat([header, rawFileContent]);

        const SHA = crypto.createHash("sha1").update(store).digest("hex");

        /*const compressBlob = zlib.deflateSync(store);

        fs.mkdirSync(`.git/objects/${SHA.slice(0, 2)}`, {
            recursive: true
        });
        const path = `.git/objects/${SHA.slice(0, 2)}/${SHA.slice(2)}`;

        fs.writeFileSync(path, compressBlob);

        process.stdout.write(SHA);*/
        return SHA;
    }

    // Generate unique ID for tree, commit, etc.
    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    // Simulate cat-file functionality (display object content)
    catFile(objectId: string): void {
        console.log(`Displaying contents of object ${objectId}`);

        const blobDir = objectId.slice(0, 2);
        const blobFile = objectId.slice(2);

        const blobPath = `.git/objects/${blobDir}/${blobFile}`;
        const blobContent = this.fs.readFileSync(blobPath);

        const unCompressBlob = zlib.unzipSync(blobContent);

        const nullByte = unCompressBlob.indexOf("\0");
        const content = unCompressBlob.slice(nullByte + 1);
    }

    // Simulate ls-tree functionality (list tree objects)
    lsTree(tree: Tree): void {
        tree.getEntries().forEach(entry => {
            console.log(
                `${entry.getMode()} ${entry.getName()} ${entry.getHash()}`
            );
        });
    }
}
