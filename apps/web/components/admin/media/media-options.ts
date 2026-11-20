export type MediaOption = { id: string; name: string; parentId?: string | null };
export function optionPath(item: MediaOption, options: MediaOption[]): string {
  const names = [item.name];
  const visited = new Set([item.id]);
  let parent = options.find(o => o.id === item.parentId);
  while (parent && !visited.has(parent.id)) {
    visited.add(parent.id); names.unshift(parent.name);
    const parentId = parent.parentId;
    parent = options.find(o => o.id === parentId);
  }
  return names.join(' / ');
}
