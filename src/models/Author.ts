export class Author {
    private name: string | null;
    private username: string;
    private email: string;

    constructor(name: string = null, username: string, email: string) {
        this.name = name;
        this.username = username;
        this.email = email;
    }

    getName(): string {
        return this.name;
    }

    getUsername(): string {
        return this.username;
    }

    getEmail(): string {
        return this.email;
    }

    toString(): string {
        return `${this.name} <${this.email}>`;
    }
}
