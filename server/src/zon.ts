/* eslint-disable curly */
export class Location {
    column: number;
    line: number;

    constructor(column: number, line: number) {
        this.column = column;
        this.line = line;
    }
    lessThan(other: Location): boolean {
        if (this.line < other.line) {
            return true;
        }
        if (this.line > other.line) {
            return false;
        }
        return this.column < other.column;
    }
    lessOrEqual(other: Location): boolean {
        if (this.line < other.line) {
            return true;
        }
        if (this.line > other.line) {
            return false;
        }
        return this.column <= other.column;
    }
    greaterThan(other: Location): boolean {
        if (this.line > other.line) {
            return true;
        }
        if (this.line < other.line) {
            return false;
        }
        return this.column > other.column;
    }
    greaterOrEqual(other: Location): boolean {
        if (this.line > other.line) {
            return true;
        }
        if (this.line < other.line) {
            return false;
        }
        return this.column >= other.column;
    }
    equals(other: Location): boolean {
        return this.line === other.line && this.column === other.column;
    }
    clone() {
        return new Location(this.column, this.line);
    }
    advance(str: string) {
        for (const c of str) {
            if (c == LINE_FEED) {
                this.advanceLine();
            } else {
                this.advanceColumn();
            }
        }
    }
    advanceLine() {
        this.line++;
        this.column = 0;
    }
    advanceColumn() {
        this.column++;
    }
}

export class ZonNode {
    start: Location;
    end: Location;

    constructor(start: Location, end: Location) {
        this.start = start;
        this.end = end;
    }
    format(): string {
        return "";
    }
    walk(_walker: ZonWalker): void {
        throw new Error("walk method not implemented");
    }
}

type ZonEntry = [ZonNode, ZonNode];

export class ZonObject extends ZonNode {
    items: ZonEntry[];

    constructor(items: ZonEntry[], start: Location, end: Location) {
        super(start, end);
        this.items = items;
    }
    format(): string {
        return (
            ".{" +
            this.items
                .map(([key, value]) => {
                    return `${key.format()} = ${value.format()}`;
                })
                .join(", ") +
            "}"
        );
    }
    walk(walker: ZonWalker): void {
        walker.on_object(this);
    }
}

export class ZonString extends ZonNode {
    value: string;

    constructor(value: string, start: Location, end: Location) {
        super(start, end);
        this.value = value;
    }
    format(): string {
        return `"${this.value}"`;
    }
    walk(walker: ZonWalker): void {
        walker.on_string(this);
    }
}

export class ZonIdentifier extends ZonNode {
    value: string;
    constructor(value: string, start: Location, end: Location) {
        super(start, end);
        this.value = value;
    }
    format(): string {
        if (this.value.match(/\w+/)) {
            return `.${this.value}`;
        } else {
            return `@"${this.value}"`;
        }
    }
    walk(walker: ZonWalker): void {
        walker.on_identifier(this);
    }
}

export class ZonNumber extends ZonNode {
    value: string;

    constructor(value: string, start: Location, end: Location) {
        super(start, end);
        this.value = value;
    }
    format(): string {
        return this.value;
    }
    walk(walker: ZonWalker): void {
        walker.on_number(this);
    }
}
export class ZonBoolean extends ZonNode {
    value: boolean;

    constructor(value: boolean, start: Location, end: Location) {
        super(start, end);
        this.value = value;
    }
    format(): string {
        return this.value ? "true" : "false";
    }
    walk(walker: ZonWalker): void {
        walker.on_boolean(this);
    }
}
export class ZonNull extends ZonNode {
    constructor(start: Location, end: Location) {
        super(start, end);
    }
    format(): string {
        return "null";
    }
    walk(walker: ZonWalker): void {
        walker.on_null(this);
    }
}
export class ZonSyntaxError extends ZonNode {
    value: string;

