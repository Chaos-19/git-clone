export function joinPath(...path: string[]) {
    return `/${path
        .map(value =>
            (value.startsWith("/") && value.endsWith("/")) ||
            (value.startsWith("./") && value.endsWith("/"))
                ? value.slice(1).slice(0, -1)
                : value.endsWith("/")
                ? value.slice(0, -1)
                : value.startsWith("/") || value.startsWith("./")
                ? value.slice(1)
                : value
        )
        .join("/")}`;
}

export function convertTimeToGit({
    ctimeMs,
    mtimeMs
}: {
    ctimeMs: number;
    mtimeMs: number;
}): {
    ctime_s: number;
    ctime_n: number;
    mtime_s: number;
    mtime_n: number;
} {
    const mtime_n = Math.floor((mtimeMs % 1000) * 1_000_000);
    const mtime_s = Math.floor(mtimeMs / 1000);
    const ctime_s = Math.floor(ctimeMs / 1000);
    const ctime_n = Math.floor((ctimeMs % 1000) * 1_000_000);

    return { ctime_s, ctime_n, mtime_s, mtime_n };
}

export function convertTo12Bit(value: number): number {
    return value & 0xfff;
}

// Function to recover the original value based on assumptions
export function getOriginalValue(
    maskValue: number,
    isHighBitSet: boolean
): number {
    const originalBase = isHighBitSet ? 0x1000 : 0;
    return originalBase | maskValue;
}
export const getFileMode = (stats: any) => {
    if (stats.isDirectory()) return "040000";
    else if (stats.isSymbolicLink()) return "120000";
    else if (stats.isFile()) {
        if (stats.mode & 0o100)
            return "100755"; // Git mode for executable files
        else return "100644"; // Git mode for non-executable files
    }
    return null;
};
