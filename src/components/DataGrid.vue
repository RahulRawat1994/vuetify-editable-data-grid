<template>
  <v-container fluid class="pa-0">
    <!--  -->
    <v-row>
      <v-col cols="6" class="d-flex align-center">
        <slot name="header" />
      </v-col>
      <v-col cols="6" class="d-flex justify-end">
        <slot name="controls">
          <v-text-field
            v-model="search"
            label="Search"
            density="compact"
            hide-details
            class="my-2"
            style="max-width: 300px"
          />
          <v-btn
            v-tooltip:bottom="'Undo'"
            :disabled="!canUndo"
            variant="text"
            icon="mdi-undo"
            @click="undo"
          />

          <v-btn
            v-tooltip:bottom="'Redo'"
            variant="text"
            icon="mdi-redo"
            :disabled="!canRedo"
            @click="redo"
          />
          <v-menu offset-y :close-on-content-click="false" contained height="400">
            <template #activator="{ props: menuProps }">
              <v-btn v-bind="menuProps" icon variant="text">
                <v-badge :model-value="!areAllColumnsSelected" dot color="mpBlue">
                  <v-icon>mdi-filter-variant</v-icon>
                </v-badge>
              </v-btn>
            </template>
            <v-list v-model:selected="selectedColumns" select-strategy="leaf">
              <v-list-subheader class="font-weight-large">
                {{ $t('products.create.bulk-edit.filter-btn') }}
              </v-list-subheader>
              <v-list-item
                v-for="item in headers"
                :key="item.key"
                :title="item.title"
                :value="item.key"
                :disabled="item.permanent"
              >
                <template #prepend="{ isSelected }">
                  <v-list-item-action start>
                    <v-checkbox-btn
                      :model-value="isSelected"
                      @click.stop="handleSelectedColumnCheckBoxClick(item)"
                    />
                  </v-list-item-action>
                </template>
              </v-list-item>
            </v-list>
          </v-menu>
        </slot>
      </v-col>
    </v-row>
    <slot name="prepend" />
    <v-form ref="formRef">
      <v-data-table
        :headers="visibleHeaders"
        :items="filteredItems"
        class="custom-grid elevation-2 mt-4"
        hide-default-footer
        density="compact"
      >
        <template
          v-for="header in visibleHeaders"
          :key="header.key"
          #[`item.${header.key}`]="{ item, index }"
        >
          <div
            :id="`cell-${index}-${header.key}`"
            class="cell"
            :class="{
              selected: isSelected(index, header.key),
              fillZone: isInFillZone(index, header.key),
              nonEditable: !getColumnType(header.key),
              [`text-${header.align || 'center'}`]: true
            }"
            :data-row="index"
            :data-col="header.key"
            @click="selectCell(index, header.key)"
            @dblclick="startEditing(index, header.key)"
          >
            <v-tooltip
              v-if="errorMessage[`${index}-${header.key}`]"
              :activator="`parent`"
              location="top"
              content-class="error-tooltip"
            >
              {{ errorMessage[`${index}-${header.key}`] }}
            </v-tooltip>
            <template v-if="header.type === 'checkbox'">
              <v-checkbox
                v-model="items[index][header.key]"
                hide-details
                variant="plain"
                density="compact"
                class="d-flex justify-center align-center edit-input"
                autofocus
                v-bind="header.props"
              />
              <div
                v-if="
                  !header.hideHandle && isSelected(index, header.key) && getColumnType(header.key)
                "
                class="handle"
                @mousedown.stop.prevent="startDragFill"
              ></div>
            </template>
            <template v-else-if="header.type === 'select'">
              <v-select
                v-model="items[index][header.key]"
                :items="header.items"
                :item-title="header.itemTitle"
                :item-value="header.itemValue"
                hide-details
                variant="plain"
                density="compact"
                v-bind="header.props"
              />
              <div
                v-if="
                  !header.hideHandle && isSelected(index, header.key) && getColumnType(header.key)
                "
                class="handle"
                @mousedown.stop.prevent="startDragFill"
              ></div>
            </template>
            <template v-else>
              <div
                v-show="isEditing(index, header.key)"
                class="w-100"
                :class="{ show: isEditing(index, header.key) }"
              >
                <component
                  :is="getInputComponent(header.key)"
                  v-model="items[index][header.key]"
                  class="edit-input"
                  variant="plain"
                  density="compact"
                  autofocus
                  hide-details
                  v-bind="header.props"
                  @blur="(e) => stopEditing(e, `${index}-${header.key}`)"
                  @keydown.enter="(e) => stopEditing(e, `${index}-${header.key}`)"
                >
                  <template #append="{ isValid }">
                    <div v-if="!isValid.value" class="error-caret"></div>
                  </template>
                </component>
              </div>

              <template v-if="!isEditing(index, header.key)">
                <template v-if="header.type === 'number'">
                  {{ header.prefix }}
                  {{ item[header.key] ? formatNumber(item[header.key]) : item[header.key] }}
                  {{ header.suffix }}
                </template>
                <template v-else-if="header.type === 'currency'">
                  <AppPriceDisplay
                    :price="item[header.key]"
                    :currency="header.currency_code"
                    class="text-no-wrap"
                  />
                </template>
                <template v-else>
                  {{ header.prefix }} {{ item[header.key] }} {{ header.suffix }}
                </template>
                <div
                  v-if="
                    !header.hideHandle && isSelected(index, header.key) && getColumnType(header.key)
                  "
                  class="handle"
                  @mousedown.stop.prevent="startDragFill"
                ></div>
                <!-- <div v-if="errorMessage[`${items.indexOf(item)}-${header.key}`]" class="tooltip-error">
                  {{ errorMessage[`${items.indexOf(item)}-${header.key}`] }}
                </div> -->
              </template>
            </template>
          </div>
        </template>
      </v-data-table>
    </v-form>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, useTemplateRef } from 'vue'
