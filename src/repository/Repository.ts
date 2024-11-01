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
import { EntryType } from "../types";

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
    add(files: string[]): void {
        try {
            const indexEntryLs = files.map(file => {
                let exist = this.fs.existsSync(`./test/${file}`);

                if (!exist) return;

                const rawFileContent = this.fs.readFileSync(`test/${file}`);
                const header = Buffer.from(
                    `blob ${this.fs.statSync(`test/${file}`).size}\0`
                );
                const store = Buffer.concat([header, rawFileContent]);

                const SHA = crypto
                    .createHash("sha1")
                    .update(store)
                    .digest("hex");

                //this.hashObject(file);
                /*console.log(rawFileContent.slice(0, 10).toString());
                 */
                const compressBlob = zlib.deflateSync(store);

                exist = this.fs.existsSync(
                    `./test/.git/objects/${SHA.slice(0, 2)}`
                );

                if (!exist)
                    this.fs.mkdirSync(`test/.git/objects/${SHA.slice(0, 2)}`, {
                        recursive: true
                    });

                const path = `test/.git/objects/${SHA.slice(0, 2)}/${SHA.slice(
                    2
                )}`;
                if (!this.fs.existsSync(path))
                    this.fs.writeFileSync(path, compressBlob);

                const state = this.fs.statSync(`test/${file}`);

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

                const { ctime_s, ctime_n, mtime_s, mtime_n } = convertTimeToGit(
                    {
                        ctimeMs,
                        mtimeMs
                    }
                );
                const newEntry = new Entry(
                    ctime_s,
                    ctime_n,
                    mtime_s,
                    mtime_n,
                    dev,
                    ino,
                    mode,
                    uid,
                    gid,
                    size,
                    file.length,
                    SHA,
                    file
                );

                this.index.addEntry(newEntry);
                return newEntry.getWritebleEntry();
            });

            console.log(indexEntryLs.filter(v => v !== undefined).length);
            console.log(
                indexEntryLs.map(v => ({
                    ...v,
                    path: v?.path.toString()
                }))
            );

            this.index.writeToIndexFile(
                indexEntryLs.filter(v => v !== undefined)
            );

            console.log(`files added to index.`);
        } catch (error) {
            console.log(error);
        }
    }

    // Write index to tree
    writeTree() {
        const tree = new Tree(this.generateId());
        this.index.getEntries().forEach(entry => {
            tree.addEntry(entry);
        });
        const treeHash: string = tree.createTreeHash(this.readIndex());
        /*this.commit(
            "add commit hash object creator method",
            treeHash as string
        );
      */

        console.log("Tree written from index. : ", treeHash);
        return treeHash;
    }

    // Write index to disk
    writeIndex(): void {
        console.log("Index written to disk.");
        const tree = new Tree(this.generateId());
        console.log(tree.parseTree("f02e195535003ba20bcd3e6327ace27d766e351f"));
    }

    // Read index from disk
    readIndex(): EntryType<number>[] {
        return this.index
            .readIndex()
            .map(v => ({ ...v, path: v.path.toString() }));
        //.splice(0, -3);
    }

    // Commit logic
    commit(message: string, treeHah: string): void {
        const newCommit = new Commit(
            treeHah,
            this.generateId(),
            "4e6f04a63d5340cc7989cd06063e0a8898f83d00",
            new Author(null, "Chaos-19", "kalgetachew375@gmail.com"),
            message
        );
        //this.commits.push(newCommit);
        console.log(`Commit created: ${newCommit.createCommitHash()}`);
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
