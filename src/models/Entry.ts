import { convertTo12Bit } from "../utils/utils";
import { EntryType } from "../types";

export class Entry {
    ctime_s: number; // seconds since epoch
    ctime_n: number; // nanoseconds since epoch
    mtime_s: number; // seconds since epoch
    mtime_n: number; // nanoseconds since epoch
    dev: number; // device number
    ino: number; // inode number
    mode: number | string; // file mode
    uid: number; // user ID
    gid: number; // group ID
    size: number; // file size in bytes
    flags: number; // flags (e.g. submodule, symlink)
    sha1: string; // SHA-1 hash of file contents
    path: string; // path from root

    constructor(
        ctime_s: number,
        ctime_n: number,
        mtime_s: number,
        mtime_n: number,
        dev: number,
        ino: number,
        mode: number | string,
        uid: number,
        gid: number,
        size: number,
        flags: number,
        sha1: string,
        path: string
    ) {
        this.ctime_s = ctime_s;
        this.ctime_n = ctime_n;
        this.mtime_s = mtime_s;
        this.mtime_n = mtime_n;
        this.dev = dev;
        this.ino = ino;
        this.mode = mode;
        this.uid = uid;
        this.gid = gid;
        this.size = size;
        this.flags = flags;
        this.sha1 = sha1;
        this.path = path;
    }

    getWritebleEntry(): EntryType<Buffer, Buffer> {
        const flag = Buffer.alloc(2);
        const ctime_s_buf = Buffer.alloc(4);
        const ctime_n_buf = Buffer.alloc(4);
        const mtime_s_buf = Buffer.alloc(4);
        const mtime_n_buf = Buffer.alloc(4);
        const dev_buf = Buffer.alloc(4);
        const ino_buf = Buffer.alloc(4);
        const mode_buf = Buffer.alloc(4);
        const uid_buf = Buffer.alloc(4);
        const gid_buf = Buffer.alloc(4);
        const size_buf = Buffer.alloc(4);

        ctime_s_buf.writeUInt32BE(this.ctime_s);
        ctime_n_buf.writeUInt32BE(this.ctime_n);
        mtime_s_buf.writeUInt32BE(this.mtime_s);
        mtime_n_buf.writeUInt32BE(this.mtime_n);
        dev_buf.writeUInt32BE(this.dev);
        ino_buf.writeUInt32BE(this.ino);
        mode_buf.writeUInt32BE(this.mode);
        uid_buf.writeUInt32BE(this.uid);
        gid_buf.writeUInt32BE(this.gid);
        size_buf.writeUInt32BE(this.size);

        flag.writeUInt16BE(convertTo12Bit(this.path.length), 0);

        console.log(this.getEntrySize());

        return {
            ctime_s: ctime_s_buf,
            ctime_n: ctime_n_buf,
            mtime_s: mtime_s_buf,
            mtime_n: mtime_n_buf,
            dev: dev_buf,
            ino: ino_buf,
            mode: mode_buf,
            uid: uid_buf,
            gid: gid_buf,
            size: size_buf,
            sha1: Buffer.from(this.sha1, "hex"),
            flags: Buffer.concat([flag]),
            path: Buffer.concat([
                Buffer.from(this.path, "utf-8"),
                Buffer.from("\x00", "utf-8")
            ])
            //padding: Buffer.alloc(this.getEntrySize().padding, 0)
        };
    }

    getEntrySize() {
        const pathLength = Buffer.concat([
            Buffer.from(this.path, "utf-8"),
            Buffer.from("\x00", "utf-8")
        ]).length;
        const entrySize = 62 + pathLength;

        const padding = (8 - (entrySize % 8)) % 8;

        return {
            total: entrySize + padding,
            entrySize,
            padding
        };
    }

    getName(): string {
        return this.path;
    }

    getMode(): Buffer | number {
        return this.mode;
    }

    getHash(): string {
        return this.sha1;
    }
}