    constructor(value: string, start: Location, end: Location) {
        super(start, end);
        this.value = value;
    }
    format(): string {
        return `${this.value}`;
    }
    walk(walker: ZonWalker): void {
        walker.on_syntax_error(this);
    }
}
export class ZonEnd extends ZonNode {
    constructor(start: Location, end: Location) {
        super(start, end);
    }
    format(): string {
        return "";
    }
    walk(walker: ZonWalker): void {
        walker.on_end(this);
    }
}

export class ZonWalker {
    on_object(node: ZonObject): void {
        for (const [key, value] of node.items) {
            key.walk(this);
            value.walk(this);
        }
    }
    on_string(_node: ZonString): void {}
    on_identifier(_node: ZonIdentifier): void {}
    on_number(_node: ZonNumber): void {}
    on_boolean(_node: ZonBoolean): void {}
    on_null(_node: ZonNull): void {}
    on_syntax_error(_node: ZonSyntaxError): void {}
    on_end(_node: ZonEnd): void {}
}

export class FindZonNode extends ZonWalker {
    position: Location;
    match: ZonNode | null = null;

    constructor() {
        super();
        this.position = new Location(0, 0);
        this.match = null;
    }
    find(node: ZonNode, position: Location): ZonNode | null {
        this.position = position;
        this.match = null;

        node.walk(this);
        const match = this.match;

        this.position = new Location(0, 0);
        this.match = null;

        return match;
    }
    on_object(node: ZonObject): void {
        if(this.position.greaterOrEqual(node.start) && this.position.lessThan(node.end)) {
            super.on_object(node);
        }
    }
    on_string(node: ZonString): void {
        if (this.position.greaterOrEqual(node.start) && this.position.lessThan(node.end)) {
            this.match = node;
        }
    }
    on_identifier(node: ZonIdentifier): void {
        if (this.position.greaterOrEqual(node.start) && this.position.lessThan(node.end)) {
            this.match = node;
        }
    }
    on_number(node: ZonNumber): void {
        if (this.position.greaterOrEqual(node.start) && this.position.lessThan(node.end)) {
            this.match = node;
        }
    }
    on_boolean(node: ZonBoolean): void {
        if (this.position.greaterOrEqual(node.start) && this.position.lessThan(node.end)) {
            this.match = node;
        }
    }
    on_null(node: ZonNull): void {
        if (this.position.greaterOrEqual(node.start) && this.position.lessThan(node.end)) {
            this.match = node;
        }
    }
    on_syntax_error(node: ZonSyntaxError): void {
        if (this.position.greaterOrEqual(node.start) && this.position.lessThan(node.end)) {
            this.match = node;
        }
    }
    on_end(node: ZonEnd): void {
        if (this.position.greaterOrEqual(node.start) && this.position.lessThan(node.end)) {
            this.match = node;
        }
    }
}

const LINE_FEED = "\n";

export class Parser {
    location: Location;
    source: string;
    rest: string;

