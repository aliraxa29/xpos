import csv
from pathlib import Path

import click
import frappe
from frappe.gettext.translate import generate_pot, get_catalog, get_locales, update_po


def _update_csv_from_po(app: str, locale: str | None = None):
	"""Writes new strings from PO files to CSV

	Steps:

	1. Generate a POT file holding the app's translatable strings.
	2. Update the PO file from the POT file. This removes all superfluos translations.
	3. Read in the catalog from the PO file.
	4. Read in the CSV file.
	5. Remove all translations from the catalog that are already in the CSV.
	6. Append the remaining translations from the catalog to the CSV file.
	"""
	generate_pot(app)
	locales = [locale] if locale else get_locales(app)

	for _locale in locales:
		csv_file = Path(frappe.get_app_path(app)) / "translations" / f"{_locale.replace('_', '-')}.csv"

		if not csv_file.exists():
			continue

		update_po(app, _locale)
		catalog = get_catalog(app, _locale)

		with open(csv_file) as f:  # nosemgrep: frappe-security-file-traversal
			csv_translations = {(row[0], row[2] if len(row) > 2 else None): row[1] for row in csv.reader(f)}

		for message in list(catalog):
			if (message.id, message.context or "") in csv_translations or not message.string:
				catalog.delete(message.id, message.context)

		with open(csv_file, "a") as f:  # nosemgrep: frappe-security-file-traversal
			writer = csv.writer(f)
			for message in catalog._messages.values():
				if (
					message.id == message.string
					or message.id == message.context
					or not message.id.strip()
					or not message.string.strip()
				):
					continue

				writer.writerow([message.id, message.string, message.context or ""])


@click.command("update-csv-from-po")
@click.argument("app", nargs=1)
@click.option("--locale", help="Update CSV file only for this locale. eg: de")
def update_csv_from_po(app: str, locale: str | None = None) -> None:
	"""Add missing translations from PO file to CSV file.

	How to:
	(1) add a [locale].po file in the app's `locale` directory (this can be downloaded from the new translation platform or copied from another branch), then
	(2) run this command.

	This will add all translations to the CSV file, that are in the PO file but were missing in the CSV file.

	This command is intended for backporting translations from the new translation system to the old one.
	"""

	_update_csv_from_po(app, locale)
