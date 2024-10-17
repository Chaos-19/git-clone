import crypto from "crypto";
import * as path from "path";
import zlib from "zlib";

import { FileAdapter, FsFileAdapter } from "../adapters/FsFileAdapter";
import { Entry } from "./Entry";
import { getFileMode } from "../utils/utils";
import { EntryType } from "../types";

export class Tree {
    private id: string;
    private entries: Entry[] = [];
    private fs: FileAdapter;

    constructor(id: string) {
        this.id = id;
        this.fs = FsFileAdapter.getInstace();
    }

    addEntry(entry: Entry): void {
        this.entries.push(entry);
    }

    getEntries(): Entry[] {
        return this.entries;
    }

    createTreeHash(entries: EntryType<number>[]) {
        console.log(entries);
        const dirStructure = this.createCompleteStructure(entries);
        const [hash, content] = this.computeTreeHash(dirStructure, true);

        console.log(hash);
        console.log(content);

        return hash;
    }

    createCompleteStructure(arr: EntryType<number>[]) {
        const result = {};

        arr.forEach(dir => {
            const dirs = dir.path.split("/");
            let current = result;

            dirs.forEach(part => {
                if (/(\w+\.+\w+)|(^\.\w+)/.test(part)) {
                    current[part] = {
                        name: dir.path.split("/").pop(),
                        //get the mode by checking the actual file
                        mode: getFileMode(
                            this.fs.statSync(path.join(dir.path))
                        ),
                        sha1: dir.sha1
                    };
                } else {
                    //should chack if the entry actual file path
                    if (this.fs.existsSync(path.join(dir.path))) {
                        current[part] = current[part] || {};
                        current = current[part];
                    }
                }
            });
        });

        return result;
    }
    combineHashes(hashes: Buffer[]) {
        const entriesBuffer = Buffer.concat(hashes);

        const treeHeader = Buffer.from(
            `tree ${Buffer.byteLength(entriesBuffer)}\0`
        );
        const treeContent = Buffer.concat([treeHeader, entriesBuffer]);

        const treeHash = crypto
            .createHash("sha1")
            .update(treeContent)
            .digest("hex");

        return treeHash;
    }

    computeTreeHash(
        dirTree: {
            [key: string]: { name: string; mode: number; sha1: string } | any;
        },
        isRoot: boolean = false
    ) {
        let hashes = [];

        for (let entry in dirTree) {
            if (dirTree[entry].name) {
                hashes.push(
                    Buffer.concat([
                        Buffer.from(
                            `${dirTree[entry].mode} ${dirTree[entry].name
                                .split("/")
                                .pop()}\0`
                        ),
                        Buffer.from(dirTree[entry].sha1, "hex")
                    ])
                );
            } else {
                const subDirHash = this.computeTreeHash(dirTree[entry]);
                hashes.push(subDirHash);
            }
        }

        hashes = hashes.map((entr, index) => {
            if (
                !/(\w+\.+\w+)|(^\.\w+)/.test(Object.entries(dirTree)[index][0])
            ) {
                return Buffer.concat([
                    Buffer.from(`40000 ${Object.entries(dirTree)[index][0]}\0`),
                    Buffer.from(entr, "hex")
                ]);
            } else return entr;
        });

        const directoryHash = this.combineHashes(hashes);
        return isRoot ? [directoryHash, hashes] : directoryHash;
    }

    parseTree(
        treeSh1: string,
        entryList: { mode: string; fileName: string; sha1: string }[] = [],
        nesteDir: string[] = []
    ) {
        const treeDir = treeSh1.slice(0, 2);
        const treeFile = treeSh1.slice(2);

        const treePath = `.git/objects/${treeDir}/${treeFile}`;
        const treeContent = this.fs.readFileSync(treePath);

        const unCompressTree = zlib.unzipSync(treeContent);

        const nullByte = unCompressTree.indexOf("\0");

        let entries = unCompressTree.slice(nullByte + 1);

        //let entryList = [];

        while (entries.length) {
            const [mode, fileName] = entries
                .slice(0, entries.indexOf("\x00"))
                .toString()
                .split(" ");
            entries = entries.slice(entries.indexOf("\x00") + 1);
            const sha1 = entries.slice(0, 20);

            const entLen = entries.indexOf("\x00") + 22;
            if (mode == "40000")
                entryList = [
                    ...entryList,
                    ...this.parseTree(sha1.toString("hex"), [], [
                        ...nesteDir,
                        fileName
                    ])
                ];
            else
                entryList.push({
                    mode,
                    fileName:
                        (!nesteDir.length ? "" : `${nesteDir.join("/")}/`) +
                        fileName,
                    sha1: sha1.toString("hex")
                });

            entries = entries.slice(20);
        }

        return entryList;
    }
}
