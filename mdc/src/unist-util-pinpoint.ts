import { Parent, Root, RootContent } from 'mdast';
import type { Point, Position } from 'unist';
export type { Point } from 'unist';

function comparePoints(a: Point, b: Point) {
  return a.line - b.line || a.column - b.column;
}

function isWithin(point: Point, position: Position) {
  return comparePoints(point, position.start) > 0 && comparePoints(point, position.end) < 0;
}

function bisectCandidates(point: Point, children: Parent['children']): Parent['children'] {
  // Bisect by position
  let left = 0; // Inclusive
  let right = children.length; // Exclusive
  while (right - left > 0) {
    const center = Math.floor((left + right) / 2);
    // Find a child around mid whose position is defined
    let mid = center;
    while (left < mid && !children[mid].position) {
      mid -= 1;
    }
    if (!children[mid].position) {
      // The other direction
      mid = Math.min(center + 1, right - 1);
      while (mid < right - 1 && !children[mid].position) {
        mid += 1;
      }
      if (!children[mid].position) {
        // All, undefined, are, candidates.
        break;
      }
    }
    const child = children[mid];
    const position = child.position!;
    const startCmp = comparePoints(point, position.start);
    const endCmp = comparePoints(point, position.end);
    // mid is in [left, right - 1], narrowing the range
    if (startCmp <= 0) {
      right = mid;
    } else if (endCmp < 0) {
      let guessLeft = mid - 1;
      while (left <= guessLeft && (
        !children[guessLeft].position
        || isWithin(point, children[guessLeft].position!)
      )) {
        guessLeft -= 1;
      }
      let guessRight = mid + 1;
      while (guessRight < right && (
        !children[guessRight].position
        || isWithin(point, children[guessRight].position!)
      )) {
        guessRight += 1;
      }
      left = guessLeft + 1;
      right = guessRight;
      break;
    } else {
      left = mid + 1;
    }
  }
  return children.slice(left, right);
}

export function pinpoint(root: Root, point: Point) {
  const candidates: (RootContent | Root)[] = [root];
  const nonLeafCandidates: RootContent[] = [];
  while (candidates.length > 0) {
    const candidate = candidates.pop()!;
    // Auto-completable node should have a position
    const within = candidate.position && isWithin(point, candidate.position);
    if (!(candidate as any).children) {
      if (within) {
        return candidate;
      }
      // eslint-disable-next-line no-continue
      continue;
    }
    const children = bisectCandidates(point, (candidate as Parent).children);
    if (children.length === 0) {
      if (within) {
        nonLeafCandidates.push(candidate as RootContent);
      }
    } else {
      candidates.push(...children);
    }
  }
  if (nonLeafCandidates.length > 0) {
    return nonLeafCandidates[0];
  }
  return null;
}
