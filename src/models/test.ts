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
/*repo.init();
repo.add("TODO.md");
 */
console.log(repo.readIndex().map(v => ({ ...v, path: v.path.toString() })));
