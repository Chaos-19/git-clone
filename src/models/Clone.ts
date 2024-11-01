import { Common, OBJTYPE } from "./Common";
import zlib, { createInflate } from "zlib";
import crypto from "crypto";
import { PassThrough, pipeline } from "stream";

import path from "path";
import { readFile } from "fs/promises";

import { Tree } from "./Tree";
import { Index } from "./Index";
import { Entry } from "./Entry";
import { EntryType } from "../types";
import { convertTimeToGit, getFileMode, convertTo12Bit } from "../utils/utils";

const OBJTYPE = {
    1: "OBJ_COMMIT",
    2: "OBJ_TREE",
    3: "OBJ_BLOB",
    4: "OBJ_TAG",
    6: "OBJ_OFS_DELTA",
    7: "OBJ_REF_DELTA"
};

const GITOBJS = ["commit", "tree", "blob", "tag"];

type RefType = {
    ref: string;
    hash: string;
};

type UNPACKEDOBJTYPE = {
    sha1?: string;
    content: Buffer;
    baseRef?: string;
    type: OBJTYPE;
};

class Clone extends Common {
    url: string;
    pattern: RegExp = /^(https:\/\/github\.com\/)([\w\-.]+)\/([\w\-.]+)\.git$/;
    refList: string[] = [];

    constructor(url: string, ROOT_DIR: string = "") {
        super(ROOT_DIR);
        if (!this.pattern.test(url))
            throw new Error("The URL is not a valid GitHub repository");

        this.url = url;
    }

    async getAvalableRefFromServer() {
        const respons = await fetch(
            `${this.url}/info/refs?service=git-upload-pack`
        );

        if (!respons.ok) {
            throw new Error("");
            return;
        }

        const result = await respons.text();
        return result;
    }

