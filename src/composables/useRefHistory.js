/**
 * useRefHistory - A Vue composable for tracking the history of a reactive ref value with undo/redo support.
 *
 * This utility allows you to store snapshots of a reactive `ref` (primitive or object), enabling undo/redo functionality.
 * Useful for form state, drawing apps, editors, etc.
 *
 * @param {Ref} source - The reactive ref to track history for.
 * @param {Object} options - Configuration options.
 * @param {boolean} [options.deep=false] - Whether to watch deeply nested changes.
 * @param {number} [options.capacity=Infinity] - Maximum number of history entries to keep.
 * @param {Function} [options.clone] - Function to clone a value (default: JSON deep clone).
 *
 * @returns {Object} {
 *   history: Ref<Array>,     // List of snapshots
 *   pointer: Ref<number>,    // Current position in the history
 *   canUndo: Ref<boolean>,   // Whether undo is possible
 *   canRedo: Ref<boolean>,   // Whether redo is possible
 *   undo: Function,          // Undo the last change
 *   redo: Function           // Redo a previously undone change
 * }
 * @author Rahul Rawat
 * Notes:
 * - Uses `v-watch` to track changes, with optional deep watch.
 * - Automatically trims history to respect `capacity`.
 * - Skips tracking during undo/redo to prevent recursive updates.
 */
import { ref, watch } from 'vue';
export function useRefHistory(source, options = {}) {
    const { deep = false, capacity = Infinity, clone = (v) => JSON.parse(JSON.stringify(v)) } = options;
    const history = ref([]);
    const pointer = ref(-1);
    const pauseTracking = ref(false);
    const canUndo = ref(false);
    const canRedo = ref(false);
    const updateMeta = () => {
        canUndo.value = pointer.value > 0;
        canRedo.value = pointer.value < history.value.length - 1;
    };
    const pushSnapshot = (value) => {
        const snapshot = clone(value);
        // Clear redo history if changed mid-way
        if (pointer.value < history.value.length - 1)
            history.value.splice(pointer.value + 1);
        history.value.push(snapshot);
        pointer.value++;
        // Trim oldest if over capacity
        if (history.value.length > capacity) {
            history.value.shift();
            pointer.value--;
        }
        updateMeta();
    };
    const undo = () => {
        if (!canUndo.value)
            return;
        source.value = clone(history.value[pointer.value]);
        pointer.value--;
        source.value = clone(history.value[pointer.value]);
        pauseTracking.value = false;
        updateMeta();
    };
    const redo = () => {
        if (!canRedo.value)
            return;
        pauseTracking.value = true;
        pointer.value++;
        source.value = clone(history.value[pointer.value]);
        pauseTracking.value = false;
        updateMeta();
    };
    // Track changes automatically
    watch(source, (newVal) => {
        if (pauseTracking.value)
            return;
        const newStr = JSON.stringify(newVal);
        const oldStr = JSON.stringify(history.value[pointer.value]);
        if (newStr !== oldStr)
            pushSnapshot(newVal);
    }, { deep, immediate: true });
    return {
        history,
        pointer,
        canUndo,
        canRedo,
        undo,
        redo
    };
}
