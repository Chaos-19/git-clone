import crypto from "crypto";
import zlib from "zlib";
//import path from "path";

import { FileAdapter, FsFileAdapter } from "../adapters/FsFileAdapter";

type OBJTYPE = "commit" | "blob" | "tree";

export class Common {
    fs: FileAdapter; // = FsFileAdapter.getInstace();

    constructor() {
        this.fs = FsFileAdapter.getInstace();
    }

    //return the hash SHA1
    hashObjct(data: Buffer, type: OBJTYPE, write: boolean = true): string {
        const size = Buffer.byteLength(data);
        const header = Buffer.from(`${type} ${size}\0`, "utf8");

        const objContent = Buffer.concat([header, data]);

        const SHA1 = crypto.createHash("sha1").update(objContent).digest("hex");

        if (write) {
            const dirPath = `.git/objects/${SHA1.slice(0, 2)}`;
            const path = `.git/objects/${SHA1.slice(0, 2)}/${SHA1.slice(2)}`;
            if (!this.fs.existsSync(dirPath))
                this.fs.mkdirSync(dirPath, {
                    recursive: true
                });
            this.fs.writeFileSync(path, zlib.deflateSync(objContent));
        }
        return SHA1;
    }
}
