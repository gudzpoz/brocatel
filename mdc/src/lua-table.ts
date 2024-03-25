import { SourceNode } from 'source-map-js';
import { Position } from 'unist';
import { isIdentifier } from './lua';
import { sourceNode } from './utils';

interface TableStart {
  type: 'table-start';
  position?: Position;
}

interface Raw {
  type: 'raw';
  value: string;
}

interface Annotated {
  type: 'annotated';
  value: SourceNode;
}

type StackElement = TableStart | Raw | Annotated;

export default class LuaTableGenerator {
  private emptyTableExpr: string;

  private paired: boolean;

  private file: string;

  private stack: StackElement[];

  constructor(emptyTableExpr: string = '{}', file?: string) {
    this.emptyTableExpr = emptyTableExpr;
    this.paired = false;
    this.file = file ?? '<input>';
    this.stack = [];
  }

  private isEmptyTable() {
    return this.stack.length !== 0 && this.stack[this.stack.length - 1].type === 'table-start';
  }

  private push(value: string, position?: Position) {
    if (position) {
      this.stack.push({
        type: 'annotated',
        value: sourceNode(position.start.line, position.start.column, this.file, [value]),
      });
    } else {
      this.stack.push({ type: 'raw', value });
    }
  }

  private sep() {
    if (this.paired) {
      this.push('=');
      this.paired = false;
    } else if (this.stack.length !== 0 && !this.isEmptyTable()) {
      this.push(',\n');
    }
  }

  raw(raw: string | SourceNode, position?: Position) {
    this.sep();
    if (typeof raw === 'string') {
      this.push(raw, position);
    } else {
      this.stack.push({ type: 'annotated', value: raw });
    }
    return this;
  }

  value(v: string | number | boolean, position?: Position) {
    this.sep();
    this.push(JSON.stringify(v), position);
    return this;
  }

  pair(k: string, position?: Position) {
    this.sep();
    this.push(isIdentifier(k) ? k : `[${JSON.stringify(k)}]`, position);
    this.paired = true;
    return this;
  }

  startTable(position?: Position) {
    this.sep();
    this.stack.push({ type: 'table-start', position });
    return this;
  }

  endTable() {
    if (this.isEmptyTable()) {
      const table = this.stack.pop()! as TableStart;
      this.push(this.emptyTableExpr, table.position);
    } else {
      let tableStartI = this.stack.length - 1;
      while (tableStartI >= 0) {
        const { type } = this.stack[tableStartI];
        if (type === 'table-start') {
          break;
        }
        tableStartI -= 1;
      }
      if (tableStartI < 0) {
        throw new Error('no table start token found');
      }
      const tableStart = this.stack[tableStartI] as TableStart;
      const node = sourceNode(
        tableStart.position?.start.line,
        tableStart.position?.start.column,
        this.file,
        this.stack.splice(tableStartI).map((item) => (item.type === 'table-start' ? '{' : item.value)),
      );
      node.add('}');
      this.stack.push({ type: 'annotated', value: node });
    }
    return this;
  }

  toSourceNode() {
    if (this.stack.length === 1 && this.stack[0].type === 'annotated') {
      return this.stack[0].value;
    }
    throw new Error('invalid state');
  }

  toString() {
    return this.toSourceNode().toString();
  }
}
