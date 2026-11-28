<script lang="ts">
  let { onpick }: { onpick: (emoji: string) => void } = $props();
  const groups = [
    { name: 'Лица', icon: '🙂', chars: '😀 😄 😁 😂 🤣 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 🤨 🧐 🤓 😎 🥳 😏 😒 🙄 😬 😌 😔 🥺 😢 😭 😤 😡 🤯 😳 😱 😴 🤔 🤫 🤭 🤢 🤡 👻 💀 🤖' },
    { name: 'Жесты', icon: '👋', chars: '👋 🤚 ✋ 🖐️ 👌 🤌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 👍 👎 👊 ✊ 👏 🙌 🫶 🤝 🙏 💪 🫡' },
    { name: 'Символы', icon: '💜', chars: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 💕 💖 💯 ✨ ⭐ 🌟 🔥 🎉 🎊 🎈 🎁 💬 ✅ ❌ ⚠️ ❓ ♻️ 💤' },
    { name: 'Предметы', icon: '🎮', chars: '🎮 🎧 🎵 🎤 🎬 📷 📱 💻 ⌨️ 🖥️ 💡 🔔 📌 📎 🛠️ 📚 📝 🎨 🏆 ⚽ 🚀 ☕ 🍕 🍔 🍿 🍰 🐱 🐶 🌈 🌙' },
  ];
  const key = 'comsys-recent-emojis';
  function readRecent(): string[] {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(saved) ? saved.filter((item) => typeof item === 'string').slice(0, 24) : [];
    } catch { return []; }
  }
  const recent = readRecent();
  let selected = $state(recent.length ? -1 : 0);
  const items = $derived(selected < 0 ? recent : groups[selected].chars.split(' '));

  function pick(emoji: string) {
    try { localStorage.setItem(key, JSON.stringify([emoji, ...recent.filter((item) => item !== emoji)].slice(0, 24))); } catch {}
    onpick(emoji);
  }
</script>

<section class="picker" aria-label="Эмодзи">
  <div class="categories" role="group" aria-label="Категории эмодзи">
    {#if recent.length}
      <button type="button" title="Недавние" aria-label="Недавние" aria-pressed={selected === -1} onclick={() => { selected = -1; }}>◷</button>
    {/if}
    {#each groups as group, i (group.name)}
      <button type="button" title={group.name} aria-label={group.name} aria-pressed={selected === i}
        onclick={() => { selected = i; }}>{group.icon}</button>
    {/each}
  </div>
  <div class="emojis scroll">
    {#each items as emoji (emoji)}
      <button type="button" onclick={() => pick(emoji)}>{emoji}</button>
    {/each}
  </div>
</section>

<style>
  .picker { position: absolute; z-index: 5; right: 12px; bottom: calc(100% + 4px); width: min(322px, calc(100% - 24px)); padding: 8px; border: 1px solid var(--border); border-radius: 14px; background: var(--bg-elev); box-shadow: var(--shadow); }
  .categories { display: flex; gap: 5px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
  button { min-height: 34px; min-width: 34px; font-size: 19px; border-radius: 7px; }
  button:hover, button[aria-pressed="true"] { background: var(--bg-active); }
  .emojis { display: grid; grid-template-columns: repeat(auto-fit, minmax(34px, 1fr)); gap: 2px; max-height: 185px; padding-top: 5px; }
</style>
