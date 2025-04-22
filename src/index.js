import EditableDataGrid from './components/DataGrid.vue';
import { useRefHistory } from './composables/useRefHistory';
export default {
    install(app) {
        app.component('EditableDataGrid', EditableDataGrid);
    }
};
export { EditableDataGrid, useRefHistory };
