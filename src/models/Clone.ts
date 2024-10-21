import { Common, OBJTYPE } from "./Common";
import { createInflate } from "zlib";
import { PassThrough, pipeline } from "stream";

const OBJTYPE = {
    1: "OBJ_COMMIT",
    2: "OBJ_TREE",
    3: "OBJ_BLOB",
    4: "OBJ_TAG",
    6: "OBJ_OFS_DELTA",
    7: "OBJ_REF_DELTA"
};

const GITOBJS = ["commit", "tree", "blob"];

class Clone extends Common {
    url: string;
    pattern: RegExp = /^(https:\/\/github\.com\/)([\w\-.]+)\/([\w\-.]+)\.git$/;
    refList: string[] = [];

    constructor(url: string) {
        super();
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

    async extractRefHash(input: string): Promise<{
        ref: string;
        hash: string;
    }> {
        const regex =
            /(\s?[0-9a-fA-F]{4})([0-9a-fA-F]{40})(\srefs[/\w+-/\w+/]+|\sHEAD)/gm;

        return [...input.matchAll(regex)]
            .map(([, , ...res]) => ({
                ref: res.pop(),
                hash: res.pop()
            }))
            .find(
                refInfo =>
                    refInfo.ref.trim() === "refs/heads/main" ||
                    refInfo.ref.trim() === "refs/heads/master"
                //|| refInfo.ref.trim() === "HEAD"
            );
    }

    async parsePackFile(packeFile: Buffer) {
        const magicHeader = packeFile.slice(0, 16);

        const objectLength = packeFile.readUInt32BE(16);

        const packedObject = packeFile.slice(20);

        const unpackedObject = [];

        let readOffset = 0;

        for (let index = 0; index < objectLength; index++) {
            const { parsedBytes, type, size } = this.parsePackObjectHeader(
                packedObject,
                readOffset
            );

            if (GITOBJS.includes(OBJTYPE[type])) {
                readOffset += parsedBytes;

                const { decompressedData, parsedBytes: actualSize } =
                    await this.inflateWithLengthLimit(
                        packedObject.slice(readOffset),
                        size
                    );

                readOffset += actualSize;

                unpackedObject.push({
                    sha1: this.hashObjct(
                        decompressedData,
                        <OBJTYPE>GITOBJS[type - 1],
                        false
                    ),
                    type: OBJTYPE[type],
                    content: decompressedData
                });
            } else if (type == 7) {
                const baseRef = unpackedObject.slice(
                    readOffset,
                    readOffset + 20
                );

                readOffset += 20 + parsedBytes;

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
        let offset = 4;

        while (packedObj[current] >= 128) {
            current++;
            size += (packedObj[current] & 127) << offset;
            offset += 7;
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

    cloneRepo() {
        this.getAvalableRefFromServer()
            .then(ref => this.extractRefHash(ref))
            .then(({ ref, hash }: { ref: string; hash: string }) =>
                this.getPackFile(hash)
            )
            .then(res => this.parsePackFile(Buffer.from(res)))
            .then(unpacked => {
                console.log(
                    unpacked.map(value => ({
                        ...value,
                        contentS: value.content.toString()
                    }))
                );
            })
            .catch(error => console.log(error));
    }
}

const cloneFun = new Clone("https://github.com/Chaos-19/termux-scripts.git");

cloneFun.cloneRepo();
