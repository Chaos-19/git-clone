import { FileAdapter } from "../adapters/FsFileAdapter";
import { Repository } from "../repository/Repository";
import { commandParser } from "../cltools/commandParser";

class GitSystemManager {
    private repository: typeof Repository;
    private commandParser: typeof CommandParser;
    private fileAdapter: typeof FileAdapter;

    constructor(repoPath: string, fileAdapter: FileAdapter) {
        this.fileAdapter = fileAdapter;
        this.repository = new Repository(repoPath, fileAdapter);
        this.commandParser = new CommandParser();
    }

    executeCommand(command: string, args: string[]) {
        switch (command) {
            case "init":
                this.repository.init();
                break;
            case "add":
                this.repository.add(args);
                break;
            default:
                console.log(`Unknown command: ${command}`);
        }
    }
}
