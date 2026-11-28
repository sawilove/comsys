<script lang="ts">
  let { size = 48 }: { size?: number } = $props();
</script>

<img src={import.meta.env.BASE_URL + 'favicon.svg'} width={size} height={size} alt="" />

<style>
  img { display: block; flex: none; }
</style>
