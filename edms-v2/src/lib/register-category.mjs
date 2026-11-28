/** @template {{parentId: string|null, name: string}} T
 * @param {T[]} folders
 * @param {string} category
 */
export function categoryRoots(folders, category) {
  const roots = folders.filter(folder => !folder.parentId);
  const explicit = roots.find(folder => folder.name.trim().localeCompare(category, 'id', { sensitivity: 'base' }) === 0);
  const legacy = category === 'Sertifikasi'
    ? roots.filter(folder => /^\d+\s*\.\s*(MM|BMK|BMA|BST)\s*-/i.test(folder.name.trim()))
    : [];
  return { explicit, legacy };
}
