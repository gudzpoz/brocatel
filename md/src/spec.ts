import { slug } from 'github-slugger';

/**
 * Converts from heading strings to anchor id, e.g. from `A B` to `a-b`.
 *
 * @param s the label
 */
export function getAnchorString(s: string) {
  return slug(s.trim().replace(/_/g, '-').replace(/#/g, '_')).replace(/_/g, '#');
}

const normalLinkPattern = /^(?!mailto:)(?:http|https|ftp):\/\//;

export function isNormalLink(s: string) {
  return normalLinkPattern.test(s) || s.startsWith('www.') || s.startsWith('./#');
}