import { useRefHistory } from '../composables/useRefHistory'
import { formatNumber } from '../utils/numberUtils'

const { headers } = defineProps({
  headers: {
    type: Array,
    default: () => []
  }
})
const model = defineModel({
  type: Array,
  default: () => [],
  required: true
})
const selectedColumns = ref([])
const formRef = useTemplateRef('formRef')
watch(
  () => headers,
  (newHeaders) => {
    if (selectedColumns.value.length === 0 && newHeaders.length > 0) {
      selectedColumns.value = newHeaders.map((item) => item.key)
    }
  },
  { immediate: true }
)

/**
 * Write a computed property that return boolean value if user remove any column from selectedColumns
 */
const areAllColumnsSelected = computed(() => {
  return headers.length === selectedColumns.value.length
})
const visibleHeaders = computed(() => headers.filter((h) => selectedColumns.value.includes(h.key)))

const handleSelectedColumnCheckBoxClick = (item) => {
  if (selectedColumns.value.includes(item.key)) {
    // Filter out the item and assign a new array
    selectedColumns.value = selectedColumns.value.filter((key) => key !== item.key)
  } else {
    // Create a new array to ensure reactivity
    selectedColumns.value = [...selectedColumns.value, item.key]
  }
}
const { canUndo, canRedo, undo, redo } = useRefHistory(model, { deep: true })
const items = model
const selectedCell = ref(null)
const fillTarget = ref(null)
const isDraggingHandle = ref(false)
const editingCell = ref({ row: null, key: null })
const search = ref('')

const filteredItems = computed(() => {
  if (!search.value) return items.value
  return items.value.filter((item) =>
    Object.values(item).some((v) => String(v).toLowerCase().includes(search.value.toLowerCase()))
  )
})

function getColumnType(key) {
  return headers.find((h) => h.key === key)?.type
}

function getInputComponent(key) {
  const type = getColumnType(key)
  switch (type) {
    case 'string':
      return 'v-text-field'
    case 'number':
    case 'currency':
      return 'v-number-input'
    case 'select':
      return 'v-autocomplete'
    case 'checkbox':
      return 'v-checkbox'
    default:
      return null
  }
}

function selectCell(row, key) {
  selectedCell.value = { row, key }
}

function isSelected(row, key) {
  return selectedCell.value?.row === row && selectedCell.value?.key === key
}

