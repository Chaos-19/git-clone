import fs from "fs";
import zlib from "zlib";
import crypto from "crypto";
import * as pathN from "path";

const args = process.argv.slice(2);
const command = args[0];

enum Commands {
    Init = "init",
    Catfile = "cat-file",
    HashObject = "hash-object",
    Lstree = "ls-tree",
    writeTree = "write-tree",
    readIndex = "read-index",
    writeIndex = "write-index",
    add = "add"
}

switch (command) {
    case Commands.Init:
        /*
      initilazing empty git repository
      .git
      .git/objects  folder
      .git/refs     folder
      .git/HEAD     file  with ref: refs/heads/main content
    */
        fs.mkdirSync(".git", {
            recursive: true
        });
        fs.mkdirSync(".git/objects", {
            recursive: true
        });
        fs.mkdirSync(".git/refs", {
            recursive: true
        });

        fs.writeFileSync(".git/HADE", "ref: refs/heads/main\n");
        console.log("Initialized git directory");
        break;
    case Commands.Catfile:
        /*  # object stored in 40 she
      read git object and print to console
      */
        const blobDir = args[2].slice(0, 2);
        const blobFile = args[2].slice(2);

        const blobPath = `.git/objects/${blobDir}/${blobFile}`;
        const blobContent = fs.readFileSync(blobPath);

        const unCompressBlob = zlib.unzipSync(blobContent);

        const nullByte = unCompressBlob.indexOf("\0");
        const content = unCompressBlob.slice(nullByte + 1);

        process.stdout.write(content);
        break;
    case Commands.HashObject:
        const rawFileDir = args[2];

        const rawFileContent = fs.readFileSync(rawFileDir);
        const header = Buffer.from(`blob ${fs.statSync(rawFileDir).size}\0`);
        const store = Buffer.concat([header, rawFileContent]);

        const SHA = crypto.createHash("sha1").update(store).digest("hex");

        const compressBlob = zlib.deflateSync(store);

        fs.mkdirSync(`.git/objects/${SHA.slice(0, 2)}`, {
            recursive: true
        });
        const path = `.git/objects/${SHA.slice(0, 2)}/${SHA.slice(2)}`;

        fs.writeFileSync(path, compressBlob);

        process.stdout.write(SHA);
        break;
    case Commands.Lstree:
        /*  # object stored in 40 she
      read git object and print to console
      */

        const treeDir = args[2].slice(0, 2);
        const treeFile = args[2].slice(2);

        const nameOnly = args.includes("--name-only");

        const treePath = `./test/.git/objects/${treeDir}/${treeFile}`;
        const treeSHA = fs.readFileSync(treePath);

        const unCompressTree = zlib.inflateSync(treeSHA);

        const nullByteIndex = unCompressTree.indexOf("\0") + 1;
        const treeHeader = unCompressTree.slice(nullByteIndex);
        let treeList = unCompressTree.slice(nullByteIndex);

        while (treeList.length) {
            const [mode, fileName] = treeList
                .slice(0, treeList.indexOf("\x00"))
                .toString()
                .split(" ");
            treeList = treeList.slice(treeList.indexOf("\x00"));
            const sha = treeList.slice(0, 21);

            if (nameOnly) {
                process.stdout.write(fileName);
                //console.log(fileName)
            } else {
                process.stdout.write(
                    `${mode} ${
                        mode == "040000" ? "tree" : "blob"
                    }  ${sha}   ${fileName}`
                );
                //console.log(`${mode} ${mode=='040000'?'tree':'blob'}  ${sha}   ${fileName}`)
            }

            //console.log([mode,fileName,sha.toString('hex')])

            treeList = treeList.slice(21);
        }

        break;
    case Commands.writeTree:
        function traverseDir(
            dir: string,
            result: {
                fileName?: string;
                subDirName?: string;
                mode: number | string | null;
                hash?: string;
                entries?: string;
            }[] = []
        ) {
            try {
                let dirLs = fs.readdirSync(dir);

                for (let current of dirLs) {
                    if (
                        current !== "node_modules" &&
                        current !== ".git" &&
                        fs.statSync(pathN.join(dir, current)).isDirectory()
                    ) {
                        const nestedSubDir = traverseDir(
                            pathN.join(dir, current),
                            []
                        );

                        if (nestedSubDir)
                            result.push({
                                subDirName: current,
                                mode: "40000",
                                entries: hashTree(
                                    nestedSubDir.map(entry =>
                                        Buffer.concat([
                                            Buffer.from(
                                                `${entry.mode} ${
                                                    entry.fileName ??
                                                    entry?.subDirName
                                                }\0`
                                            ),
                                            Buffer.from(
                                                entry.hash
                                                    ? entry.hash
                                                    : entry.entries,
                                                "hex"
                                            )
                                        ])
                                    )
                                )
                            });
                    } else {
                        if (
                            !fs.statSync(pathN.join(dir, current)).isDirectory()
                        )
                            result.push(
                                treehashEntry(pathN.join(dir, current), current)
                            );
                    }
                }
                return result;
            } catch (e) {
                console.error(e);
            }
        }

        const treehashEntry = (path: string, fileName: string) => {
            return {
                mode: getFileMode(fs.statSync(path)),
                fileName,
                hash: hashFile(path)
            };
        };

        const hashFile = (path: string) => {
            const rawFileContent = fs.readFileSync(path);
            const header = Buffer.from(
                `blob ${fs.statSync(path).size}\0`,
                "utf-8"
            );
            const blobContent = Buffer.concat([header, rawFileContent]);

            const hashBlob = crypto
                .createHash("sha1")
                .update(blobContent)
                .digest("hex");

            return hashBlob;
        };

        const hashTree = (entries: Buffer[]) => {
            const entriesBuffer = Buffer.concat(entries);

            const treeHeader = Buffer.from(`tree ${entriesBuffer.length}\0`);
            const treeContent = Buffer.concat([treeHeader, entriesBuffer]);

            // Hash the combined tree content (header + entries)
            const treeHash = crypto
                .createHash("sha1")
                .update(treeContent)
                .digest("hex");

            return treeHash;
        };

        const getFileMode = (stats: any) => {
            if (stats.isDirectory()) return "040000";
            else if (stats.isSymbolicLink()) return "120000";
            else if (stats.isFile()) {
                if (stats.mode & 0o100)
                    return "100755"; // Git mode for executable files
                else return "100644"; // Git mode for non-executable files
            }
            return null;
        };

        const createTreeHash = (
            hashFiles: {
                fileName?: string;
                subDirName?: string;
                mode: string | number;
                hash?: string;
                entries?: string;
            }[]
        ) => {
            const entriesBuffer = hashFiles?.map(entry =>
                Buffer.concat([
                    Buffer.from(
                        `${entry.mode} ${entry.fileName ?? entry?.subDirName}\0`
                    ),
                    Buffer.from(entry.hash ?? entry.entries, "hex")
                ])
            );
            const sha1 = hashTree(entriesBuffer);

            const treeHeader = Buffer.from(`tree ${entriesBuffer.length}\0`);
            const treeContent = Buffer.concat([treeHeader, entriesBuffer]);

            const compressTreeContent = zlib.deflateSync(treeContent);

            /*
    fs.mkdirSync(`.git/objects/${sha1.slice(0, 2)}`, {
        recursive: true
    });
    const path = `.git/objects/${sha1.slice(0, 2entriesBuffer${sha1.slice(2)}`;

    fs.writeFileSync(path, compressTreeContent);
    */

            return sha1;
        };
        console.log(createTreeHash(traverseDir("./test")));
        break;
    case Commands.readIndex:
        const data = fs.readFileSync("./test/.git/index");

        const [signature, versionNumber, entriyCount] = [0, 4, 8].map(
            (offset, _) => data.readUInt32BE(offset)
        );

        const entries: {
            ctime_s: number | Buffer; // seconds since epoch
            ctime_n: number | Buffer; // nanoseconds since epoch
            mtime_s: number | Buffer; // seconds since epoch
            mtime_n: number | Buffer; // nanoseconds since epoch
            dev: number | Buffer; // device number
            ino: number | Buffer; // inode number
            mode: number | Buffer; // file mode
            uid: number | Buffer; // user ID
            gid: number | Buffer; // group ID
            size: number | Buffer; // file size in bytes
            flags: number | Buffer; // flags (e.g. submodule, symlink)
            sha1: string; // SHA-1 hash of file contents
            path: number | Buffer; //path from root
        }[] = [];

        const entriyData = data.slice(12, -20);
        let i = 0;

        const getEntry = (
            entry: Buffer,
            path: Buffer
        ): (typeof entries)[number] => ({
            ctime_s: entry.readUInt32BE(0), // seconds since epoch
            ctime_n: entry.readUInt32BE(4), // nanoseconds since epoch
            mtime_s: entry.readUInt32BE(8), // seconds since epoch
            mtime_n: entry.readUInt32BE(12), // nanoseconds since epoch
            dev: entry.readUInt32BE(16), // device number
            ino: entry.readUInt32BE(20), // inode number
            mode: entry.readUInt32BE(24), // file mode
            uid: entry.readUInt32BE(28), // user ID
            gid: entry.readUInt32BE(32), // group ID
            size: entry.readUInt32BE(36), // file size in bytes
            flags: entry.readUInt16BE(40), // flags (e.g. submodule, symlink)
            sha1: entry.toString("hex", 42, 62),
            path
        });

        while (i + 62 < entriyData.length) {
            const fieldsEnd = i + 62;
            const fields = entriyData.slice(i, fieldsEnd);
            const pathEnd = entriyData.indexOf("\x00", fieldsEnd);
            const path = entriyData.slice(fieldsEnd, pathEnd);
            console.log(path.toString());
            entries.push(getEntry(fields, path));

            const entryLen = Math.trunc((62 + path.length + 8) / 8) * 8;
            i += entryLen;
        }

        console.log({
            signature: data.toString("ascii", 0, 4),
            versionNumber,
            entriyCount
        });

        console.log(entries);

        break;
    default:
        throw new Error(`Unknown command ${command}`);
}
/*
 *write tree
 *util function to helep take snapshot of the current project which is write tree
 
 *

function traverseDir(
    dir: string,
    result: {
        fileName?: string;
        subDirName?: string;
        mode: string | number;
        hash?: string;
        entries?: string;
    }[] = []
) {
    try {
        let dirLs = fs.readdirSync(dir);

        for (let current of dirLs) {
            if (
                current !== "node_modules" &&
                current !== ".git" &&
                fs.statSync(path.join(dir, current)).isDirectory()
            ) {
                const nestedSubDir = traverseDir(path.join(dir, current), []);

                result.push({
                    subDirName: current,
                    mode: "40000",
                    entries: hashTree(
                        nestedSubDir?.map(entry =>
                            Buffer.concat([
                                Buffer.from(
                                    `${entry.mode} ${
                                        entry.fileName ?? entry?.subDirName
                                    }\0`
                                ),
                                Buffer.from(entry.hash ?? entry.entries, "hex")
                            ])
                        )
                    )
                });
            } else {
                if (!fs.statSync(path.join(dir, current)).isDirectory())
                    result.push(
                        treehashEntry(path.join(dir, current), current)
                    );
            }
        }
        return result;
    } catch (e) {
        console.error(e);
    }
}

const treehashEntry = (path: string, fileName: string) => {
    return {
        mode: getFileMode(fs.statSync(path)),
        fileName,
        hash: hashFile(path)
    };
};

const hashFile = (path: string) => {
    const rawFileContent = fs.readFileSync(path);
    const header = Buffer.from(`blob ${fs.statSync(path).size}\0`, "utf-8");
    const blobContent = Buffer.concat([header, rawFileContent]);

    const hashBlob = crypto
        .createHash("sha1")
        .update(blobContent)
        .digest("hex");

    return hashBlob;
};

const hashTree = (entries: Buffer[]) => {
    const entriesBuffer = Buffer.concat(entries);

    const treeHeader = Buffer.from(
        `tree ${Buffer.byteLength(entriesBuffer)}\0`
    );
    const treeContent = Buffer.concat([treeHeader, entriesBuffer]);

    // Hash the combined tree content (header + entries)
    const treeHash = crypto
        .createHash("sha1")
        .update(treeContent)
        .digest("hex");

    return treeHash;
};

const getFileMode = (stats: any) => {
    if (stats.isDirectory()) return "040000";
    else if (stats.isSymbolicLink()) return "120000";
    else if (stats.isFile()) {
        if (stats.mode & 0o100)
            return "100755"; // Git mode for executable files
        else return "100644"; // Git mode for non-executable files
    }
    return null;
};

const createTreeHash = (
    hashFiles: {
        fileName?: string;
        subDirName?: string;
        mode: string | number;
        hash?: string;
        entries?: string;
    }[]
) => {
    const entriesBuffer = hashFiles?.map(entry =>
        Buffer.concat([
            Buffer.from(
                `${entry.mode} ${entry.fileName ?? entry?.subDirName}\0`
            ),
            Buffer.from(entry.hash ?? entry.entries, "hex")
        ])
    );
    const sha1 = hashTree(entriesBuffer);

    const treeHeader = Buffer.from(
        `tree ${Buffer.byteLength(entriesBuffer)}\0`
    );
    const treeContent = Buffer.concat([treeHeader, entriesBuffer]);

    const compressTreeContent = zlib.deflateSync(treeContent);

    /*
    fs.mkdirSync(`.git/objects/${sha1.slice(0, 2)}`, {
        recursive: true
    });
    const path = `.git/objects/${sha1.slice(0, 2)}/${sha1.slice(2)}`;

    fs.writeFileSync(path, compressTreeContent);
    /

    return sha1;
};

/* end */
