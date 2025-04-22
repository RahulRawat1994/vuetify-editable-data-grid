# EditableDataTable

A highly customizable and interactive editable data table component built with Vue 3 and Vuetify 3. This component supports inline editing, undo/redo functionality, column visibility filters, drag-to-fill (like Excel), and more.

## 🚀 Features
* 📋 Editable cells (text, number, currency, select, checkbox)
* 🔍 Search filter across all fields
* 🔄 Undo/Redo support
* 📌 Column visibility toggle with badge indicator
* 🖱️ Drag-to-fill across rows and columns
* 🧭 Keyboard navigation (Arrow keys)
* 💡 Tooltips for validation errors
* 🎨 Fully styled and responsive


----

## 📦 Props
|Prop | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
|headers | Array | ✅ | [] | Defines table headers and column configs|
|modelValue (v-model) | Array | ✅ | [] | List of table row items (data)|


Each header object in headers should contain:

```js
{
  key: 'columnKey',
  title: 'Column Title',
  type: 'string' | 'number' | 'currency' | 'select' | 'checkbox',
  prefix: '', // optional
  suffix: '', // optional
  items: [], // for select
  itemTitle: 'name', // for select
  itemValue: 'id',   // for select
  align: 'left' | 'center' | 'right',
  props: {}, // additional Vuetify props for inputs
  permanent: false, // if true, can't be hidden
  hideHandle: false // if true, disables drag handle
}

```
----

## 🧩 Slots
|Name | Description|
|-----|------------|
|header | Custom content in the left side of top bar|
|controls | Override default controls (search, undo/redo)|
|prepend | Content before the data table (e.g., tips)|

-----

## 📚 Usage

```vue
<EditableDataTable
  v-model="tableData"
  :headers="tableHeaders"
>
  <template #header>
    <h2>Bulk Product Editor</h2>
  </template>
</EditableDataTable>
```

----

## 🧠 Keyboard Shortcuts
* ↑ ↓ ← → - Move between cells
* Enter / Blur - Save current cell
* Ctrl/Cmd + Z - Undo
* Ctrl/Cmd + Y - Redo

------

## 📌 Column Filtering
Click the filter icon in the control bar to toggle visible columns. A dot indicator appears when not all columns are shown.

------
## ✨ Advanced Features

### Drag-to-fill
Click and drag the handle on a selected cell to apply the value across adjacent rows or columns (similar to Excel autofill).

### Validation Tooltip
Errors are displayed in tooltips on hover. Validation messages should be injected via the form ref.

-------

## 📦 Dependencies
* Vue 3
* Vuetify 3
* Custom composable useRefHistory (for undo/redo)
* Optional: AppPriceDisplay component (custom price formatting)

-----
## 🛠 Dev Notes
* formRef is exposed via defineExpose to allow external validation triggering.
* Error highlighting and caret indicators are shown based on the form's validation state.
* CSS heavily leverages :deep() for Vuetify component overrides.

------ 

📁 File Structure
The component is self-contained with scoped styles. To integrate:
* Import and register the component.
* Provide headers and model data.
* Optionally inject validation logic and custom slot content.


-----

## License
This package is licensed under the MIT License.

-----

