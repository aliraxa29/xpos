export interface TableRow {
    [key: string]: any;
}

export type ColumnType =
    | "text"
    | "number"
    | "date"
    | "select"
    | "readonly"
    | "component";

export interface SelectOption {
    label: string;
    value: string | number;
}

export interface TableColumn {
    fieldname: string;
    label: string;
    type: ColumnType;
    width?: string;
    align?: "left" | "center" | "right";
    min?: number;
    max?: number;
    precision?: number;
    options?: SelectOption[] | ((row: TableRow, index: number) => SelectOption[]);
    format?: (value: any, row: TableRow, index: number) => string;
    cellClass?: string | ((value: any, row: TableRow, index: number) => string);
    editable?: boolean;
    visible?: boolean;
    required?: boolean;
    frozen?: "left" | "right";
    placeholder?: string;
    alwaysVisible?: boolean;
}

export interface TableProps {
    rows: TableRow[];
    columns: TableColumn[];
    label?: string;
    minWidth?: string;
    showRowNumbers?: boolean;
    showCheckboxes?: boolean;
    showDeleteButton?: boolean;
    showAddRow?: boolean;
    keyboardNavigation?: boolean;
    allowReorder?: boolean;
    allowDuplicate?: boolean;
    emptyMessage?: string;
    emptyDescription?: string;
    showColumnSettings?: boolean;
    highlightNewRows?: boolean;
    heightClass?: string;
}