    constructor() {
        this.location = new Location(0, 0);
        this.source = "";
        this.rest = "";
    }
    public parse(source: string): ZonNode {
        this.location = new Location(0, 0);
        this.source = source;
        this.rest = source;

        return this.parseNode();
    }
    private parseNode(): ZonNode {
        this.skipWhitespace();

        if (this.rest.length === 0) {
            return new ZonEnd(this.location.clone(), this.location.clone());
        }
        if (this.rest.match(/^\.{/)) {
            return this.parseObject();
        }
        if (this.rest.match(/^\.\w/)) {
            return this.parseSimpleName();
        }
        if (this.rest.match(/^@"/)) {
            return this.parseAdvancedName();
        }
        if (this.rest.match(/^"/)) {
            return this.parseString();
        }
        if (this.rest.match(/^null(\s|,|}|$)/)) {
            return this.parseNull();
        }
        if (this.rest.match(/^(true|false)(\s|,|}|$)/)) {
            return this.parseBoolean();
        }
        if (this.rest.match(/^([+-]?\d(\.\d)?|0x[0-9a-fA-F]+)/)) {
            return this.parseNumber();
        }
        return this.syntaxError();
    }
    private syntaxError(): ZonNull {
        const start = this.location.clone();
        this.location.advance(this.rest);
        const end = this.location.clone();
        const err = new ZonSyntaxError(this.rest, start, end);
        this.rest = "";
        return err;
    }
    private skipWhitespace() {
        const m = this.rest.match(/^\s+/);
        if (m) {
            this.location.advance(m[0]);
            this.rest = this.rest.slice(m[0].length);
        }
    }
    private parseObject(): ZonNode {
        const start = this.location.clone();
        let index = 0;
        const items: ZonEntry[] = [];

        if (!this.matchAdvance(/^\.\{/)) return this.syntaxError();
        this.skipWhitespace();

        while (true) {
            this.skipWhitespace();
            if (this.peek(/^}/)) break;

            const item = this.parseNode();
            this.skipWhitespace();

            if (item instanceof ZonEnd) break;

            if (this.peek(/^}/)) break;

            if (this.matchAdvance(/^=/)) {
                const value = this.parseNode();
                items.push([item, value]);

                this.skipWhitespace();
                if (!this.matchAdvance(/^,/)) break;
                continue;
            }

            items.push([
                new ZonNumber(index.toString(), item.start.clone(), item.start.clone()),
                item,
            ]);
            index++;

            this.skipWhitespace();
            if (!this.matchAdvance(/^,/)) break;

            continue;
        }

        this.skipWhitespace();
        this.matchAdvance(/^}/);

        return new ZonObject(items, start, this.location.clone());
    }
    private peek(re: RegExp): boolean {
        const m = this.rest.match(re);
        return !!m;
    }
    private matchAdvance(re: RegExp): boolean {
        const m = this.rest.match(re);
        if (!m) {
            return false;
        }
        this.advance(m[0]);
        return true;
    }
    private advance(str: string): void {
        this.location.advance(str);
        this.rest = this.rest.slice(str.length);
    }
    private parseSimpleName(): ZonNode {
        const m = this.rest.match(/^\.\w+/);
        if (!m) {
            return this.syntaxError();
        }
        const start = this.location.clone();

        this.location.advance(m[0]);
        this.rest = this.rest.slice(m[0].length);

        return new ZonIdentifier(m[0].slice(1), start, this.location.clone());
    }
    public parseAdvancedName(): ZonNode {
        const m = this.rest.match(/^@"(.+?)"/);
        if (!m) {
            return this.syntaxError();
        }
        const start = this.location.clone();

        this.location.advance(m[0]);
        this.rest = this.rest.slice(m[0].length);

        return new ZonIdentifier(m[1], start, this.location.clone());
    }
    public parseString(): ZonNode {
        const m = this.rest.match(/^"(.+?)"/);
        if (!m) {
            return this.syntaxError();
        }
        const start = this.location.clone();

        this.location.advance(m[0]);
        this.rest = this.rest.slice(m[0].length);

        return new ZonString(m[1], start, this.location.clone());
    }
    public parseNull(): ZonNode {
        const m = this.rest.match(/^null/);
        if (!m) {
            return this.syntaxError();
        }
        const start = this.location.clone();

        this.location.advance(m[0]);
        this.rest = this.rest.slice(m[0].length);

        return new ZonNull(start, this.location.clone());
    }
    public parseBoolean(): ZonNode {
        const m = this.rest.match(/^(true|false)/);
        if (!m) {
            return this.syntaxError();
        }
        const start = this.location.clone();

        this.location.advance(m[0]);
        this.rest = this.rest.slice(m[0].length);

        return new ZonBoolean(m[1] === "true", start, this.location.clone());
    }
    public parseNumber(): ZonNode {
        const m = this.rest.match(/^([+-]?\d(\.\d)?|0x[0-9a-fA-F]+)/);
        if (!m) {
            return this.syntaxError();
        }
        const start = this.location.clone();

        this.location.advance(m[0]);
        this.rest = this.rest.slice(m[0].length);

        return new ZonNumber(m[0], start, this.location.clone());
    }
}
