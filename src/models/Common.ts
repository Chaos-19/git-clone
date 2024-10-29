import crypto from "crypto";
import zlib from "zlib";
//import path from "path";

import { FileAdapter, FsFileAdapter } from "../adapters/FsFileAdapter";

export type OBJTYPE = "commit" | "blob" | "tree" | "tag";

export class Common {
    fs: FileAdapter; // = FsFileAdapter.getInstace();
    ROOT_DIR:string

    constructor(ROOT_DIR:string="") {
        this.fs = FsFileAdapter.getInstace();
        this.ROOT_DIR = Boolean(ROOT_DIR)?`./${ROOT_DIR}/`:``
    }

    //return the hash SHA1
    hashObject(data: Buffer, type: OBJTYPE, write: boolean = true): string {
        const size = Buffer.byteLength(data);
        const header = Buffer.from(`${type} ${size}\0`, "utf8");

        const objContent = Buffer.concat([header, data]);

        const SHA1 = crypto.createHash("sha1").update(objContent).digest("hex");

        if (write) {
            const dirPath = `${this.ROOT_DIR}.git/objects/${SHA1.slice(0, 2)}`;
            
            const path = `${this.ROOT_DIR}.git/objects/${SHA1.slice(0, 2)}/${SHA1.slice(2)}`;
            if (!this.fs.existsSync(dirPath))
                this.fs.mkdirSync(dirPath, {
                    recursive: true
                });
            this.fs.writeFileSync(path, zlib.deflateSync(objContent));
        }
        return SHA1;
    }
}
