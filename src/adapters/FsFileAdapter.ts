export interface FileAdapter {
    readFileSync(path: string, encoding?: BufferEncoding): Buffer;
    writeFileSync(
        path: string,
        data: string | Buffer,
        options?: { encoding?: BufferEncoding; mode?: number; flag?: string }
    ): void;
    mkdirSync(
        path: string,
        options?: { recursive?: boolean; mode?: number }
    ): void;
    existsSync(path: string): boolean;
    readdirSync(path: string): string[];
    statSync(path: string): import("fs").Stats;
    unlinkSync(path: string): void;
    rmdirSync(path: string): void;
}

export class FsFileAdapter implements FileAdapter {
    private static instance: FileAdapter;

    public static getInstace(): FileAdapter {
        if (!FsFileAdapter.instance)
            FsFileAdapter.instance = new FsFileAdapter();

        return FsFileAdapter.instance;
    }
    readFileSync(path: string, encoding?: BufferEncoding): Buffer {
        const fs = require("fs");
        return encoding
            ? fs.readFileSync(path, { encoding })
            : fs.readFileSync(path);
    }

    writeFileSync(
        path: string,
        data: string | Buffer,
        options?: { encoding?: BufferEncoding; mode?: number; flag?: string }
    ): void {
        const fs = require("fs");
        fs.writeFileSync(path, data, options);
        console.log(path);
    }

    mkdirSync(
        path: string,
        options?: { recursive?: boolean; mode?: number }
    ): void {
        const fs = require("fs");
        fs.mkdirSync(path, options);
    }

    existsSync(path: string): boolean {
        const fs = require("fs");
        return fs.existsSync(path);
    }

    readdirSync(path: string): string[] {
        const fs = require("fs");
        return fs.readdirSync(path);
    }

    statSync(path: string): import("fs").Stats {
        const fs = require("fs");
        return fs.statSync(path);
    }

    unlinkSync(path: string): void {
        const fs = require("fs");
        fs.unlinkSync(path);
    }

    rmdirSync(path: string): void {
        const fs = require("fs");
        fs.rmdirSync(path);
    }
}
