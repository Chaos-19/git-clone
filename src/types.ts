export interface EntryType<T, P = string> {
    ctime_s: T;
    ctime_n: T;
    mtime_s: T;
    mtime_n: T;
    dev: T;
    ino: T;
    mode: T;
    uid: T;
    gid: T;
    size: T;
    flags: T;
    sha1: p;
    path: P;
    padding?: Buffer;
}