    async getPackFile(refHash: string) {
        const respons = await fetch(`${this.url}/git-upload-pack`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-git-upload-pack-request",
                "accept-encoding": "gzip,deflate"
            },
            body: Buffer.from(`0032want ${refHash}\n00000009done\n`, "utf8")
        });

        if (!respons.ok) {
            throw new Error("");
            return;
        }

        const result = await respons.arrayBuffer();
        return result;
    }

    async extractRefHash(
        input: string,
        head = true
    ): Promise<RefType | { refs: RefType[]; head: string }> {
        const regex =
            /(\s?[0-9a-fA-F]{4})([0-9a-fA-F]{40})(\srefs[/\w+-/\w+/]+|\sHEAD)/gm;

        const refs = [...input.matchAll(regex)].map(([, , ...res]) => ({
            ref: res.pop(),
            hash: res.pop()
        }));

        return head
            ? refs.find(
                  refInfo =>
                      refInfo.ref.trim() === "refs/heads/main" ||
                      refInfo.ref.trim() === "refs/heads/master"
                  //|| refInfo.ref.trim() === "HEAD"
              )
            : {
                  refs,
                  head: input
                      .match(/\b(symref=HEAD:refs\/heads\/\w+)\b/g)
                      .join()
              };
    }

    createRefs({ refs, head }: { refs: RefType[]; head: string }): void {
        const currentBranch = refs.find(
            refInfo =>
                refInfo.ref.trim() == "HEAD" ||
                refInfo.ref.trim() === "refs/heads/main" ||
                refInfo.ref.trim() === "refs/heads/master"
        );

        const HEAD = {
            ...currentBranch,
            hash: `ref: ${head.split(":").pop().trim()}`,
            filePath: `refs/remotes/origin/HEAD`,
            dirPath: `refs/remotes/origin`
        };

        if (!this.fs.existsSync(`${this.ROOT_DIR}/.git/refs/heads`))
            this.fs.mkdirSync(`${this.ROOT_DIR}/.git/refs/heads`, {
                recursive: true
            });

        this.fs.writeFileSync(
            `${this.ROOT_DIR}/.git/refs/heads/${head.split("/").pop()}`,
            currentBranch.hash
        );

        this.fs.writeFileSync(`${this.ROOT_DIR}/.git/HEAD`, HEAD.hash);

        const pull = refs
            .filter(ref => ref.ref.split("/").includes("pull"))
            .map(ref => ({
                ...ref,
                filePath: ref.ref.trim(),
                dirPath: ref.ref
                    .trim()
                    .replace(`/${ref.ref.split("/").pop()}`, "")
            }));

        const tags = refs
            .filter(ref => ref.ref.split("/").includes("tags"))
            .map(ref => ({
                ...ref,
                filePath: ref.ref.trim(),
                dirPath: ref.ref
                    .trim()
                    .replace(`/${ref.ref.split("/").pop()}`, "")
            }));

        const remotes = refs
            .filter(ref => ref.ref.split("/").includes("heads"))
            .map(ref => ({
                ...ref,
                filePath: `refs/remotes/origin/${ref.ref.split("/").pop()}`,
                dirPath: `refs/remotes/origin`
            }));

        [...pull, ...remotes, ...tags, HEAD].forEach(ref => {
            if (!this.fs.existsSync(this.ROOT_DIR + `/.git/${ref.dirPath}`))
                this.fs.mkdirSync(this.ROOT_DIR + `/.git/${ref.dirPath}`, {
                    recursive: true
                });
            this.fs.writeFileSync(
                this.ROOT_DIR + `.git/${ref.filePath}`,
                ref.hash
            );
        });
    }

    async parsePackFile(packeFile: Buffer) {
        const magicHeader = packeFile.slice(0, 16);

        const objectLength = packeFile.readUInt32BE(16); //packeFile.readUInt32BE(8);
        console.log(objectLength);
        const packedObject = packeFile.slice(20);

        const unpackedObject = [];

        let readOffset = 0;

        for (let index = 0; index < objectLength; index++) {
            let { parsedBytes, type, size } = this.parsePackObjectHeader(
                packedObject,
                readOffset
            );

            readOffset += parsedBytes;

            if (
                ["OBJ_COMMIT", "OBJ_TREE", "OBJ_BLOB", "OBJ_TAG"].includes(
                    OBJTYPE[type]
                )
            ) {
                const { decompressedData, parsedBytes: actualSize } =
                    await this.inflateWithLengthLimit(
                        packedObject.slice(readOffset),
                        size
                    );

                //console.log(decompressedData.toString());

                readOffset += actualSize;

                unpackedObject.push({
                    sha1: this.hashObject(
                        decompressedData,
                        <OBJTYPE>GITOBJS[type - 1]
                        //false
                    ),
                    type: <OBJTYPE>GITOBJS[type - 1],
                    content: decompressedData
                });
            } else if (type == 7) {
                const baseRef = packedObject
                    .slice(readOffset, readOffset + 20)
                    .toString("hex");

                readOffset += 20;

                const { decompressedData, parsedBytes: actualSize } =
                    await this.inflateWithLengthLimit(
                        packedObject.slice(readOffset),
                        size
                    );

                readOffset += actualSize;

                unpackedObject.push({
                    baseRef,
                    type: OBJTYPE[type],
                    content: decompressedData
                });
            }
        }

        return unpackedObject;
    }

    parsePackObjectHeader(
        packedObj: Buffer,
        readPosition: number
    ): {
        parsedBytes: number;
        type: number;
        size: number;
    } {
        let current = readPosition;
        const type = (packedObj[current] & 112) >> 4;
        let size = packedObj[current] & 15; // 00001111
        let left = 4;

        while (packedObj[current] & 0x80) {
            current++;
            size |= (packedObj[current] & 127) << left;
            left += 7;
        }
        return {
            parsedBytes: current - readPosition + 1,
            type,
            size
        };
    }

    inflateWithLengthLimit(
        compressedData: Buffer,
        maxOutputSize: number
    ): Promise<{
        decompressedData: Buffer;
        parsedBytes: number;
    }> {
        return new Promise<{ decompressedData: Buffer; parsedBytes: number }>(
            (resolve, reject) => {
                const inflater = createInflate();
                let decompressedData = Buffer.alloc(0);
                let parsedBytes = 0;

                inflater.on("data", chunk => {
                    decompressedData = Buffer.concat([decompressedData, chunk]);
                    if (decompressedData.length > maxOutputSize) {
                        inflater.destroy(
                            new Error(
                                "Decompressed data exceeds maximum output size"
                            )
                        );
                    }
                });

                inflater.on("end", () => {
                    parsedBytes = inflater.bytesWritten; //inflater.bytesRead;
                    resolve({ decompressedData, parsedBytes });
                });

                inflater.on("error", err => {
                    reject(err);
                });

                // Create a stream from the compressed data
                const inputStream = new PassThrough();
                inputStream.end(compressedData);

                // Use pipeline to stream data through inflater
                pipeline(inputStream, inflater, err => {
                    if (err) {
                        reject(err);
                    }
                });
            }
        );
    }

    async resolveDeltaObjects(
        deltaobjects: UNPACKEDOBJTYPE[],
        unpckedObjects: UNPACKEDOBJTYPE[],
        result: UNPACKEDOBJTYPE[] = []
    ) {
        let pendings = [];

        for (let delta of deltaobjects) {
            const baseExist = [
                ...new Set([...unpckedObjects, ...result])
            ].filter(value => value.sha1 == delta.baseRef);

            if (!baseExist.length) {
                pendings.push(delta);
            } else {
                const baseObj = [
                    ...new Set([...unpckedObjects, ...result])
                ].filter(value => value.sha1 == delta.baseRef)[0];

                let resolveDelta = Buffer.alloc(0);

                const instructions = delta.content;
                let currentPosition = 0;

                const { sourceLength, targetLength, offset } =
                    this.decodeDeltaHeader(instructions);

                currentPosition += offset;

                while (currentPosition < instructions.length) {
                    if (instructions[currentPosition] <= 127) {
                        const {
                            parsedBytes,
                            offset: offseInsert,
                            size
                        } = this.parseInsert(instructions, currentPosition);

                        resolveDelta = Buffer.concat([
                            resolveDelta,
                            instructions.slice(offseInsert, offseInsert + size)
                        ]);

                        currentPosition += parsedBytes + size;
                    } else if (
                        instructions[currentPosition] > 127 &&
                        instructions[currentPosition] < 256
                    ) {
                        const {
                            parsedBytes,
                            offset: offsetCopy,
                            size
                        } = this.parseCopy(instructions, currentPosition);

                        resolveDelta = Buffer.concat([
                            resolveDelta,
                            baseObj.content.slice(offsetCopy, offsetCopy + size)
                        ]);

                        currentPosition += parsedBytes;
                    }
                }

                result.push({
                    sha1: this.hashObject(
                        resolveDelta,
                        baseObj.type
                        //false
                    ),
                    content: resolveDelta,
                    type: baseObj.type
                });
            }
        }

        if (pendings.length > 0) {
            console.log(pendings.length, result.length);

            const newResult = await this.resolveDeltaObjects(
                pendings,
                unpckedObjects,
                [...new Set([...unpckedObjects, ...result])]
            );
            result = [...result, ...newResult];
        }

        return [...unpckedObjects, ...result];
    }

    decodeDeltaHeader(instractions: Buffer) {
        let offset = 0;

        // Read the source length
        const { length: sourceLength, bytesRead: sourceBytes } =
            this.readVariableLengthInt(instractions, offset);
        offset += sourceBytes;

        // Read the target length
        const { length: targetLength, bytesRead: targetBytes } =
            this.readVariableLengthInt(instractions, offset);
        offset += targetBytes;

        return {
            sourceLength,
            targetLength,
            offset
        };
    }
    readVariableLengthInt(instractions, offset = 0) {
        let length = 0;
        let shift = 0;
        let bytesRead = 0;

        while (true) {
            if (offset >= instractions.length) {
                throw new Error(
                    "Unexpected end of buffer while reading variable-length integer."
                );
            }

            const byte = instractions[offset++];
            bytesRead++;

            // Mask out the MSB and add the lower 7 bits to the length
            length = length | ((byte & 0x7f) << shift);

            // If the MSB is not set, we are done
            if ((byte & 0x80) === 0) {
                break;
            }

            // Otherwise, move to the next 7 bits
            shift += 7;
        }

        return {
            length,
            bytesRead
        };
    }

    parseCopy(
        data: Buffer,
        offset: number
    ): {
        parsedBytes: number;
        offset: number;
        size: number;
    } {
        const mask = data[offset]; // The mask byte indicates which offset/size bytes are set
        let parsedBytes = 1; // Track the number of bytes read
        offset++; // Move past the mask byte

        // Arrays to hold the bytes for offset and size calculations
        let offsetBytes = [];
        let sizeBytes = [];

        // Read offset bytes based on bits 0-3 of the mask
        for (let i = 0; i < 4; i++) {
            // First 4 bits for offset
            if (mask & (1 << i)) {
                offsetBytes.push(data[offset]);
                offset++;
                parsedBytes++;
            } else {
                offsetBytes.push(0); // If bit not set, assume zero for this byte
            }
        }

        // Read size bytes based on bits 4-6 of the mask
        for (let i = 4; i < 7; i++) {
            // Next 3 bits for size
            if (mask & (1 << i)) {
                sizeBytes.push(data[offset]);
                offset++;
                parsedBytes++;
            } else {
                sizeBytes.push(0); // If bit not set, assume zero for this byte
            }
        }

        // Calculate the actual offset value from the bytes (little-endian order)
        let offsetValue = offsetBytes.reduce(
            (acc, byte, index) => acc + (byte << (index * 8)),
            0
        );

        // Calculate the actual size value from the bytes (little-endian order)
        let sizeValue = sizeBytes.reduce(
            (acc, byte, index) => acc + (byte << (index * 8)),
            0
        );

        // Special case: if size is zero, it means copy 0x10000 (65536) bytes
        if (sizeValue === 0) {
            sizeValue = 0x10000;
        }

        return { parsedBytes, offset: offsetValue, size: sizeValue };
    }

    parseInsert(
        data: Buffer,
        offset: number
    ): {
        parsedBytes: number;
        offset: number;
        size: number;
    } {
        const size = data[offset];
        const parsedBytes = 1;
        return { parsedBytes, offset: offset + parsedBytes, size };
    }

    checkOut(unpackedObject: UNPACKEDOBJTYPE[]) {
        let headCommitSHA1 = "";
        let headCommitTreeSHA1 = "";
        if (this.fs.existsSync(`${this.ROOT_DIR}.git/HEAD`)) {
            const currentHead = this.fs
                .readFileSync(this.ROOT_DIR + `.git/HEAD`)
                .toString()
                .split("/")
                .pop();

            headCommitSHA1 = this.fs
                .readFileSync(this.ROOT_DIR + `.git/refs/heads/${currentHead}`)
                .toString();
        }

        if (headCommitSHA1) {
            headCommitTreeSHA1 = unpackedObject
                .find(obj => obj.sha1 == headCommitSHA1)
                ?.content.toString()
                .match(/tree\s[0-9a-fA-F]{40}/g)
                .join("")
                .split(" ")
                .pop();
            const parsedTree = this.parseTree(headCommitTreeSHA1);

            parsedTree.forEach(entry => {
                const path = entry.path.split("/");
                const fileName = path.pop();
                const dir = path;

                if (!dir.length) {
                    this.fs.writeFileSync(
                        `${this.ROOT_DIR}${fileName}`,
                        unpackedObject
                            .find(obj => obj.sha1 == entry.sha1)
                            .content.toString()
                    );
                } else {
                    if (!this.fs.existsSync(`${this.ROOT_DIR}${dir.join("/")}`))
                        this.fs.mkdirSync(`${this.ROOT_DIR}${dir.join("/")}`, {
                            recursive: true
                        });
                    this.fs.writeFileSync(
                        `${this.ROOT_DIR}${entry.path}`,
                        unpackedObject
                            .find(obj => obj.sha1 == entry.sha1)
                            .content.toString()
                    );
                }
            });

            const entryListForIndex = parsedTree
                .sort((a, b) => a.path.localeCompare(b.path))
                .map(entry => {
                    const currentEntry = unpackedObject.find(
                        obj => obj.sha1 == entry.sha1
                    );
                    console.log(parsedTree);
                    if (!currentEntry) throw new Error("Entry Not Found!!");

                    const state = this.fs.statSync(
                        `${this.ROOT_DIR}${entry.path}`
                    );

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

                    const { ctime_s, ctime_n, mtime_s, mtime_n } =
                        convertTimeToGit({
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
                        mode,
                        uid,
                        gid,
                        size,
                        entry.path.length,
                        entry.sha1,
                        entry.path
                    );

                    return newEntry.getWritebleEntry();
                });

            this.writeToIndexFile([entryListForIndex[0]]);
        }
    }
    getIndexHeader(entriesCount: number) {
        const signature = Buffer.from("DIRC", "utf8");
        const version = Buffer.alloc(4);
        version.writeUInt32BE(2, 0);
        const numEntries = Buffer.alloc(4);
        numEntries.writeUInt32BE(entriesCount, 0);

        return Buffer.concat([signature, version, numEntries]);
    }
    writeToIndexFile(entries: EntryType<Buffer, Buffer>[]) {
        let indexContent = this.getIndexHeader(entries.length);

        entries.forEach(entry => {
            //console.log(entry.flags);
            const fields = Buffer.concat([
                entry.ctime_s,
                entry.ctime_n,
                entry.mtime_s,
                entry.mtime_n,
                entry.dev,
                entry.ino,
                entry.mode,
                entry.uid,
                entry.gid,
                entry.size,
                entry.sha1,
                entry.flags
            ]);

            const padding = 8 - ((entry.path.length - 2) % 8);
            /*Math.trunc(
                (8 - ((entry.path.length + 62) % 8)) % 8
            );*/

            //Math.ceil((62 + bpath.length + 1) / 8) * 8

            // Create padding buffer
            const paddingBuffer = Buffer.alloc(padding, 0);

            const entryBuffer = Buffer.concat([
                fields,
                entry.path,
                paddingBuffer
            ]);

            indexContent = Buffer.concat([indexContent, entryBuffer]);
            //return entryBuffer;
        });

        //indexContent = Buffer.concat([indexContent, allEntry]);

        const indexSHA = crypto
            .createHash("sha1")
            .update(indexContent)
            .digest();

        const finalIndexContent = Buffer.concat([indexContent, indexSHA]);

        this.fs.writeFileSync(`${this.ROOT_DIR}.git/index`, finalIndexContent);
    }

    parseTree(
        treeSh1: string,
        entryList: {
            mode: number;
            path: string;
            sha1: string;
        }[] = [],
        nesteDir: string[] = []
    ) {
        const treeDir = treeSh1.slice(0, 2);
        const treeFile = treeSh1.slice(2);

        const treePath = `${this.ROOT_DIR}.git/objects/${treeDir}/${treeFile}`;
        const treeContent = this.fs.readFileSync(treePath);

        const unCompressTree = zlib.unzipSync(treeContent);

        const nullByte = unCompressTree.indexOf("\0");

        let entries = unCompressTree.slice(nullByte + 1);

        while (entries.length) {
            const [mode, fileName] = entries
                .slice(0, entries.indexOf("\x00"))
                .toString()
                .split(" ");
            entries = entries.slice(entries.indexOf("\x00") + 1);
            const sha1 = entries.slice(0, 20);

            if (mode == "40000")
                entryList = [
                    ...entryList,
                    ...this.parseTree(
                        sha1.toString("hex"),
                        [],
                        [...nesteDir, fileName]
                    )
                ];
            else
                entryList.push({
                    mode: parseInt(mode),
                    path:
                        (!nesteDir.length ? "" : `${nesteDir.join("/")}/`) +
                        fileName,
                    sha1: sha1.toString("hex")
                });

            entries = entries.slice(20);
        }

        return entryList;
    }

    async fetchPack() {
        return await readFile(path.join("test", "AngularBlogApp.pack"));
        //return await readFile(path.join(__dirname, "AngularBlogApp.pack"))
    }

    cloneRepo() {
        /*this.getAvalableRefFromServer()
            .then(ref => {
            this.createRefs(ref as {
            refs: RefType[]; head: string 
              
            })
            return this.extractRefHash(ref)
            })
            .then(({ ref, hash }: { ref: string; hash: string }) =>
                this.getPackFile(hash)
            )*/
        this.fetchPack()
            .then(res => this.parsePackFile(Buffer.from(res)))
            .then(unpacked => {
                const deltas = unpacked.filter(v => v?.type == "OBJ_REF_DELTA");
                const objUNPacked = unpacked.filter(
                    v => v?.type !== "OBJ_REF_DELTA"
                );
                return this.resolveDeltaObjects(deltas, objUNPacked);
            })
            .then(resolv => {
                console.log(
                    resolv.map(value => ({
                        ...value,
                        content: ""
                    })).length
                );

                return this.checkOut(resolv);
            })
            .catch(error => console.log(error));
    }
}

