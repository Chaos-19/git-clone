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
    return value > 0xfff ? value & 0xfff : value;
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

export function normalizeMode(mode) {
    // Note: BrowserFS will use -1 for "unknown"
    // I need to make it non-negative for these bitshifts to work.
    let type = mode > 0 ? mode >> 12 : 0;
    // If it isn't valid, assume it as a "regular file"
    // 0100 = directory
    // 1000 = regular file
    // 1010 = symlink
    // 1110 = gitlink
    if (
        type !== 0b0100 &&
        type !== 0b1000 &&
        type !== 0b1010 &&
        type !== 0b1110
    ) {
        type = 0b1000;
    }
    let permissions = mode & 0o777;
    // Is the file executable? then 755. Else 644.
    if (permissions & 0b001001001) {
        permissions = 0o755;
    } else {
        permissions = 0o644;
    }
    // If it's not a regular file, scrub all permissions
    if (type !== 0b1000) permissions = 0;
    return (type << 12) + permissions;
}
const MAX_UINT32 = 2 ** 32;

function SecondsNanoseconds(
    givenSeconds,
    givenNanoseconds,
    milliseconds,
    date
) {
    if (givenSeconds !== undefined && givenNanoseconds !== undefined) {
        return [givenSeconds, givenNanoseconds];
    }
    if (milliseconds === undefined) {
        milliseconds = date.valueOf();
    }
    const seconds = Math.floor(milliseconds / 1000);
    const nanoseconds = (milliseconds - seconds * 1000) * 1000000;
    return [seconds, nanoseconds];
}

export function normalizeStats(e) {
    const [ctimeSeconds, ctimeNanoseconds] = SecondsNanoseconds(
        e.ctimeSeconds,
        e.ctimeNanoseconds,
        e.ctimeMs,
        e.ctime
    );
    const [mtimeSeconds, mtimeNanoseconds] = SecondsNanoseconds(
        e.mtimeSeconds,
        e.mtimeNanoseconds,
        e.mtimeMs,
        e.mtime
    );

    return {
        ctimeSeconds: ctimeSeconds % MAX_UINT32,
        ctimeNanoseconds: ctimeNanoseconds % MAX_UINT32,
        mtimeSeconds: mtimeSeconds % MAX_UINT32,
        mtimeNanoseconds: mtimeNanoseconds % MAX_UINT32,
        dev: e.dev % MAX_UINT32,
        ino: e.ino % MAX_UINT32,
        mode: normalizeMode(e.mode % MAX_UINT32),
        uid: e.uid % MAX_UINT32,
        gid: e.gid % MAX_UINT32,
        // size of -1 happens over a BrowserFS HTTP Backend that doesn't serve Content-Length headers
        // (like the Karma webserver) because BrowserFS HTTP Backend uses HTTP HEAD requests to do fs.stat
        size: e.size > -1 ? e.size % MAX_UINT32 : 0
    };
}
function renderCacheEntryFlags(entry) {
    const flags = entry.flags;
    // 1-bit extended flag (must be zero in version 2)
    flags.extended = false;
    // 12-bit name length if the length is less than 0xFFF; otherwise 0xFFF
    // is stored in this field.
    flags.nameLength = Math.min(Buffer.from(entry.path).length, 0xfff);
    return (
        (flags.assumeValid ? 0b1000000000000000 : 0) +
        (flags.extended ? 0b0100000000000000 : 0) +
        ((flags.stage & 0b11) << 12) +
        (flags.nameLength & 0b111111111111)
    );
}
