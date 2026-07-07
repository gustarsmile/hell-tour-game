export function createPlayer(scene, hooks = {}) {
  const nodesById = new Map(scene.nodes.map((n) => [n.id, n]));
  const weight = scene.karmaWeight ?? 1;

  function nodeOf(id) {
    const node = nodesById.get(id);
    if (!node) throw new Error(`場景 ${scene.id} 找不到節點：${id}`);
    return node;
  }

  let current = nodeOf(scene.start);

  return {
    current: () => current,
    isEnded: () => current.type === 'end',
    advance() {
      if (current.type !== 'line') throw new Error('advance() 僅適用於 line 節點');
      current = nodeOf(current.next);
      return current;
    },
    choose(index) {
      if (current.type !== 'choice') throw new Error('choose() 僅適用於 choice 節點');
      const choice = current.choices[index];
      if (!choice) throw new Error(`選項不存在：${index}`);
      if (choice.karma && hooks.onKarma) {
        hooks.onKarma(choice.karma.axis, choice.karma.delta, weight);
      }
      current = nodeOf(choice.next);
      return current;
    },
  };
}
