// import { Repository } from "./Repository";
const { FsFileAdapter } = require("../adapters/FsFileAdapter");
const { Repository } = require("../repository/Repository");

const fileAdapter: typeof FsFileAdapter = FsFileAdapter.getInstace();

//fileAdapter.writeFileSync("./file.txt", "Hello World");
//console.log(fileAdapter.statSync("./file.txt"));

const repo = new Repository(
    "test",
    "test for the structure",
    __dirname,
    fileAdapter
);
repo.add([
    ...new Set([
        "Todo.md",
        "dir-arr.json",
        "dir-tst.json",
        "dir.json",
        "jsons/bin.js",
        "jsons/dir-0.json",
        "jsons/dir-tst.json",
        "jsons/dir.json",
        "jsons/te.txt",
        "new.txt",
        "test.ts",
        "test.txt",
        "traves.js",
        ...[
            "AngularBlogApp.pack",
            "BufferCursor.js",
            "Clo.md",
            "GitIndex.js",
            "comparePath.js",
            "compareStrings.js",
            "fetch.js",
            "json.pack",
            "normalizeMode.js",
            "normalizeStats.js",
            "pack.file",
            "sample1.pack",
            "sample2.pack",
            "ws-pra.js",
            "wyag/LICENSE",
            "wyag/libwyag.py",
            "wyag/wyag"
        ]
    ])
]);
/*repo.init();
 */
//console.log(repo. );
//repo.writeTree();
/*repo.writeIndex();
console.log(repo.readIndex());
repo.commit("add parse tree method", repo.writeTree());
 */
