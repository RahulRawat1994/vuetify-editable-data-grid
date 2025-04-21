import EditableDataGrid from './components/DataGrid.vue'
import { useRefHistory } from './composables/useRefHistory';

export default {
  install(app: { component: (arg0: string, arg1: typeof EditableDataGrid) => void }) {
    app.component('EditableDataGrid', EditableDataGrid)
  }
}

export { EditableDataGrid, useRefHistory };