import { ref, computed, onMounted, onBeforeUnmount, watch, useTemplateRef } from 'vue';
import { useRefHistory } from '../composables/useRefHistory';
import { formatNumber } from '../utils/numberUtils';
const { headers } = defineProps({
    headers: {
        type: Array,
        default: () => []
    }
});
const model = defineModel({
    type: Array,
    default: () => [],
    required: true
});
const selectedColumns = ref([]);
const formRef = useTemplateRef(__VLS_placeholder);
watch(() => headers, (newHeaders) => {
    if (selectedColumns.value.length === 0 && newHeaders.length > 0) {
        selectedColumns.value = newHeaders.map((item) => item.key);
    }
}, { immediate: true });
/**
 * Write a computed property that return boolean value if user remove any column from selectedColumns
 */
const areAllColumnsSelected = computed(() => {
    return headers.length === selectedColumns.value.length;
});
const visibleHeaders = computed(() => headers.filter((h) => selectedColumns.value.includes(h.key)));
const handleSelectedColumnCheckBoxClick = (item) => {
    if (selectedColumns.value.includes(item.key)) {
        // Filter out the item and assign a new array
        selectedColumns.value = selectedColumns.value.filter((key) => key !== item.key);
    }
    else {
        // Create a new array to ensure reactivity
        selectedColumns.value = [...selectedColumns.value, item.key];
    }
};
const { canUndo, canRedo, undo, redo } = useRefHistory(model, { deep: true });
const items = model;
const selectedCell = ref(null);
const fillTarget = ref(null);
const isDraggingHandle = ref(false);
const editingCell = ref({ row: null, key: null });
const search = ref('');
const filteredItems = computed(() => {
    if (!search.value)
        return items.value;
    return items.value.filter((item) => Object.values(item).some((v) => String(v).toLowerCase().includes(search.value.toLowerCase())));
});
function getColumnType(key) {
    return headers.find((h) => h.key === key)?.type;
}
function getInputComponent(key) {
    const type = getColumnType(key);
    switch (type) {
        case 'string':
            return 'v-text-field';
        case 'number':
        case 'currency':
            return 'v-number-input';
        case 'select':
            return 'v-autocomplete';
        case 'checkbox':
            return 'v-checkbox';
        default:
            return null;
    }
}
function selectCell(row, key) {
    selectedCell.value = { row, key };
}
function isSelected(row, key) {
    return selectedCell.value?.row === row && selectedCell.value?.key === key;
}
function isEditing(row, key) {
    return editingCell.value?.row === row && editingCell.value?.key === key;
}
function startEditing(row, key) {
    if (!getColumnType(key))
        return;
    editingCell.value = { row, key };
}
const errorMessage = ref({});
function stopEditing(event, key) {
    const elId = event.target?.id;
    if (elId) {
        formRef.value.errors.find((error) => {
            if (error.id === elId) {
                errorMessage.value[key] = error.errorMessages[0];
                return true;
            }
        });
    }
    editingCell.value = { row: null, key: null };
}
function getDragDirection() {
    if (!selectedCell.value || !fillTarget.value)
        return null;
    if (selectedCell.value.row !== fillTarget.value.row)
        return 'vertical';
    if (selectedCell.value.key !== fillTarget.value.key)
        return 'horizontal';
    return null;
}
function isInFillZone(row, key) {
    if (!selectedCell.value || !fillTarget.value)
        return false;
    const direction = getDragDirection();
    if (!direction)
        return false;
    if (direction === 'vertical' && key === selectedCell.value.key) {
        const [start, end] = [selectedCell.value.row, fillTarget.value.row];
        return (start < end && row > start && row <= end) || (start > end && row < start && row >= end);
    }
    if (direction === 'horizontal' && row === selectedCell.value.row) {
        const allKeys = headers.map((h) => h.key);
        const [startIndex, endIndex] = [
            allKeys.indexOf(selectedCell.value.key),
            allKeys.indexOf(fillTarget.value.key)
        ].sort((a, b) => a - b);
        const colIndex = allKeys.indexOf(key);
        return colIndex > startIndex && colIndex <= endIndex;
    }
    return false;
}
function startDragFill() {
    isDraggingHandle.value = true;
}
function onMouseMove(e) {
    if (!isDraggingHandle.value || !selectedCell.value)
        return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el?.closest?.('[data-row][data-col]');
    if (target) {
        fillTarget.value = {
            row: Number(target.dataset.row),
            key: target.dataset.col
        };
    }
}
function onMouseUp() {
    if (isDraggingHandle.value && selectedCell.value && fillTarget.value) {
        applyFill();
    }
    isDraggingHandle.value = false;
    fillTarget.value = null;
}
function applyFill() {
    const from = selectedCell.value;
    const to = fillTarget.value;
    const direction = getDragDirection();
    if (!direction)
        return;
    if (direction === 'vertical') {
        const col = from.key;
        // Map filtered index to actual index in `items`
        const fromActualRow = items.value.indexOf(filteredItems.value[from.row]);
        const toActualRow = items.value.indexOf(filteredItems.value[to.row]);
        if (fromActualRow === -1 || toActualRow === -1)
            return;
        const value = items.value[fromActualRow][col];
        const [start, end] = [from.row, to.row].sort((a, b) => a - b);
        for (let i = start; i <= end; i++) {
            const actualRow = items.value.indexOf(filteredItems.value[i]);
            if (actualRow !== -1) {
                items.value[actualRow][col] = value;
            }
        }
    }
    if (direction === 'horizontal') {
        const filteredRow = from.row;
        const actualRow = items.value.indexOf(filteredItems.value[filteredRow]);
        if (actualRow === -1)
            return;
        const value = items.value[actualRow][from.key];
        const allKeys = headers.map((h) => h.key);
        const [start, end] = [allKeys.indexOf(from.key), allKeys.indexOf(to.key)].sort((a, b) => a - b);
        for (let i = start + 1; i <= end; i++) {
            const key = allKeys[i];
            items.value[actualRow][key] = value;
        }
    }
}
function handleKeydown(e) {
    if (!selectedCell.value || editingCell.value.row !== null)
        return;
    const { row, key } = selectedCell.value;
    const rowCount = filteredItems.value.length;
    const colKeys = visibleHeaders.value.map((h) => h.key);
    const currentColIndex = colKeys.indexOf(key);
    if (e.key === 'ArrowDown') {
        const nextRow = Math.min(row + 1, rowCount - 1);
        selectCell(nextRow, key);
    }
    else if (e.key === 'ArrowUp') {
        const prevRow = Math.max(row - 1, 0);
        selectCell(prevRow, key);
    }
    else if (e.key === 'ArrowRight') {
        const nextColIndex = Math.min(currentColIndex + 1, colKeys.length - 1);
        const nextKey = colKeys[nextColIndex];
        selectCell(row, colKeys[nextColIndex]);
        scrollCellIntoView(row, nextKey);
    }
    else if (e.key === 'ArrowLeft') {
        const prevColIndex = Math.max(currentColIndex - 1, 0);
        const prevKey = colKeys[prevColIndex];
        selectCell(row, colKeys[prevColIndex]);
        scrollCellIntoView(row, prevKey);
    }
}
function scrollCellIntoView(row, key) {
    // Assumes your table cells have a unique ID like: `cell-${row}-${key}`
    const el = document.getElementById(`cell-${row}-${key}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
}
console.time('Total Mounting time');
onMounted(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z')
            undo();
        if ((e.ctrlKey || e.metaKey) && e.key === 'y')
            redo();
    });
    console.timeEnd('Total Mounting time');
});
onBeforeUnmount(() => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('keydown', handleKeydown);
});
const __VLS_exposed = {
    formRef
};
defineExpose(__VLS_exposed);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_defaults = {
    'modelValue': () => [],
};
const __VLS_modelEmit = defineEmits < __VLS_ModelEmit > ();
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['custom-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['selected']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['show']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['error-caret']} */ ;
/** @type {__VLS_StyleScopedClasses['edit-input']} */ ;
// CSS variable injection 
// CSS variable injection end 
const __VLS_0 = {}.VContainer;
/** @type {[typeof __VLS_components.VContainer, typeof __VLS_components.vContainer, typeof __VLS_components.VContainer, typeof __VLS_components.vContainer, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    fluid: true,
    ...{ class: "pa-0" },
}));
const __VLS_2 = __VLS_1({
    fluid: true,
    ...{ class: "pa-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_4 = {};
__VLS_3.slots.default;
const __VLS_5 = {}.VRow;
/** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({}));
const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_8.slots.default;
const __VLS_9 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
    cols: "6",
    ...{ class: "d-flex align-center" },
}));
const __VLS_11 = __VLS_10({
    cols: "6",
    ...{ class: "d-flex align-center" },
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
__VLS_12.slots.default;
var __VLS_13 = {};
var __VLS_12;
const __VLS_15 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
    cols: "6",
    ...{ class: "d-flex justify-end" },
}));
const __VLS_17 = __VLS_16({
    cols: "6",
    ...{ class: "d-flex justify-end" },
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
__VLS_18.slots.default;
var __VLS_19 = {};
const __VLS_21 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
    modelValue: (__VLS_ctx.search),
    label: "Search",
    density: "compact",
    hideDetails: true,
    ...{ class: "my-2" },
    ...{ style: {} },
}));
const __VLS_23 = __VLS_22({
    modelValue: (__VLS_ctx.search),
    label: "Search",
    density: "compact",
    hideDetails: true,
    ...{ class: "my-2" },
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
const __VLS_25 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
    ...{ 'onClick': {} },
    disabled: (!__VLS_ctx.canUndo),
    variant: "text",
    icon: "mdi-undo",
}));
const __VLS_27 = __VLS_26({
    ...{ 'onClick': {} },
    disabled: (!__VLS_ctx.canUndo),
    variant: "text",
    icon: "mdi-undo",
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
let __VLS_29;
let __VLS_30;
let __VLS_31;
const __VLS_32 = {
    onClick: (__VLS_ctx.undo)
};
__VLS_asFunctionalDirective(__VLS_directives.vTooltip)(null, { ...__VLS_directiveBindingRestFields, arg: 'bottom', value: ('Undo') }, null, null);
var __VLS_28;
const __VLS_33 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
    ...{ 'onClick': {} },
    variant: "text",
    icon: "mdi-redo",
    disabled: (!__VLS_ctx.canRedo),
}));
const __VLS_35 = __VLS_34({
    ...{ 'onClick': {} },
    variant: "text",
    icon: "mdi-redo",
    disabled: (!__VLS_ctx.canRedo),
}, ...__VLS_functionalComponentArgsRest(__VLS_34));
let __VLS_37;
let __VLS_38;
let __VLS_39;
const __VLS_40 = {
    onClick: (__VLS_ctx.redo)
};
__VLS_asFunctionalDirective(__VLS_directives.vTooltip)(null, { ...__VLS_directiveBindingRestFields, arg: 'bottom', value: ('Redo') }, null, null);
var __VLS_36;
const __VLS_41 = {}.VMenu;
/** @type {[typeof __VLS_components.VMenu, typeof __VLS_components.vMenu, typeof __VLS_components.VMenu, typeof __VLS_components.vMenu, ]} */ ;
// @ts-ignore
const __VLS_42 = __VLS_asFunctionalComponent(__VLS_41, new __VLS_41({
    offsetY: true,
    closeOnContentClick: (false),
    contained: true,
    height: "400",
}));
const __VLS_43 = __VLS_42({
    offsetY: true,
    closeOnContentClick: (false),
    contained: true,
    height: "400",
}, ...__VLS_functionalComponentArgsRest(__VLS_42));
__VLS_44.slots.default;
{
    const { activator: __VLS_thisSlot } = __VLS_44.slots;
    const { props: menuProps } = __VLS_getSlotParam(__VLS_thisSlot);
    const __VLS_45 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
        ...(menuProps),
        icon: true,
        variant: "text",
    }));
    const __VLS_47 = __VLS_46({
        ...(menuProps),
        icon: true,
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    __VLS_48.slots.default;
    const __VLS_49 = {}.VBadge;
    /** @type {[typeof __VLS_components.VBadge, typeof __VLS_components.vBadge, typeof __VLS_components.VBadge, typeof __VLS_components.vBadge, ]} */ ;
    // @ts-ignore
    const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({
        modelValue: (!__VLS_ctx.areAllColumnsSelected),
        dot: true,
        color: "mpBlue",
    }));
    const __VLS_51 = __VLS_50({
        modelValue: (!__VLS_ctx.areAllColumnsSelected),
        dot: true,
        color: "mpBlue",
    }, ...__VLS_functionalComponentArgsRest(__VLS_50));
    __VLS_52.slots.default;
    const __VLS_53 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({}));
    const __VLS_55 = __VLS_54({}, ...__VLS_functionalComponentArgsRest(__VLS_54));
    __VLS_56.slots.default;
    var __VLS_56;
    var __VLS_52;
    var __VLS_48;
}
const __VLS_57 = {}.VList;
/** @type {[typeof __VLS_components.VList, typeof __VLS_components.vList, typeof __VLS_components.VList, typeof __VLS_components.vList, ]} */ ;
// @ts-ignore
const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
    selected: (__VLS_ctx.selectedColumns),
    selectStrategy: "leaf",
}));
const __VLS_59 = __VLS_58({
    selected: (__VLS_ctx.selectedColumns),
    selectStrategy: "leaf",
}, ...__VLS_functionalComponentArgsRest(__VLS_58));
__VLS_60.slots.default;
const __VLS_61 = {}.VListSubheader;
/** @type {[typeof __VLS_components.VListSubheader, typeof __VLS_components.vListSubheader, typeof __VLS_components.VListSubheader, typeof __VLS_components.vListSubheader, ]} */ ;
// @ts-ignore
const __VLS_62 = __VLS_asFunctionalComponent(__VLS_61, new __VLS_61({
    ...{ class: "font-weight-large" },
}));
const __VLS_63 = __VLS_62({
    ...{ class: "font-weight-large" },
}, ...__VLS_functionalComponentArgsRest(__VLS_62));
__VLS_64.slots.default;
(__VLS_ctx.$t('products.create.bulk-edit.filter-btn'));
var __VLS_64;
for (const [item] of __VLS_getVForSourceType((headers))) {
    const __VLS_65 = {}.VListItem;
    /** @type {[typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, ]} */ ;
    // @ts-ignore
    const __VLS_66 = __VLS_asFunctionalComponent(__VLS_65, new __VLS_65({
        key: (item.key),
        title: (item.title),
        value: (item.key),
        disabled: (item.permanent),
    }));
    const __VLS_67 = __VLS_66({
        key: (item.key),
        title: (item.title),
        value: (item.key),
        disabled: (item.permanent),
    }, ...__VLS_functionalComponentArgsRest(__VLS_66));
    __VLS_68.slots.default;
    {
        const { prepend: __VLS_thisSlot } = __VLS_68.slots;
        const [{ isSelected }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_69 = {}.VListItemAction;
        /** @type {[typeof __VLS_components.VListItemAction, typeof __VLS_components.vListItemAction, typeof __VLS_components.VListItemAction, typeof __VLS_components.vListItemAction, ]} */ ;
        // @ts-ignore
        const __VLS_70 = __VLS_asFunctionalComponent(__VLS_69, new __VLS_69({
            start: true,
        }));
        const __VLS_71 = __VLS_70({
            start: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_70));
        __VLS_72.slots.default;
        const __VLS_73 = {}.VCheckboxBtn;
        /** @type {[typeof __VLS_components.VCheckboxBtn, typeof __VLS_components.vCheckboxBtn, ]} */ ;
        // @ts-ignore
        const __VLS_74 = __VLS_asFunctionalComponent(__VLS_73, new __VLS_73({
            ...{ 'onClick': {} },
            modelValue: (isSelected),
        }));
        const __VLS_75 = __VLS_74({
            ...{ 'onClick': {} },
            modelValue: (isSelected),
        }, ...__VLS_functionalComponentArgsRest(__VLS_74));
        let __VLS_77;
        let __VLS_78;
        let __VLS_79;
        const __VLS_80 = {
            onClick: (...[$event]) => {
                __VLS_ctx.handleSelectedColumnCheckBoxClick(item);
            }
        };
        var __VLS_76;
        var __VLS_72;
    }
    var __VLS_68;
}
var __VLS_60;
var __VLS_44;
var __VLS_18;
var __VLS_8;
var __VLS_81 = {};
const __VLS_83 = {}.VForm;
/** @type {[typeof __VLS_components.VForm, typeof __VLS_components.vForm, typeof __VLS_components.VForm, typeof __VLS_components.vForm, ]} */ ;
// @ts-ignore
const __VLS_84 = __VLS_asFunctionalComponent(__VLS_83, new __VLS_83({
    ref: "formRef",
}));
const __VLS_85 = __VLS_84({
    ref: "formRef",
}, ...__VLS_functionalComponentArgsRest(__VLS_84));
/** @type {typeof __VLS_ctx.formRef} */ ;
var __VLS_87 = {};
__VLS_86.slots.default;
const __VLS_89 = {}.VDataTable;
/** @type {[typeof __VLS_components.VDataTable, typeof __VLS_components.vDataTable, typeof __VLS_components.VDataTable, typeof __VLS_components.vDataTable, ]} */ ;
// @ts-ignore
const __VLS_90 = __VLS_asFunctionalComponent(__VLS_89, new __VLS_89({
    headers: (__VLS_ctx.visibleHeaders),
    items: (__VLS_ctx.filteredItems),
    ...{ class: "custom-grid elevation-2 mt-4" },
    hideDefaultFooter: true,
    density: "compact",
}));
const __VLS_91 = __VLS_90({
    headers: (__VLS_ctx.visibleHeaders),
    items: (__VLS_ctx.filteredItems),
    ...{ class: "custom-grid elevation-2 mt-4" },
    hideDefaultFooter: true,
    density: "compact",
}, ...__VLS_functionalComponentArgsRest(__VLS_90));
__VLS_92.slots.default;
for (const [header] of __VLS_getVForSourceType((__VLS_ctx.visibleHeaders))) {
    {
        const { [__VLS_tryAsConstant(`item.${header.key}`)]: __VLS_thisSlot } = __VLS_92.slots;
        const [{ item, index }] = __VLS_getSlotParams(__VLS_thisSlot);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    __VLS_ctx.selectCell(index, header.key);
                } },
            ...{ onDblclick: (...[$event]) => {
                    __VLS_ctx.startEditing(index, header.key);
                } },
            id: (`cell-${index}-${header.key}`),
            ...{ class: "cell" },
            ...{ class: ({
                    selected: __VLS_ctx.isSelected(index, header.key),
                    fillZone: __VLS_ctx.isInFillZone(index, header.key),
                    nonEditable: !__VLS_ctx.getColumnType(header.key),
                    [`text-${header.align || 'center'}`]: true
                }) },
            'data-row': (index),
            'data-col': (header.key),
        });
        if (__VLS_ctx.errorMessage[`${index}-${header.key}`]) {
            const __VLS_93 = {}.VTooltip;
            /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
            // @ts-ignore
            const __VLS_94 = __VLS_asFunctionalComponent(__VLS_93, new __VLS_93({
                activator: (`parent`),
                location: "top",
                contentClass: "error-tooltip",
            }));
            const __VLS_95 = __VLS_94({
                activator: (`parent`),
                location: "top",
                contentClass: "error-tooltip",
            }, ...__VLS_functionalComponentArgsRest(__VLS_94));
            __VLS_96.slots.default;
            (__VLS_ctx.errorMessage[`${index}-${header.key}`]);
            var __VLS_96;
        }
        if (header.type === 'checkbox') {
            const __VLS_97 = {}.VCheckbox;
            /** @type {[typeof __VLS_components.VCheckbox, typeof __VLS_components.vCheckbox, ]} */ ;
            // @ts-ignore
            const __VLS_98 = __VLS_asFunctionalComponent(__VLS_97, new __VLS_97({
                modelValue: (__VLS_ctx.items[index][header.key]),
                hideDetails: true,
                variant: "plain",
                density: "compact",
                ...{ class: "d-flex justify-center align-center edit-input" },
                autofocus: true,
                ...(header.props),
            }));
            const __VLS_99 = __VLS_98({
                modelValue: (__VLS_ctx.items[index][header.key]),
                hideDetails: true,
                variant: "plain",
                density: "compact",
                ...{ class: "d-flex justify-center align-center edit-input" },
                autofocus: true,
                ...(header.props),
            }, ...__VLS_functionalComponentArgsRest(__VLS_98));
            if (!header.hideHandle && __VLS_ctx.isSelected(index, header.key) && __VLS_ctx.getColumnType(header.key)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ onMousedown: (__VLS_ctx.startDragFill) },
                    ...{ class: "handle" },
                });
            }
        }
        else if (header.type === 'select') {
            const __VLS_101 = {}.VSelect;
            /** @type {[typeof __VLS_components.VSelect, typeof __VLS_components.vSelect, ]} */ ;
            // @ts-ignore
            const __VLS_102 = __VLS_asFunctionalComponent(__VLS_101, new __VLS_101({
                modelValue: (__VLS_ctx.items[index][header.key]),
                items: (header.items),
                itemTitle: (header.itemTitle),
                itemValue: (header.itemValue),
                hideDetails: true,
                variant: "plain",
                density: "compact",
                ...(header.props),
            }));
            const __VLS_103 = __VLS_102({
                modelValue: (__VLS_ctx.items[index][header.key]),
                items: (header.items),
                itemTitle: (header.itemTitle),
                itemValue: (header.itemValue),
                hideDetails: true,
                variant: "plain",
                density: "compact",
                ...(header.props),
            }, ...__VLS_functionalComponentArgsRest(__VLS_102));
            if (!header.hideHandle && __VLS_ctx.isSelected(index, header.key) && __VLS_ctx.getColumnType(header.key)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ onMousedown: (__VLS_ctx.startDragFill) },
                    ...{ class: "handle" },
                });
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "w-100" },
                ...{ class: ({ show: __VLS_ctx.isEditing(index, header.key) }) },
            });
            __VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.isEditing(index, header.key)) }, null, null);
            const __VLS_105 = ((__VLS_ctx.getInputComponent(header.key)));
            // @ts-ignore
            const __VLS_106 = __VLS_asFunctionalComponent(__VLS_105, new __VLS_105({
                ...{ 'onBlur': {} },
                ...{ 'onKeydown': {} },
                modelValue: (__VLS_ctx.items[index][header.key]),
                ...{ class: "edit-input" },
                variant: "plain",
                density: "compact",
                autofocus: true,
                hideDetails: true,
                ...(header.props),
            }));
            const __VLS_107 = __VLS_106({
                ...{ 'onBlur': {} },
                ...{ 'onKeydown': {} },
                modelValue: (__VLS_ctx.items[index][header.key]),
                ...{ class: "edit-input" },
                variant: "plain",
                density: "compact",
                autofocus: true,
                hideDetails: true,
                ...(header.props),
            }, ...__VLS_functionalComponentArgsRest(__VLS_106));
            let __VLS_109;
            let __VLS_110;
            let __VLS_111;
            const __VLS_112 = {
                onBlur: ((e) => __VLS_ctx.stopEditing(e, `${index}-${header.key}`))
            };
            const __VLS_113 = {
                onKeydown: ((e) => __VLS_ctx.stopEditing(e, `${index}-${header.key}`))
            };
            __VLS_108.slots.default;
            {
                const { append: __VLS_thisSlot } = __VLS_108.slots;
                const [{ isValid }] = __VLS_getSlotParams(__VLS_thisSlot);
                if (!isValid.value) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "error-caret" },
                    });
                }
            }
            var __VLS_108;
            if (!__VLS_ctx.isEditing(index, header.key)) {
                if (header.type === 'number') {
                    (header.prefix);
                    (item[header.key] ? __VLS_ctx.formatNumber(item[header.key]) : item[header.key]);
                    (header.suffix);
                }
                else if (header.type === 'currency') {
                    const __VLS_114 = {}.AppPriceDisplay;
                    /** @type {[typeof __VLS_components.AppPriceDisplay, ]} */ ;
                    // @ts-ignore
                    const __VLS_115 = __VLS_asFunctionalComponent(__VLS_114, new __VLS_114({
                        price: (item[header.key]),
                        currency: (header.currency_code),
                        ...{ class: "text-no-wrap" },
                    }));
                    const __VLS_116 = __VLS_115({
                        price: (item[header.key]),
                        currency: (header.currency_code),
                        ...{ class: "text-no-wrap" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_115));
                }
                else {
                    (header.prefix);
                    (item[header.key]);
                    (header.suffix);
                }
                if (!header.hideHandle && __VLS_ctx.isSelected(index, header.key) && __VLS_ctx.getColumnType(header.key)) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ onMousedown: (__VLS_ctx.startDragFill) },
                        ...{ class: "handle" },
                    });
                }
            }
        }
    }
}
var __VLS_92;
var __VLS_86;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['pa-0']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['my-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-weight-large']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['elevation-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['selected']} */ ;
/** @type {__VLS_StyleScopedClasses['fillZone']} */ ;
/** @type {__VLS_StyleScopedClasses['nonEditable']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['edit-input']} */ ;
/** @type {__VLS_StyleScopedClasses['handle']} */ ;
/** @type {__VLS_StyleScopedClasses['handle']} */ ;
/** @type {__VLS_StyleScopedClasses['w-100']} */ ;
/** @type {__VLS_StyleScopedClasses['show']} */ ;
/** @type {__VLS_StyleScopedClasses['edit-input']} */ ;
/** @type {__VLS_StyleScopedClasses['error-caret']} */ ;
/** @type {__VLS_StyleScopedClasses['text-no-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['handle']} */ ;
// @ts-ignore
var __VLS_14 = __VLS_13, __VLS_20 = __VLS_19, __VLS_82 = __VLS_81, __VLS_88 = __VLS_87;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            $props: __VLS_makeOptional({ headers }),
            ...{ headers },
            formatNumber: formatNumber,
            selectedColumns: selectedColumns,
            areAllColumnsSelected: areAllColumnsSelected,
            visibleHeaders: visibleHeaders,
            handleSelectedColumnCheckBoxClick: handleSelectedColumnCheckBoxClick,
            canUndo: canUndo,
            canRedo: canRedo,
            undo: undo,
            redo: redo,
            items: items,
            search: search,
            filteredItems: filteredItems,
            getColumnType: getColumnType,
            getInputComponent: getInputComponent,
            selectCell: selectCell,
            isSelected: isSelected,
            isEditing: isEditing,
            startEditing: startEditing,
            errorMessage: errorMessage,
            stopEditing: stopEditing,
            isInFillZone: isInFillZone,
            startDragFill: startDragFill,
        };
    },
});
const __VLS_component = (await import('vue')).defineComponent({
    setup() {
        return {
            $props: __VLS_makeOptional({ headers }),
            ...{ headers },
            ...__VLS_exposed,
        };
    },
});
export default {};
; /* PartiallyEnd: #4569/main.vue */
