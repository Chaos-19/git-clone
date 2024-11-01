import { convertTo12Bit } from "../utils/utils";
import { EntryType } from "../types";

export class Entry {
    ctime_s: number; // seconds since epoch
    ctime_n: number; // nanoseconds since epoch
    mtime_s: number; // seconds since epoch
    mtime_n: number; // nanoseconds since epoch
    dev: number; // device number
    ino: number; // inode number
    mode: number; // file mode
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
        mode: number,
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

        const pathLength = Buffer.from(this.path, "utf-8").length;
        const pathFlag = pathLength >= 0xfff ? 0xfff : pathLength;
        flag.writeUInt16BE(0 | 0 | pathFlag);

        //console.log(this.getEntrySize());

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
            flags: flag,
            path: Buffer.concat([
                Buffer.from(this.path, "utf-8"),
                Buffer.from("\0")
            ])
            //padding: Buffer.alloc(this.getEntrySize().padding, 0)
        };
    }

    getEntrySize() {
        const pathLength = Buffer.concat([
            Buffer.from(this.path, "utf-8"),
            Buffer.from("\x00")
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
/*
import { convertTo12Bit } from "../utils/utils";
import { EntryType } from "../types";

enum GitObjectType {
    Regular = 8, // 1000 in octal
    SymLink = 10, // 1010 in octal
    GitLink = 14 // 1110 in octal
}

export class Entry {
    ctime_s: number; // seconds since epoch
    ctime_n: number; // nanoseconds since epoch
    mtime_s: number; // seconds since epoch
    mtime_n: number; // nanoseconds since epoch
    dev: number; // device number
    ino: number; // inode number
    mode: number; // file mode
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
        mode: number,
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
        mode_buf.writeUInt32BE(this.toMode(this.mode, this.mode));
        uid_buf.writeUInt32BE(this.uid);
        gid_buf.writeUInt32BE(this.gid);
        size_buf.writeUInt32BE(this.size);

        flag.writeUInt16BE(convertTo12Bit(this.path.length));

        //console.log(this.getEntrySize());

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
            flags: flag,
            path: Buffer.from(`${this.path}\x00`, "utf-8")
            //padding: Buffer.alloc(this.getEntrySize().padding, 0)
        };
    }

    getEntrySize() {
        const pathLength = Buffer.concat([
            Buffer.from(this.path, "utf-8"),
            Buffer.from("\x00")
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

    toMode(fileMode: number, entry: number): number {
        const objectType = this.getObjectType(fileMode);
        return (objectType << 12) | this.getPermissions(fileMode, entry);
    }

    // Determine object type based on file mode
    getObjectType(fileMode: number): number {
        switch (fileMode) {
            case GitObjectType.Regular:
                return 8;
            case GitObjectType.SymLink:
                return 10;
            case GitObjectType.GitLink:
                return 14;
            default:
                return 0;
        }
    }

    // Get permissions for regular files (other types default to 0)
    getPermissions(fileMode: number, entry: number): number {
        if (fileMode === GitObjectType.Regular) {
            return entry;
        }
        return 0;
    }
}

*/
