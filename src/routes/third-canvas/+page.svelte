<script lang="ts">
import { onMount } from 'svelte';
let videoEl: HTMLVideoElement | null = null;
onMount(() => {
  if (videoEl) {
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.muted = true;
    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('webkit-playsinline', 'true');
  }
});
</script>

<main class="fixed inset-0 bg-black overflow-hidden">
  <video id="mirror" bind:this={videoEl} style="width:100vw; height:100vh; display:block; object-fit:cover;" >
    <track kind="captions" srclang="en" label="English captions" />
  </video>
</main>
