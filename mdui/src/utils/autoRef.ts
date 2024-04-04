import {
  ref, toValue, watch,
  type Ref,
} from 'vue';

/**
 * Returns a reactive reference to the upstream value that allows overriding temporarily.
 *
 * @param watchable the upstream value watcher
 * @returns a reactive reference to the upstream value
 */
export default function autoRef<T>(watchable: () => T): Ref<T> {
  const init = watchable();
  const reference = ref(init) as Ref<T>;
  watch(watchable, () => {
    reference.value = toValue(watchable());
  });
  return reference;
}
