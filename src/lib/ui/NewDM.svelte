<script lang="ts">
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import Modal from './Modal.svelte';
  import PeopleSelect from './PeopleSelect.svelte';
  import { describeError } from '../util/format';

  async function pick(id: string) {
    try {
      await app.openDM(id);
      ui.close();
    } catch (e) {
      ui.say(describeError(e));
    }
  }
</script>

<Modal title="Новый чат" onclose={() => ui.close()}>
  <PeopleSelect single onpick={(p) => pick(p.id)} />
</Modal>
