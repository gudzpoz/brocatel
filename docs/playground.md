<script setup>
import { ref } from 'vue';

const text = ref('');

if (!import.meta?.env?.SSR) {
  const url = (new URLSearchParams(location.search)).get('url');
  if (url) {
    text.value = `Loading stories from \`${url.replace('`', '&#96;')}\`...`;
    fetch(url).then((r) => r.text()).then((s) => {
      text.value = s;
    }).catch(() => {
      text.value = 'Failed to load stories';
    });
  }
}
</script>

<md-example :markdown="text">

~~~markdown
Hello World!
~~~

</md-example>
