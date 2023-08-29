import { isIdentifier } from './lua';

export default class LuaTableGenerator {
  /**
   * The string builder.
   *
   * It seems string concatenation is actually faster than buffering and `join('')`,
   * so not bothering to use a buffer.
   */
  private output: string;

  private currentEmpty: boolean;

  private emptyTableExpr: string;

  private paired: boolean;

  constructor(emptyTableExpr: string = '{}') {
    this.output = '';
    this.currentEmpty = false;
    this.emptyTableExpr = emptyTableExpr;
    this.paired = false;
  }

  private sep() {
    if (this.paired) {
      this.output += '=';
      this.paired = false;
      this.currentEmpty = false;
    } else if (this.currentEmpty) {
      this.currentEmpty = false;
      this.output += '{';
    } else if (this.output !== '') {
      this.output += ',';
    }
  }

  raw(raw: string) {
    this.sep();
    this.output += raw;
    return this;
  }

  value(v: string | number | boolean) {
    this.sep();
    this.output += JSON.stringify(v);
    return this;
  }

  pair(k: string) {
    this.sep();
    this.output += isIdentifier(k) ? k : `${JSON.stringify(k)}`;
    this.paired = true;
    return this;
  }

  startTable() {
    this.sep();
    this.currentEmpty = true;
    return this;
  }

  endTable() {
    if (this.currentEmpty) {
      this.currentEmpty = false;
      this.output += this.emptyTableExpr;
    } else {
      this.output += '}';
    }
    return this;
  }

  toString() {
    return this.output;
  }
}