function isEditing(row, key) {
  return editingCell.value?.row === row && editingCell.value?.key === key
}

function startEditing(row, key) {
  if (!getColumnType(key)) return
  editingCell.value = { row, key }
}
const errorMessage = ref({})
function stopEditing(event, key) {
  const elId = event.target?.id
  if (elId) {
    formRef.value.errors.find((error) => {
      if (error.id === elId) {
        errorMessage.value[key] = error.errorMessages[0]
        return true
      }
    })
  }

  editingCell.value = { row: null, key: null }
}

function getDragDirection() {
  if (!selectedCell.value || !fillTarget.value) return null
  if (selectedCell.value.row !== fillTarget.value.row) return 'vertical'
  if (selectedCell.value.key !== fillTarget.value.key) return 'horizontal'
  return null
}

function isInFillZone(row, key) {
  if (!selectedCell.value || !fillTarget.value) return false

  const direction = getDragDirection()
  if (!direction) return false

  if (direction === 'vertical' && key === selectedCell.value.key) {
    const [start, end] = [selectedCell.value.row, fillTarget.value.row]
    return (start < end && row > start && row <= end) || (start > end && row < start && row >= end)
  }

  if (direction === 'horizontal' && row === selectedCell.value.row) {
    const allKeys = headers.map((h) => h.key)
    const [startIndex, endIndex] = [
      allKeys.indexOf(selectedCell.value.key),
      allKeys.indexOf(fillTarget.value.key)
    ].sort((a, b) => a - b)

    const colIndex = allKeys.indexOf(key)
    return colIndex > startIndex && colIndex <= endIndex
  }

  return false
}

function startDragFill() {
  isDraggingHandle.value = true
}

function onMouseMove(e) {
  if (!isDraggingHandle.value || !selectedCell.value) return
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const target = el?.closest?.('[data-row][data-col]')
  if (target) {
    fillTarget.value = {
      row: Number(target.dataset.row),
      key: target.dataset.col
    }
  }
}

function onMouseUp() {
  if (isDraggingHandle.value && selectedCell.value && fillTarget.value) {
    applyFill()
  }
  isDraggingHandle.value = false
  fillTarget.value = null
}

