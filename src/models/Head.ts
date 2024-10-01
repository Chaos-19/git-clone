export class Head {
    private currentRef: string;

    constructor(ref: string) {
        this.currentRef = ref;
    }

    getCurrentRef(): string {
        return this.currentRef;
    }

    setCurrentRef(ref: string): void {
        this.currentRef = ref;
    }
}