const cloneFun = new Clone(
    "https://github.com/Chaos-19/json-graph-acode.git",
    "GIT_DIR"
);

cloneFun.cloneRepo();
cloneFun
    .extractRefHash(
        `001e# service=git-upload-pack
000001532c221913c1ae3954021962833974ff58a9a8d623 HEAD multi_ack thin-pack side-band side-band-64k ofs-delta shallow deepen-since deepen-not deepen-relative no-progress include-tag multi_ack_detailed allow-tip-sha1-in-want allow-reachable-sha1-in-want no-done symref=HEAD:refs/heads/main filter object-format=sha1 agent=git/github-dd2ba9052dea
004183c16c998652f770d6c4ea38ec8bfcd02c5cb716 refs/heads/gh-pages
003d2c221913c1ae3954021962833974ff58a9a8d623 refs/heads/main
0000`,
        false
    )
    .then(res => cloneFun.createRefs(res as { refs: RefType[]; head: string }));

/*const { FsFileAdapter } = require("../adapters/FsFileAdapter");
const fileAdapter: typeof FsFileAdapter = FsFileAdapter.getInstace();
const index = new Index();
console.log();
fileAdapter.writeFileSync(
    "str.test.json",
    JSON.stringify(
        index.readIndex().map(val => ({
            path: val.path.toString(),
            sha1: val.sha1,
            exist: fileAdapter.existsSync(
                `./GIT_DIR/.git/objects/${val.sha1.slice(
                    0,
                    2
                )}/${val.sha1.slice(2)}`
            )
        }))
    )
);
*/
