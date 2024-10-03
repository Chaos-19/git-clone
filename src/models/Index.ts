import crypto from "crypto";

import { FileAdapter, FsFileAdapter } from "../adapters/FsFileAdapter";
import { Entry } from "./Entry";
import { EntryType } from "../types";

export class Index {
    private entries: Entry[] = [];
    private fs: FileAdapter;

    constructor() {
        this.fs = FsFileAdapter.getInstace();
    }

    initIndex() {}

    addEntry(entry: Entry): void {
        this.entries.push(entry);
    }

    getEntries(): Entry[] {
        return this.entries;
    }
    entryExists(filePath: string): boolean {
        return this.readIndex().some(
            entry => entry.path.toString() == filePath
        );
    }
    readIndex(): EntryType<number, Buffer>[] {
        const data = this.fs.readFileSync(".git/index");

        const [signature, versionNumber, entriyCount] = [0, 4, 8].map(
            (offset, _) => data.readUInt32BE(offset)
        );

        const entries: EntryType<number, Buffer>[] = [];

        const entriyData = data.slice(12, -20);
        let i = 0;

        const getEntry = (
            entry: Buffer,
            path: Buffer
        ): EntryType<number, Buffer> => ({
            ctime_s: entry.readUInt32BE(0),
            ctime_n: entry.readUInt32BE(4),
            mtime_s: entry.readUInt32BE(8),
            mtime_n: entry.readUInt32BE(12),
            dev: entry.readUInt32BE(16),
            ino: entry.readUInt32BE(20),
            mode: entry.readUInt32BE(24),
            uid: entry.readUInt32BE(28),
            gid: entry.readUInt32BE(32),
            size: entry.readUInt32BE(36),
            sha1: entry.toString("hex", 40, 60),
            flags: entry.readUInt16BE(60),
            path
        });

        while (i + 62 < entriyData.length) {
            const fieldsEnd = i + 62;
            const fields = entriyData.slice(i, fieldsEnd);
            const pathEnd = entriyData.indexOf("\x00", fieldsEnd);
            const path = entriyData.slice(fieldsEnd, pathEnd);
            entries.push(getEntry(fields, path));

            const entryLen = Math.trunc((62 + path.length + 8) / 8) * 8;
            i += entryLen;
        }

        /*console.log({
            signature: data.toString("ascii", 0, 4),
            versionNumber,
            entriyCount
        });*/

        return entries;
    }

    getIndexHeader(entriesCount: number) {
        const signature = Buffer.from("DIRC", "utf-8");
        const version = Buffer.alloc(4);
        version.writeUInt32BE(2, 0);
        const numEntries = Buffer.alloc(4);
        numEntries.writeUInt32BE(entriesCount, 0);

        return Buffer.concat([signature, version, numEntries]);
    }

    writeToIndexFile(entries: EntryType<Buffer, Buffer>[]) {
        let indexContent = this.getIndexHeader(entries.length);

        entries.forEach(entry => {
            if (!this.entryExists(entry.path.toString())) {
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

                const padding =
                    Math.trunc((62 + entry.path.length + 8) / 8) * 8;

                // Create padding buffer
                const paddingBuffer = Buffer.alloc(
                    padding - (entry.path.length + 62),
                    0
                );

                const entryBuffer = Buffer.concat([
                    fields,
                    entry.path,
                    paddingBuffer
                ]);

                indexContent = Buffer.concat([indexContent, entryBuffer]);
            }
        });

        const indexSHA = crypto
            .createHash("sha1")
            .update(indexContent)
            .digest();

        const finalIndexContent = Buffer.concat([indexContent, indexSHA]);

        this.fs.writeFileSync(".git/index", finalIndexContent);
    }
}