function applyFill() {
  const from = selectedCell.value
  const to = fillTarget.value
  const direction = getDragDirection()
  if (!direction) return

  if (direction === 'vertical') {
    const col = from.key

    // Map filtered index to actual index in `items`
    const fromActualRow = items.value.indexOf(filteredItems.value[from.row])
    const toActualRow = items.value.indexOf(filteredItems.value[to.row])
    if (fromActualRow === -1 || toActualRow === -1) return

    const value = items.value[fromActualRow][col]
    const [start, end] = [from.row, to.row].sort((a, b) => a - b)

    for (let i = start; i <= end; i++) {
      const actualRow = items.value.indexOf(filteredItems.value[i])
      if (actualRow !== -1) {
        items.value[actualRow][col] = value
      }
    }
  }

  if (direction === 'horizontal') {
    const filteredRow = from.row
    const actualRow = items.value.indexOf(filteredItems.value[filteredRow])
    if (actualRow === -1) return

    const value = items.value[actualRow][from.key]
    const allKeys = headers.map((h) => h.key)
    const [start, end] = [allKeys.indexOf(from.key), allKeys.indexOf(to.key)].sort((a, b) => a - b)

    for (let i = start + 1; i <= end; i++) {
      const key = allKeys[i]
      items.value[actualRow][key] = value
    }
  }
}
function handleKeydown(e) {
  if (!selectedCell.value || editingCell.value.row !== null) return

  const { row, key } = selectedCell.value
  const rowCount = filteredItems.value.length
  const colKeys = visibleHeaders.value.map((h) => h.key)
  const currentColIndex = colKeys.indexOf(key)

  if (e.key === 'ArrowDown') {
    const nextRow = Math.min(row + 1, rowCount - 1)
    selectCell(nextRow, key)
  } else if (e.key === 'ArrowUp') {
    const prevRow = Math.max(row - 1, 0)
    selectCell(prevRow, key)
  } else if (e.key === 'ArrowRight') {
    const nextColIndex = Math.min(currentColIndex + 1, colKeys.length - 1)
    const nextKey = colKeys[nextColIndex]
    selectCell(row, colKeys[nextColIndex])
    scrollCellIntoView(row, nextKey)
  } else if (e.key === 'ArrowLeft') {
    const prevColIndex = Math.max(currentColIndex - 1, 0)
    const prevKey = colKeys[prevColIndex]
    selectCell(row, colKeys[prevColIndex])
    scrollCellIntoView(row, prevKey)
  }
}
function scrollCellIntoView(row, key) {
  // Assumes your table cells have a unique ID like: `cell-${row}-${key}`
  const el = document.getElementById(`cell-${row}-${key}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }
}

console.time('Total Mounting time')

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('keydown', handleKeydown)

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo()
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') redo()
  })
  console.timeEnd('Total Mounting time')
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('keydown', handleKeydown)
})

defineExpose({
  formRef
})
</script>
<style scoped>
/* Table styles */
:deep(.custom-grid td),
:deep(.custom-grid th) {
  border-left: thin solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
}

:deep(.custom-grid td.v-data-table__td) {
  padding: 0 !important;
}

:deep(.v-data-table thead th) {
  background-color: #f7f7f9; /* light gray background */
  border-left: 1px solid #ccc;
  border-top: 1px solid #ccc;
  color: #333;
  font-size: 13px;
  font-weight: bold;
  white-space: nowrap;
}

:deep(.custom-grid span.v-select__selection-text) {
  font-size: 13px !important;
  padding-left: 0.5rem !important;
}

:deep(.custom-grid .v-data-table-header__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap !important;
}
:deep(.custom-grid .v-input__details) {
  position: absolute;
}

/* Cell base styles */
.cell {
  align-items: center;
  border: 1px solid transparent;
  cursor: pointer;
  display: flex;
  font-size: 13px;
  justify-content: center;
  margin: 0;
  min-height: 42px;
  padding: 0 16px !important;
  position: relative;
  user-select: none;
}

/* Cell alignment modifiers */
.cell.text-center {
  justify-content: center;
}

.cell.text-left {
  justify-content: start;
}

.cell.text-right {
  justify-content: end;
}

/* Cell appearance modifiers */
.cell.nonEditable {
  background-color: #f7f7f9;
  color: #333;
}

.cell.selected {
  border: 1px solid rgb(var(--v-theme-primary));
  box-shadow: 0px 0px 2px rgb(var(--v-theme-primary));
}

.cell.selected:has(.error-caret) {
  border: 1px solid rgb(var(--v-theme-error));
  box-shadow: 0px 0px 2px rgb(var(--v-theme-error));
}

.cell.fillZone {
  background-color: #d0ebff;
}

/* Cell content visibility/input overrides */
.cell.show:has(.v-input),
:deep(.cell .show .v-field__field input) {
  padding: 0px 0px !important;
}

/* Error caret triangle */
.cell:has(.error-caret)::after {
  border-left: 8px solid transparent;
  border-right: 0px solid rgb(var(--v-theme-error));
  border-top: 8px solid rgb(var(--v-theme-error));
  content: ' ';
  height: 0;
  position: absolute;
  right: 0;
  top: 0;
  width: 0;
}

/* Resize handle */
.handle {
  background: #228be6;
  border-radius: 1rem;
  bottom: -5px;
  color: white;
  cursor: grab;
  font-size: 0.5rem;
  height: 10px;
  line-height: 10px;
  position: absolute;
  right: -5px;
  text-align: center;
  width: 10px;
}

:deep(.v-overlay__content.error-tooltip) {
  background-color: rgb(var(--v-theme-error)) !important;
}
/* Inline edit input */
.edit-input {
  border: none;
  height: 100%;
  outline: none;
  padding: 0px;
  text-align: center;
  width: 100%;
}

:deep(.edit-input input) {
  font-size: 13px !important;
  padding: 8px !important;
}

/* Control panel styling */
.controls {
  align-items: center;
  display: flex;
  gap: 10px;
  justify-content: end;
  padding: 10px 0px;
}
</style>
