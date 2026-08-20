import { provide } from "@/utils";
import { call } from "./api";

export interface DocField {
	fieldname: string;
	fieldtype: string;
	label?: string;
	options?: string;
	reqd?: 0 | 1;
	bold?: 0 | 1;
	in_list_view?: 0 | 1;
	in_standard_filter?: 0 | 1;
	in_global_search?: 0 | 1;
	hidden?: 0 | 1;
	read_only?: 0 | 1;
	default?: string;
	depends_on?: string;
	length?: number;
	precision?: string;
}

export interface DoctypeMeta {
	name: string;
	fields: DocField[];
	title_field?: string;
	search_fields?: string;
	sort_field?: string;
	sort_order?: string;
	is_submittable?: 0 | 1;
}

const NON_VALUE_FIELDTYPES = new Set([
	"Section Break",
	"Column Break",
	"Tab Break",
	"HTML",
	"Table",
	"Table MultiSelect",
	"Button",
	"Fold",
	"Heading",
	"Image",
	"Signature",
	"Connection",
]);

async function fetchDoctypeMetaFromServer(doctype: string): Promise<DoctypeMeta> {
	const response = await call<any>("frappe.desk.form.load.getdoctype", { doctype, with_parent: true });
	provide("locals.DocType");
	const docs: any[] = (response as any)?.docs ?? [];
	if (docs.length === 0) {
		throw new Error(`Failed to fetch meta for ${doctype}`);
	}

	docs.forEach((doc) => {
		if (doc.name) {
			locals.DocType[doc.name] = doc;
		}
	});

	return locals.DocType[doctype];
}

export async function getDoctypeMeta(doctype: string): Promise<DoctypeMeta> {
	if (locals.DocType && locals.DocType[doctype]) {
		return locals.DocType[doctype];
	}

	const meta = await fetchDoctypeMetaFromServer(doctype);
	return meta;
}

export function isValueType(fieldtype: string): boolean {
	return !NON_VALUE_FIELDTYPES.has(fieldtype);
}

export function getStandardFilterFields(meta: DoctypeMeta): DocField[] {
	const fields = meta.fields.filter(
		(f) => f.in_standard_filter === 1 && isValueType(f.fieldtype) && !f.hidden,
	);

	if (meta.title_field) {
		const hasTitle = fields.some((f) => f.fieldname === meta.title_field);
		if (!hasTitle) {
			const titleField = meta.fields.find((f) => f.fieldname === meta.title_field);
			if (titleField && isValueType(titleField.fieldtype)) {
				fields.unshift(titleField);
			}
		}
	}

	if (fields.length > 0 && fields.filter((f) => f.fieldname === "name").length === 0) {
		const nameField = meta.fields.find((f) => f.fieldname === "name");
		if (nameField && isValueType(nameField.fieldtype)) {
			fields.unshift(nameField);
		}
	}

	return fields;
}

export function getAllFilterableFields(meta: DoctypeMeta): DocField[] {
	return meta.fields.filter((f) => isValueType(f.fieldtype) && !f.hidden);
}

export function getFieldOperators(fieldtype: string): { label: string; value: string }[] {
	const common = [
		{ label: "is", value: "is" },
		{ label: "is not", value: "is not" },
	];

	if (["Int", "Float", "Currency", "Percent"].includes(fieldtype)) {
		return [
			{ label: "=", value: "=" },
			{ label: "!=", value: "!=" },
			{ label: ">", value: ">" },
			{ label: "<", value: "<" },
			{ label: ">=", value: ">=" },
			{ label: "<=", value: "<=" },
			...common,
		];
	}

	if (["Date", "Datetime"].includes(fieldtype)) {
		return [
			{ label: "=", value: "=" },
			{ label: "!=", value: "!=" },
			{ label: ">", value: ">" },
			{ label: "<", value: "<" },
			{ label: ">=", value: ">=" },
			{ label: "<=", value: "<=" },
			{ label: "between", value: "between" },
			...common,
		];
	}

	if (fieldtype === "Check") {
		return [{ label: "=", value: "=" }];
	}

	if (fieldtype === "Select") {
		return [{ label: "=", value: "=" }, { label: "!=", value: "!=" }, ...common];
	}

	return [
		{ label: "=", value: "=" },
		{ label: "!=", value: "!=" },
		{ label: "like", value: "like" },
		{ label: "not like", value: "not like" },
		...common,
	];
}

export function parseSelectOptions(options?: string): string[] {
	if (!options) return [];
	return options
		.split("\n")
		.map((o) => o.trim())
		.filter(Boolean);
}
